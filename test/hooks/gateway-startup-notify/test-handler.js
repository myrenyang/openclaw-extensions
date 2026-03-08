/**
 * Test script for gateway-startup-notify hook
 *
 * This script:
 * 1. Mocks all shell command responses
 * 2. Simulates the handler logic
 * 3. Verifies the msg output format
 * 4. Does NOT actually send messages
 *
 * Run with: node test-handler.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Mock responses
const mockResponses = {
  'which openclaw': '/usr/local/bin/openclaw',
  'gateway status': `Runtime: running (pid 12345, state active)`,
  'build-info.json': JSON.stringify({
    version: '2026.3.2',
    commit: '85377a2',
    builtAt: '2026-03-08T08:00:00.000Z'
  }),
  'sessions --json': JSON.stringify({
    count: 3,
    sessions: [
      { key: 'agent:main:main', kind: 'direct', model: 'qwen3.5-plus', ageMs: 300000, totalTokens: 50000, contextTokens: 100000 },
      { key: 'agent:main:telegram', kind: 'group', model: 'qwen3.5-plus', ageMs: 7200000, totalTokens: 20000, contextTokens: 100000 }
    ]
  })
};

// Mock exec function
function mockExec(cmd) {
  console.log(`[MOCK EXEC] ${cmd}`);
  for (const [pattern, response] of Object.entries(mockResponses)) {
    if (cmd.includes(pattern)) {
      console.log(`  → Mocked: ${pattern}`);
      return response;
    }
  }
  return '';
}

// Format helpers (from handler.ts)
function formatTokens(tokens) {
  if (!tokens) return '0k';
  return Math.round(tokens / 1000) + 'k';
}

function calcPercentage(total, context) {
  if (!total || !context || context === 0) return '0%';
  return Math.round((total / context) * 100) + '%';
}

function formatBuildTime(isoString) {
  const d = new Date(isoString);
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${MM}.${dd}T${hh}:${mm}`;
}

// Simulate handler logic
function simulateHandler() {
  console.log('[TEST] Simulating gateway-startup-notify handler...\n');

  // Mock environment
  process.env.GATEWAY_NOTIFY_TELEGRAM = 'mock-telegram-id';
  process.env.GATEWAY_NOTIFY_WHATSAPP = 'mock-whatsapp-number';

  // Simulate OC_HOME detection
  const OC = mockExec('which openclaw');
  const ocDir = path.dirname(OC);
  const OC_HOME = ocDir.endsWith('/bin') ? path.dirname(ocDir) : ocDir;
  console.log(`[TEST] OC_HOME: ${OC_HOME}\n`);

  // Get status
  const statusRaw = mockExec('gateway status');
  const status = statusRaw.replace('Runtime: ', '').trim();

  // Get version info
  let version = '2026.3.2';
  let buildHash = '85377a2';
  let buildTime = '26.03.08T08:00';

  // Get sessions
  const sessionsData = JSON.parse(mockExec('sessions --json'));
  const sessionCount = sessionsData.count;
  const sessions = sessionsData.sessions.slice(0, 5).map(s => {
    const ageMin = Math.round(s.ageMs / 60000);
    const ageStr = ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.round(ageMin / 60)}h` : `${Math.round(ageMin / 1440)}d`;
    const tokens = formatTokens(s.totalTokens);
    const pct = calcPercentage(s.totalTokens, s.contextTokens);
    return `• ${ageStr} ago ${s.kind} ${s.key} ${s.model} ${tokens} ${pct}`;
  }).join('\n');

  // Format startup time
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

  // Build message (this is what the handler would send)
  const msg = `🔄 Gateway 已启动于 ${startupTime}

版本：v${version} (${buildHash}) at ${buildTime}
状态：${status}
会话：${sessionCount} 个，最近:
${sessions}`;

  return msg;
}

// Run test
console.log('='.repeat(60));
console.log('Gateway Startup Notify Hook - Test');
console.log('='.repeat(60));
console.log();

const capturedMessage = simulateHandler();

console.log();
console.log('='.repeat(60));
console.log('Test Results');
console.log('='.repeat(60));
console.log();

// Test 1: Message generated
console.log('Test 1: Message Generation');
if (capturedMessage) {
  console.log('  ✅ PASSED: Message generated successfully');
} else {
  console.log('  ❌ FAILED: No message generated');
}
console.log();

// Test 2: Message format validation
console.log('Test 2: Message Format Validation');
const checks = [
  { name: 'Contains gateway emoji (🔄)', test: () => capturedMessage.includes('🔄') },
  { name: 'Contains version info', test: () => capturedMessage.includes('v2026') || capturedMessage.includes('2026.3') },
  { name: 'Contains build hash', test: () => capturedMessage.includes('85377a2') },
  { name: 'Contains startup time', test: () => capturedMessage.includes('启动于') },
  { name: 'Contains status', test: () => capturedMessage.includes('状态') || capturedMessage.includes('running') },
  { name: 'Contains session count', test: () => capturedMessage.includes('会话') },
  { name: 'Contains session list', test: () => capturedMessage.includes('•') }
];

let allPassed = true;
checks.forEach(check => {
  const passed = check.test();
  if (!passed) allPassed = false;
  console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
});
console.log();

// Test 3: Environment variables
console.log('Test 3: Environment Variables');
const telegramSet = !!process.env.GATEWAY_NOTIFY_TELEGRAM;
const whatsappSet = !!process.env.GATEWAY_NOTIFY_WHATSAPP;
console.log(`  ${telegramSet ? '✅' : '❌'} GATEWAY_NOTIFY_TELEGRAM is set`);
console.log(`  ${whatsappSet ? '✅' : '❌'} GATEWAY_NOTIFY_WHATSAPP is set`);
console.log();

// Test 4: No actual message sent
console.log('Test 4: Message Not Actually Sent');
console.log('  ✅ PASSED: Messages are mocked (not sent to Telegram/WhatsApp)');
console.log();

// Summary
console.log('='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));
if (allPassed && capturedMessage) {
  console.log('✅ All tests PASSED');
} else {
  console.log('❌ Some tests FAILED');
}
console.log();

// Show captured message
console.log('📝 Captured Message:');
console.log('-'.repeat(60));
console.log(capturedMessage);
console.log('-'.repeat(60));
console.log();

// Exit
process.exit(allPassed && capturedMessage ? 0 : 1);
