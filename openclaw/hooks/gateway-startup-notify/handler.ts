import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

export interface SessionInfo {
  key: string;
  kind: string;
  model: string;
  ageMs: number;
  totalTokens: number;
  contextTokens: number;
}

export interface VersionInfo {
  version: string;
  hash: string;
  time: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format tokens to k (thousands)
 */
export function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return '0k';
  const k = Math.round(tokens / 1000);
  return k + 'k';
}

/**
 * Calculate percentage
 */
export function calcPercentage(total: number | null, context: number | null): string {
  if (!total || !context || context === 0) return '0%';
  const pct = Math.round((total / context) * 100);
  return pct + '%';
}

/**
 * Format build time to yyMMddThh:mm
 */
export function formatBuildTime(isoString: string): string {
  const d = new Date(isoString);
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${MM}.${dd}T${hh}:${mm}`;
}

/**
 * Format session age to human readable string
 */
export function formatSessionAge(ageMs: number): string {
  const ageMin = Math.round(ageMs / 60000);
  if (ageMin < 60) {
    return `${ageMin}m`;
  } else if (ageMin < 1440) {
    return `${Math.round(ageMin / 60)}h`;
  } else {
    return `${Math.round(ageMin / 1440)}d`;
  }
}

/**
 * Format session info to display string
 */
export function formatSessionInfo(s: SessionInfo): string {
  const ageStr = formatSessionAge(s.ageMs);
  const tokens = formatTokens(s.totalTokens);
  const pct = calcPercentage(s.totalTokens, s.contextTokens);
  return `• ${ageStr} ago ${s.kind} ${s.key} ${s.model} ${tokens} ${pct}`;
}

/**
 * Get current time formatted for Australia/Sydney timezone
 */
export function getCurrentTimeAEDT(): string {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(',', '') + ' AEDT';
}

/**
 * Build the gateway startup notification message
 */
export function buildGatewayMessage(
  status: string,
  versionFullStr: string,
  sessions: SessionInfo[]
): string {
  const startupTime = getCurrentTimeAEDT();
  const sessionCount = sessions.length;
  const sessionsStr = sessions.slice(0, 5).map(formatSessionInfo).join('\n');

  return `🔄 Gateway 已启动于 ${startupTime}

版本：v${versionFullStr}
状态：${status}
会话：${sessionCount} 个，最近:
${sessionsStr}`;
}

// ============================================
// Data Fetching Functions
// ============================================

/**
 * Get gateway status from CLI
 */
export async function getGatewayStatus(OC: string): Promise<string> {
  const { stdout: statusRaw } = await execAsync(`${OC} gateway status 2>&1 | grep 'Runtime:' | head -1`);
  return statusRaw.trim().replace('Runtime: ', '');
}

/**
 * Get version info from build-info.json or fallback to --version
 */
export async function getVersionInfo(OC: string, OC_HOME: string): Promise<VersionInfo> {
  try {
    const buildInfoPath = path.join(OC_HOME, "lib/node_modules/openclaw/dist/build-info.json");
    const { stdout: buildInfoRaw } = await execAsync(`cat "${buildInfoPath}" 2>/dev/null`);
    const buildInfo = JSON.parse(buildInfoRaw);

    if (buildInfo.version) {
      return {
        version: buildInfo.version,
        hash: buildInfo.commit ? buildInfo.commit.substring(0, 7) : '',
        time: buildInfo.builtAt ? formatBuildTime(buildInfo.builtAt) : ''
      };
    }
  } catch (e) {
    // Fallback to --version
    try {
      const { stdout: versionRaw } = await execAsync(`${OC} --version 2>&1`);
      const version = versionRaw.trim() || 'unknown';
      return { version, hash: '', time: '' };
    } catch (e2) {
      console.log("[gateway-startup-notify] version lookup failed");
    }
  }

  return { version: 'unknown', hash: '', time: '' };
}

/**
 * Get sessions list from CLI
 */
export async function getSessions(OC: string): Promise<SessionInfo[]> {
  const { stdout: sessionsJsonRaw } = await execAsync(`${OC} sessions --json --all-agents 2>&1`);
  const sessionsData = JSON.parse(sessionsJsonRaw);
  return sessionsData.sessions || [];
}

/**
 * Get OpenClaw binary path
 */
export async function getOpenClawPath(): Promise<{ OC: string; OC_HOME: string }> {
  const { stdout: ocPathRaw } = await execAsync("which openclaw");
  const OC = ocPathRaw.trim();
  const ocDir = path.dirname(OC);
  const OC_HOME = ocDir.endsWith("/bin") ? path.dirname(ocDir) : ocDir;
  return { OC, OC_HOME };
}

// ============================================
// Handler (Entry Point)
// ============================================

const handler = async (event: any) => {
  // Only trigger on gateway startup
  if (event.type !== "gateway" || event.action !== "startup") {
    return;
  }

  console.log("[gateway-startup-notify] Gateway started, gathering status...");

  try {
    // Get OpenClaw path
    const { OC, OC_HOME } = await getOpenClawPath();
    console.log("[gateway-startup-notify] OC_HOME:", OC_HOME);

    // Fetch data
    const status = await getGatewayStatus(OC);
    const versionInfo = await getVersionInfo(OC, OC_HOME);
    const sessions = await getSessions(OC);

    // Build version string
    const versionFullStr = versionInfo.hash ? `${versionInfo.version} (${versionInfo.hash})` : versionInfo.version;

    // Build message using pure function
    const msg = buildGatewayMessage(status, versionFullStr, sessions);

    // Escape message for shell
    const escapedMsg = msg.replace(/"/g, '\\"');

    // Get targets from environment variables (required)
    const telegramTarget = process.env.GATEWAY_NOTIFY_TELEGRAM;
    const whatsappTarget = process.env.GATEWAY_NOTIFY_WHATSAPP;

    if (!telegramTarget || !whatsappTarget) {
      throw new Error("Missing required environment variables: GATEWAY_NOTIFY_TELEGRAM and GATEWAY_NOTIFY_WHATSAPP");
    }

    console.log("[gateway-startup-notify] Sending notifications to Telegram and WhatsApp...");

    // Send messages
    await Promise.all([
      execAsync(`${OC} message send --channel telegram --target ${telegramTarget} -m "${escapedMsg}"`),
      execAsync(`${OC} message send --channel whatsapp --target ${whatsappTarget} -m "${escapedMsg}"`)
    ]);

    console.log("[gateway-startup-notify] Notifications sent successfully!");
  } catch (err) {
    console.error("[gateway-startup-notify] Error:", err.message);
  }
};

export default handler;
