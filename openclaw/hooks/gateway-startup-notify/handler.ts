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

export interface ChannelConfig {
  name: string;
  enabled: boolean;
  target?: string;
  allowFrom?: string[];
}

export interface DataResult<T> {
  data: T;
  error?: string;
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
 * Format build time to yy.M.d hh:mmZ
 */
export function formatBuildTime(isoString: string): string {
  const d = new Date(isoString);
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${MM}.${dd} ${hh}:${mm}Z`;
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
  buildTimeStr: string,
  sessions: SessionInfo[],
  errors: string[]
): string {
  const startupTime = getCurrentTimeAEDT();
  const sessionCount = sessions.length;
  const sessionsStr = sessions.slice(0, 5).map(formatSessionInfo).join('\n');

  let msg = `🔄 Gateway 已启动于 ${startupTime}

版本：v${versionFullStr}${buildTimeStr}
状态：${status}
会话：${sessionCount} 个，最近:
${sessionsStr}`;

  // Add errors section if any
  if (errors.length > 0) {
    msg += '\n\n⚠️ 数据收集错误:\n' + errors.map(e => `• ${e}`).join('\n');
  }

  return msg;
}

// ============================================
// Data Fetching Functions
// ============================================

/**
 * Get gateway status from CLI
 */
export async function getGatewayStatus(OC: string): Promise<DataResult<string>> {
  try {
    const { stdout: statusRaw } = await execAsync(`${OC} gateway status 2>&1 | grep 'Runtime:' | head -1`);
    return { data: statusRaw.trim().replace('Runtime: ', '') };
  } catch (err) {
    return { data: 'unknown', error: `获取状态失败：${err.message}` };
  }
}

/**
 * Get version info from build-info.json or fallback to --version
 */
export async function getVersionInfo(OC: string, OC_HOME: string): Promise<DataResult<VersionInfo>> {
  try {
    const buildInfoPath = path.join(OC_HOME, "lib/node_modules/openclaw/dist/build-info.json");
    const { stdout: buildInfoRaw } = await execAsync(`cat "${buildInfoPath}" 2>/dev/null`);
    const buildInfo = JSON.parse(buildInfoRaw);

    if (buildInfo.version) {
      return {
        data: {
          version: buildInfo.version,
          hash: buildInfo.commit ? buildInfo.commit.substring(0, 7) : '',
          time: buildInfo.builtAt ? formatBuildTime(buildInfo.builtAt) : ''
        }
      };
    }
  } catch (e) {
    // Fallback to --version
    try {
      const { stdout: versionRaw } = await execAsync(`${OC} --version 2>&1`);
      const version = versionRaw.trim() || 'unknown';
      return { data: { version, hash: '', time: '' } };
    } catch (e2) {
      return { data: { version: 'unknown', hash: '', time: '' }, error: '版本查询失败' };
    }
  }

  return { data: { version: 'unknown', hash: '', time: '' } };
}

/**
 * Get sessions list from CLI
 */
export async function getSessions(OC: string): Promise<DataResult<SessionInfo[]>> {
  try {
    const { stdout: sessionsJsonRaw } = await execAsync(`${OC} sessions --json --all-agents 2>&1 | grep -v "^\\[plugins\\]"`);
    const sessionsData = JSON.parse(sessionsJsonRaw);
    return { data: sessionsData.sessions || [] };
  } catch (err) {
    return { data: [], error: `获取会话失败：${err.message}` };
  }
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

/**
 * Get all enabled channels from config
 * Returns array of { name, target } for each enabled channel
 */
export async function getEnabledChannels(OC: string): Promise<DataResult<ChannelConfig[]>> {
  try {
    const { stdout: channelsJsonRaw } = await execAsync(`${OC} config get channels --json 2>&1 | grep -v "^\\[plugins\\]"`);
    const channelsData = JSON.parse(channelsJsonRaw);

    const enabledChannels: ChannelConfig[] = [];

    for (const [channelName, channelConfig] of Object.entries(channelsData)) {
      const config = channelConfig as any;
      if (config.enabled === true) {
        // Extract target from allowFrom[0] or defaultTo
        let target: string | undefined;
        if (config.defaultTo) {
          target = config.defaultTo;
        } else if (config.allowFrom && config.allowFrom.length > 0) {
          target = config.allowFrom[0];
        }

        enabledChannels.push({
          name: channelName,
          enabled: true,
          target,
          allowFrom: config.allowFrom || []
        });
      }
    }

    return { data: enabledChannels };
  } catch (err) {
    return { data: [], error: `获取频道配置失败：${err.message}` };
  }
}

// ============================================
// Handler (Entry Point)
// ============================================

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handler = async (event: any) => {
  // Only trigger on gateway startup
  if (event.type !== "gateway" || event.action !== "startup") {
    return;
  }

  // Wait for channels to initialize (for low-resource servers)
  console.log("[gateway-startup-notify] Gateway started, waiting 5s for channels to initialize...");
  await sleep(5000);

  console.log("[gateway-startup-notify] Gathering gateway status...");

  const errors: string[] = [];
  let OC = 'openclaw';
  let OC_HOME = process.env.HOME || '';

  try {
    // Get OpenClaw path
    try {
      const pathResult = await getOpenClawPath();
      OC = pathResult.OC;
      OC_HOME = pathResult.OC_HOME;
      console.log("[gateway-startup-notify] OC_HOME:", OC_HOME);
    } catch (err) {
      errors.push(`获取路径失败：${err.message}，使用默认值`);
    }

    // Fetch data (collect errors but continue)
    const statusResult = await getGatewayStatus(OC);
    if (statusResult.error) errors.push(statusResult.error);
    const status = statusResult.data;

    const versionResult = await getVersionInfo(OC, OC_HOME);
    if (versionResult.error) errors.push(versionResult.error);
    const versionInfo = versionResult.data;

    const sessionsResult = await getSessions(OC);
    if (sessionsResult.error) errors.push(sessionsResult.error);
    const sessions = sessionsResult.data;

    // Build version string with build time
    const versionFullStr = versionInfo.hash ? `${versionInfo.version} (${versionInfo.hash})` : versionInfo.version;
    const buildTimeStr = versionInfo.time ? ` at ${versionInfo.time}` : '';

    // Build message using pure function
    const msg = buildGatewayMessage(status, versionFullStr, buildTimeStr, sessions, errors);

    // Escape message for shell
    const escapedMsg = msg.replace(/"/g, '\\"');

    // Get enabled channels dynamically from config
    const channelsResult = await getEnabledChannels(OC);
    if (channelsResult.error) errors.push(channelsResult.error);
    const enabledChannels = channelsResult.data;

    if (enabledChannels.length === 0) {
      errors.push("未找到启用的频道");
    }

    console.log(`[gateway-startup-notify] Sending notifications to ${enabledChannels.length} channel(s): ${enabledChannels.map(c => c.name).join(', ')}...`);

    // Send messages to all enabled channels (don't let send errors stop the process)
    const sendPromises = enabledChannels.map(async channel => {
      if (!channel.target) {
        errors.push(`频道 ${channel.name} 没有目标地址`);
        return;
      }
      try {
        await execAsync(`${OC} message send --channel ${channel.name} --target ${channel.target} -m "${escapedMsg}"`);
        console.log(`[gateway-startup-notify] Sent to ${channel.name}`);
      } catch (sendErr) {
        errors.push(`发送到 ${channel.name} 失败：${sendErr.message}`);
      }
    });

    await Promise.all(sendPromises);

    if (errors.length > 0) {
      console.log(`[gateway-startup-notify] Completed with ${errors.length} error(s):`);
      errors.forEach(e => console.error("  -", e));
    } else {
      console.log("[gateway-startup-notify] Notifications sent successfully!");
    }
  } catch (err) {
    console.error("[gateway-startup-notify] Fatal error:", err.message);
    // Try to send error notification anyway using fallback channel
    try {
      const fallbackMsg = `⚠️ Gateway 启动通知失败\\n\\n错误：${err.message}\\n\\n请检查日志。`;
      await execAsync(`${OC} message send --channel telegram --target 6248047099 -m "${fallbackMsg}"`);
    } catch (fallbackErr) {
      console.error("[gateway-startup-notify] Fallback notification also failed:", fallbackErr.message);
    }
  }
};

export default handler;
