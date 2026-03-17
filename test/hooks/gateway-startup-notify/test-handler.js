/**
 * Test suite for gateway-startup-notify hook
 *
 * Tests:
 * 1. getGatewayStatus - mock exec, verify status parsing
 * 2. getVersionInfo - mock exec, verify version parsing
 * 3. getSessions - mock exec, verify sessions parsing
 * 4. buildGatewayMessage - pure function, verify message format
 * 5. Helper functions - formatTokens, calcPercentage, etc.
 *
 * Run with: node test-handler.js
 */

// ============================================
// Setup: Mock child_process BEFORE importing handler
// ============================================

const mockResponses = {};
let capturedExecCalls = [];

// Mock exec function
function mockExec(command) {
  return new Promise((resolve, reject) => {
    capturedExecCalls.push(command);
    const response = mockResponses[command] || mockResponses[Object.keys(mockResponses).find(k => command.includes(k))];
    if (response !== undefined) {
      resolve({ stdout: response, stderr: '' });
    } else {
      resolve({ stdout: '', stderr: '' });
    }
  });
}

// Override Module.prototype.require to intercept child_process
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  const module = originalRequire.apply(this, arguments);

  if (id === 'child_process') {
    return { exec: mockExec };
  }
  if (id === 'util') {
    return {
      promisify: (fn) => fn  // Return function as-is for mock
    };
  }
  return module;
};

// Import the compiled handler (from TypeScript)
const handler = require('./dist/handler.js');
const {
  formatTokens,
  calcPercentage,
  formatBuildTime,
  formatSessionAge,
  formatSessionInfo,
  getCurrentTimeAEDT,
  buildGatewayMessage,
  getGatewayStatus,
  getVersionInfo,
  getSessions,
  getEnabledChannels
} = handler;

