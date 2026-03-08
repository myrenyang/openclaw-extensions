import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

// Format tokens to k (thousands)
function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return '0k';
  const k = Math.round(tokens / 1000);
  return k + 'k';
}

// Calculate percentage
function calcPercentage(total: number | null, context: number | null): string {
  if (!total || !context || context === 0) return '0%';
  const pct = Math.round((total / context) * 100);
  return pct + '%';
}

// Format build time to yyMMddThh:mm
function formatBuildTime(isoString: string): string {
  const d = new Date(isoString);
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${MM}.${dd}T${hh}:${mm}`;
}

const handler = async (event: any) => {
  // Only trigger on gateway startup
  if (event.type !== "gateway" || event.action !== "startup") {
    return;
  }

  console.log("[gateway-startup-notify] Gateway started, gathering status...");

  try {
    // Get openclaw binary path using `which`
    const { stdout: ocPathRaw } = await execAsync("which openclaw");
    const OC = ocPathRaw.trim();
    
    // Calculate OC_HOME: openclaw is at $OC_HOME/bin/openclaw
    // Typically: ~/.npm-global/bin/openclaw -> OC_HOME = ~/.npm-global
    const ocDir = path.dirname(OC);
    const OC_HOME = ocDir.endsWith("/bin") ? path.dirname(ocDir) : ocDir;

    console.log("[gateway-startup-notify] OC_HOME:", OC_HOME);

    // Get gateway status
    const { stdout: statusRaw } = await execAsync(`${OC} gateway status 2>&1 | grep 'Runtime:' | head -1`);
    const status = statusRaw.trim().replace('Runtime: ', '');
    
    // Get version, build hash and build time from build-info.json
    let version = 'unknown';
    let buildHash = '';
    let buildTime = '';
    
    try {
      const buildInfoPath = path.join(OC_HOME, "lib/node_modules/openclaw/dist/build-info.json");
      const { stdout: buildInfoRaw } = await execAsync(`cat "${buildInfoPath}" 2>/dev/null`);
      const buildInfo = JSON.parse(buildInfoRaw);
      if (buildInfo.version) {
        version = buildInfo.version;
        buildHash = buildInfo.commit ? buildInfo.commit.substring(0, 7) : '';
        buildTime = buildInfo.builtAt ? formatBuildTime(buildInfo.builtAt) : '';
      }
    } catch (e) {
      // Fallback to --version
      try {
        const { stdout: versionRaw } = await execAsync(`${OC} --version 2>&1`);
        version = versionRaw.trim() || 'unknown';
      } catch (e2) {
        console.log("[gateway-startup-notify] version lookup failed");
      }
    }
    
    const versionStr = buildHash ? `${version} (${buildHash})` : version;
    
    // Get sessions as JSON
    let sessionCount = 0;
    let sessions = '';
    try {
      const { stdout: sessionsJsonRaw } = await execAsync(`${OC} sessions --json --all-agents 2>&1`);
      const sessionsData = JSON.parse(sessionsJsonRaw);
      sessionCount = sessionsData.count || 0;
      sessions = (sessionsData.sessions || []).slice(0, 5).map((s: any) => {
        const ageMin = Math.round(s.ageMs / 60000);
        let ageStr: string;
        if (ageMin < 60) {
          ageStr = `${ageMin}m`;
        } else if (ageMin < 1440) {
          ageStr = `${Math.round(ageMin / 60)}h`;
        } else {
          ageStr = `${Math.round(ageMin / 1440)}d`;
        }
        const tokens = formatTokens(s.totalTokens);
        const pct = calcPercentage(s.totalTokens, s.contextTokens);
        return `• ${ageStr} ago ${s.kind} ${s.key} ${s.model} ${tokens} ${pct}`;
      }).join('\n');
    } catch (e) {
      console.log("[gateway-startup-notify] sessions lookup failed");
    }
    
    // Format startup time as yyyy-MM-dd hh:mm:ss am/pm AEDT
    const startupTime = new Date().toLocaleString('en-CA', { 
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '') + ' AEDT';
    
    const msg = `🔄 Gateway 已启动于 ${startupTime}

版本：v${versionStr}${buildTime ? ' at ' + buildTime : ''}
状态：${status}
会话：${sessionCount} 个，最近:
${sessions}`;
    
    // Escape message for shell
    const escapedMsg = msg.replace(/"/g, '\\"');
    
    // Get targets from environment variables (required)
    const telegramTarget = process.env.GATEWAY_NOTIFY_TELEGRAM;
    const whatsappTarget = process.env.GATEWAY_NOTIFY_WHATSAPP;
    
    if (!telegramTarget || !whatsappTarget) {
      throw new Error("Missing required environment variables: GATEWAY_NOTIFY_TELEGRAM and GATEWAY_NOTIFY_WHATSAPP");
    }
    
    console.log("[gateway-startup-notify] Sending notifications to Telegram and WhatsApp...");
    
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
