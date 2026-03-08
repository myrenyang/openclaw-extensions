/**
 * Mock for openclaw CLI commands
 * Returns predefined responses for testing
 */

const mockResponses = {
  'which openclaw': '/usr/local/bin/openclaw',

  'gateway status': `Service: systemd (enabled)
File logs: /tmp/openclaw/openclaw-2026-03-08.log
Command: /usr/local/bin/node /usr/local/lib/node_modules/openclaw/dist/entry.js gateway --port 18789
Service file: ~/.config/systemd/user/openclaw-gateway.service

Gateway: bind=loopback (127.0.0.1), port=18789
Probe target: ws://127.0.0.1:18789
Dashboard: http://127.0.0.1:18789/

Runtime: running (pid 12345, state active, sub running, last exit 0, reason 0)
RPC probe: ok`,

  'sessions --json --all-agents': JSON.stringify({
    count: 3,
    sessions: [
      {
        key: 'agent:main:main',
        kind: 'direct',
        model: 'qwen3.5-plus',
        ageMs: 300000,
        totalTokens: 50000,
        contextTokens: 100000
      },
      {
        key: 'agent:main:telegram:group:-1003796507159',
        kind: 'group',
        model: 'qwen3.5-plus',
        ageMs: 7200000,
        totalTokens: 20000,
        contextTokens: 100000
      },
      {
        key: 'agent:main:whatsapp:group:120363424332804776@g.us',
        kind: 'group',
        model: 'qwen3.5-plus',
        ageMs: 28800000,
        totalTokens: 14000,
        contextTokens: 100000
      }
    ]
  }),

  '--version': '2026.3.2 (85377a2)'
};

/**
 * Mock execAsync function
 * @param {string} command - The command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function mockExecAsync(command) {
  console.log(`[MOCK] Executing: ${command}`);

  // Find matching mock response
  for (const [cmdPattern, response] of Object.entries(mockResponses)) {
    if (command.includes(cmdPattern)) {
      console.log(`[MOCK] Returning mock response for: ${cmdPattern}`);
      return { stdout: response, stderr: '' };
    }
  }

  // Default response for unknown commands
  console.log(`[MOCK] No mock found for: ${command}, returning empty`);
  return { stdout: '', stderr: '' };
}

/**
 * Mock message send - just logs instead of actually sending
 */
async function mockMessageSend(channel, target, message) {
  console.log(`\n[MOCK MESSAGE SEND]`);
  console.log(`  Channel: ${channel}`);
  console.log(`  Target: ${target}`);
  console.log(`  Message preview: ${message.substring(0, 100)}...`);
  console.log(`  [NOT SENT - This is a test]\n`);
  return { success: true, messageId: 'mock-123' };
}

module.exports = {
  mockExecAsync,
  mockMessageSend,
  mockResponses
};