// ============================================
// Test Utilities
// ============================================

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${message}`);
    failedTests++;
  }
}

function resetMocks() {
  mockResponses.length = 0;
  capturedExecCalls = [];
}

// ============================================
// Test: Helper Functions (Pure Functions)
// ============================================

function testHelperFunctions() {
  console.log('\n📋 Test: Helper Functions (Pure)');
  console.log('=' .repeat(50));

  // formatTokens
  assert(formatTokens(50000) === '50k', 'formatTokens(50000) === "50k"');
  assert(formatTokens(1000) === '1k', 'formatTokens(1000) === "1k"');
  assert(formatTokens(0) === '0k', 'formatTokens(0) === "0k"');
  assert(formatTokens(null) === '0k', 'formatTokens(null) === "0k"');

  // calcPercentage
  assert(calcPercentage(50000, 100000) === '50%', 'calcPercentage(50000, 100000) === "50%"');
  assert(calcPercentage(25499, 100000) === '25%', 'calcPercentage(25499, 100000) === "25%" (rounds down)');
  assert(calcPercentage(25500, 100000) === '26%', 'calcPercentage(25500, 100000) === "26%" (rounds up)');
  assert(calcPercentage(0, 100000) === '0%', 'calcPercentage(0, 100000) === "0%"');
  assert(calcPercentage(null, 100000) === '0%', 'calcPercentage(null, 100000) === "0%"');

  // formatBuildTime (check format, not exact value due to timezone)
  const buildTimeResult = formatBuildTime('2026-03-08T08:00:00.000Z');
  // Format: yy.M.d hh:mmZ (e.g., 26.3.8 08:00Z)
  assert(buildTimeResult.match(/^\d{2}\.\d{1,2}\.\d{1,2} \d{2}:\d{2}Z$/), 'formatBuildTime returns correct format (yy.M.d hh:mmZ)');

  // formatSessionAge
  assert(formatSessionAge(300000) === '5m', 'formatSessionAge(300000) === "5m"');
  assert(formatSessionAge(7200000) === '2h', 'formatSessionAge(7200000) === "2h"');
  assert(formatSessionAge(86400000) === '1d', 'formatSessionAge(86400000) === "1d"');

  // formatSessionInfo - Test all fields
  const mockSession = {
    key: 'agent:main:main',
    kind: 'direct',
    model: 'qwen3.5-plus',
    ageMs: 300000,
    totalTokens: 50000,
    contextTokens: 100000
  };
  const sessionStr = formatSessionInfo(mockSession);

  // Verify all fields are present
  assert(sessionStr.includes('5m'), 'formatSessionInfo includes age (5m)');
  assert(sessionStr.includes('ago'), 'formatSessionInfo includes "ago"');
  assert(sessionStr.includes('direct'), 'formatSessionInfo includes kind (direct)');
  assert(sessionStr.includes('agent:main:main'), 'formatSessionInfo includes key');
  assert(sessionStr.includes('qwen3.5-plus'), 'formatSessionInfo includes model');
  assert(sessionStr.includes('50k'), 'formatSessionInfo includes tokens (50k)');
  assert(sessionStr.includes('50%'), 'formatSessionInfo includes percentage (50%)');
  assert(sessionStr.startsWith('•'), 'formatSessionInfo starts with bullet point');

  // Test different session kinds
  const groupSession = { ...mockSession, kind: 'group', key: 'telegram:group:123' };
  const groupStr = formatSessionInfo(groupSession);
  assert(groupStr.includes('group'), 'formatSessionInfo handles group kind');
  assert(groupStr.includes('telegram:group:123'), 'formatSessionInfo includes group key');

  // Test different token counts
  const largeTokenSession = { ...mockSession, totalTokens: 1500000 };
  const largeTokenStr = formatSessionInfo(largeTokenSession);
  assert(largeTokenStr.includes('1500k'), 'formatSessionInfo handles large token counts (1500k)');

  // Test different ages
  const hourSession = { ...mockSession, ageMs: 7200000 }; // 2 hours
  const hourStr = formatSessionInfo(hourSession);
  assert(hourStr.includes('2h'), 'formatSessionInfo handles hours (2h)');

  const daySession = { ...mockSession, ageMs: 172800000 }; // 2 days
  const dayStr = formatSessionInfo(daySession);
  assert(dayStr.includes('2d'), 'formatSessionInfo handles days (2d)');

  // getCurrentTimeAEDT
  const timeStr = getCurrentTimeAEDT();
  assert(timeStr.includes('AEDT'), 'getCurrentTimeAEDT includes timezone');
  assert(timeStr.length > 10, 'getCurrentTimeAEDT returns non-empty string');
}

// ============================================
// Test: buildGatewayMessage (Pure Function)
// ============================================

function testBuildGatewayMessage() {
  console.log('\n📋 Test: buildGatewayMessage (Pure)');
  console.log('=' .repeat(50));

  const mockSessions = [
    { key: 'agent:main:main', kind: 'direct', model: 'qwen3.5-plus', ageMs: 300000, totalTokens: 50000, contextTokens: 100000 },
    { key: 'agent:main:telegram', kind: 'group', model: 'qwen3.5-plus', ageMs: 7200000, totalTokens: 20000, contextTokens: 100000 }
  ];

  const msg = buildGatewayMessage('running (pid 12345)', '2026.3.2 (85377a2)', ' at 26.3.3 15:36Z', mockSessions, []);

  // Verify message structure
  assert(msg.includes('🔄'), 'Message includes gateway emoji');
  assert(msg.includes('Gateway 已启动于'), 'Message includes startup header');
  assert(msg.includes('版本：v2026.3.2'), 'Message includes version');
  assert(msg.includes('85377a2'), 'Message includes build hash');
  assert(msg.includes('at 26.3.3 15:36Z'), 'Message includes build time (new format)');
  assert(msg.includes('状态：running'), 'Message includes status');
  assert(msg.includes('会话：2 个'), 'Message includes session count');
  assert(msg.includes('5m ago'), 'Message includes session age');
  assert(msg.includes('50k'), 'Message includes token count');
  assert(msg.includes('AEDT'), 'Message includes timezone');

  // Test with errors
  const msgWithErrors = buildGatewayMessage('running', '2026.3.2', '', [], ['Error 1', 'Error 2']);
  assert(msgWithErrors.includes('⚠️'), 'Message with errors includes warning emoji');
  assert(msgWithErrors.includes('数据收集错误'), 'Message with errors includes errors header');
  assert(msgWithErrors.includes('Error 1'), 'Message with errors includes first error');
  assert(msgWithErrors.includes('Error 2'), 'Message with errors includes second error');
}

// ============================================
// Test: getGatewayStatus (Async with Mock)
// ============================================

async function testGetGatewayStatus() {
  console.log('\n📋 Test: getGatewayStatus (Async with Mock)');
  console.log('=' .repeat(50));

  resetMocks();

  // Mock the gateway status command
  mockResponses['gateway status'] = 'Runtime: running (pid 12345, state active, sub running)';

  const result = await getGatewayStatus('/usr/local/bin/openclaw');

  assert(result.data === 'running (pid 12345, state active, sub running)', 'getGatewayStatus returns correct status');
  assert(!result.error, 'getGatewayStatus returns no error');
  assert(capturedExecCalls.some(c => c.includes('gateway status')), 'getGatewayStatus calls gateway status command');
}

// ============================================
// Test: getVersionInfo (Async with Mock)
// ============================================

async function testGetVersionInfo() {
  console.log('\n📋 Test: getVersionInfo (Async with Mock)');
  console.log('=' .repeat(50));

  resetMocks();

  // Mock build-info.json response (match the exact command pattern)
  const mockBuildInfo = {
    version: '2026.3.2',
    commit: '85377a2f085f93fa08e96a712ae893155fce634',
    builtAt: '2026-03-08T08:00:00.000Z'
  };
  mockResponses['cat'] = JSON.stringify(mockBuildInfo);

  const result = await getVersionInfo('/usr/local/bin/openclaw', '/usr/local');

  assert(result.data.version === '2026.3.2', 'getVersionInfo returns correct version');
  assert(result.data.hash === '85377a2', 'getVersionInfo returns correct hash');
  assert(!result.error, 'getVersionInfo returns no error');
  // Time format may vary due to timezone, just check it's non-empty
  assert(result.data.time.length > 0, 'getVersionInfo returns non-empty time');
}

// ============================================
// Test: getSessions (Async with Mock)
// ============================================

async function testGetSessions() {
  console.log('\n📋 Test: getSessions (Async with Mock)');
  console.log('=' .repeat(50));

  resetMocks();

  // Mock sessions response
  mockResponses['sessions --json'] = JSON.stringify({
    count: 3,
    sessions: [
      { key: 'agent:main:main', kind: 'direct', model: 'qwen3.5-plus', ageMs: 300000, totalTokens: 50000, contextTokens: 100000 },
      { key: 'agent:main:telegram', kind: 'group', model: 'qwen3.5-plus', ageMs: 7200000, totalTokens: 20000, contextTokens: 100000 }
    ]
  });

  const result = await getSessions('/usr/local/bin/openclaw');

  assert(result.data.length === 2, 'getSessions returns correct number of sessions');
  assert(!result.error, 'getSessions returns no error');
  assert(result.data[0].key === 'agent:main:main', 'getSessions returns correct session key');
  assert(result.data[0].model === 'qwen3.5-plus', 'getSessions returns correct model');
}

// ============================================
// Test: getEnabledChannels (Async with Mock)
// ============================================

async function testGetEnabledChannels() {
  console.log('\n📋 Test: getEnabledChannels (Async with Mock)');
  console.log('=' .repeat(50));

  resetMocks();

  // Mock channels config response (match the exact command pattern)
  const mockChannelsConfig = {
    whatsapp: {
      enabled: true,
      dmPolicy: 'allowlist',
      allowFrom: ['+61401234567'],
      defaultTo: '+61401234567'
    },
    telegram: {
      enabled: true,
      dmPolicy: 'pairing',
      allowFrom: ['+8612345678901']
    },
    discord: {
      enabled: false,
      groupPolicy: 'allowlist'
    }
  };
  mockResponses['config get channels'] = JSON.stringify(mockChannelsConfig);

  const result = await getEnabledChannels('/usr/local/bin/openclaw');

  // Verify only enabled channels are returned
  assert(!result.error, 'getEnabledChannels returns no error');
  assert(result.data.length === 2, 'getEnabledChannels returns only enabled channels (2)');

  // Verify whatsapp channel
  const whatsapp = result.data.find(c => c.name === 'whatsapp');
  assert(whatsapp !== undefined, 'whatsapp channel is found');
  assert(whatsapp.enabled === true, 'whatsapp enabled is true');
  assert(whatsapp.target === '+61401234567', 'whatsapp target is from defaultTo');
  assert(whatsapp.allowFrom.length === 1, 'whatsapp allowFrom has 1 item');

  // Verify telegram channel
  const telegram = result.data.find(c => c.name === 'telegram');
  assert(telegram !== undefined, 'telegram channel is found');
  assert(telegram.enabled === true, 'telegram enabled is true');
  assert(telegram.target === '+8612345678901', 'telegram target is from allowFrom[0]');
  assert(telegram.allowFrom.length === 1, 'telegram allowFrom has 1 item');

  // Verify discord is NOT included (disabled)
  const discord = result.data.find(c => c.name === 'discord');
  assert(discord === undefined, 'discord channel is NOT included (disabled)');

  // Verify exec command was called
  assert(capturedExecCalls.some(c => c.includes('config get channels')), 'getEnabledChannels calls config get channels command');
}

// ============================================
// Main Test Runner
// ============================================

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('Gateway Startup Notify Hook - Test Suite');
  console.log('='.repeat(60));

  // Run all tests
  testHelperFunctions();
  testBuildGatewayMessage();
  await testGetGatewayStatus();
  await testGetVersionInfo();
  await testGetSessions();
  await testGetEnabledChannels();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${passedTests + failedTests} tests`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  if (failedTests === 0) {
    console.log('\n🎉 All tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests FAILED');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
