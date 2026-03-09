# Gateway Startup Notify Hook - Tests

测试 gateway-startup-notify hook 的功能。

---

## 📁 目录结构

```
test/hooks/gateway-startup-notify/
├── README.md           # 本文档
├── package.json        # 测试依赖
├── package-lock.json
├── tsconfig.json       # TypeScript 配置
├── dist/               # 编译后的 JS
│   └── handler.js
├── mocks/              # Mock 数据
│   └── build-info.json
└── test-handler.js     # 测试脚本
```

---

## 🔧 前置条件

安装测试依赖：
```bash
npm install
```

---

## 📝 编译 TypeScript

测试前需要先编译 handler.ts：
```bash
npx tsc
```

这会生成 `dist/handler.js` 文件供测试使用。

---

## 🧪 运行测试

```bash
node test-handler.js
```

测试会 mock 所有外部命令，验证：

### 辅助函数（纯函数）
- `formatTokens()` - 格式化 token 数量
- `calcPercentage()` - 计算百分比
- `formatBuildTime()` - 格式化构建时间
- `formatSessionAge()` - 格式化会话时长
- `formatSessionInfo()` - 格式化会话信息
- `getCurrentTimeAEDT()` - 获取当前时间

### 消息构建函数
- `buildGatewayMessage()` - 构建消息

### 数据获取函数（需要 mock）
- `getGatewayStatus()` - 获取 gateway 状态
- `getVersionInfo()` - 获取版本信息
- `getSessions()` - 获取会话列表
- `getEnabledChannels()` - 获取启用的频道列表（新增）

**总计：56 个测试**

---

## 🎯 测试模式

```javascript
// 1. Mock shell 命令返回值
mockResponses['gateway status'] = 'Runtime: running...';

// 2. 调用函数
const status = await getGatewayStatus('/usr/local/bin/openclaw');

// 3. 验证返回值
assert(status === 'running...');
```

---

## 📊 测试覆盖

| 类别 | 测试数 |
|------|--------|
| 辅助函数 | 28 |
| buildGatewayMessage | 9 |
| getGatewayStatus | 2 |
| getVersionInfo | 3 |
| getSessions | 3 |
| getEnabledChannels | 11 |
| **总计** | **56** |

---

## 🔄 更新 Mock 数据

修改 `mocks/build-info.json` 来测试不同的版本信息：

```json
{
  "version": "2026.3.2",
  "commit": "85377a2f085f93fa08e96a712ae893155fce634",
  "builtAt": "2026-03-08T08:00:00.000Z"
}
```

---

## ✅ 测试通过示例

```
============================================================
Gateway Startup Notify Hook - Test Suite
============================================================
...
============================================================
Summary
============================================================
Total: 45 tests
✅ Passed: 45
❌ Failed: 0

🎉 All tests PASSED!
```
