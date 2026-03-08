# OpenClaw Extensions

我的 OpenClaw 个人配置和扩展。

## 📁 目录结构

```
openclaw-extensions/
├── openclaw/                   # 源代码
│   └── hooks/
│       └── gateway-startup-notify/
│           └── handler.ts      # Hook 实现
├── test/                       # 测试代码
│   └── hooks/
│       └── gateway-startup-notify/
│           ├── dist/           # 编译后的 JS
│           ├── mocks/          # Mock 数据
│           ├── package.json    # 测试依赖
│           ├── tsconfig.json   # TypeScript 配置
│           └── test-handler.js # 测试脚本
├── .gitignore
├── .pre-commit-config.yaml     # Pre-commit 配置
└── README.md
```

## 🔧 Hooks

### gateway-startup-notify

Gateway 启动时发送通知到 Telegram 和 WhatsApp。

**功能：**
- 显示版本号、build hash、build 时间
- 显示运行状态
- 列出最近的 sessions
- 同时发送到 Telegram 和 WhatsApp

**安装：**
```bash
cp -r openclaw/hooks/gateway-startup-notify ~/.openclaw/hooks/
openclaw hooks enable gateway-startup-notify
```

**配置环境变量（必需）：**
```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export GATEWAY_NOTIFY_TELEGRAM="<your-telegram-id>"
export GATEWAY_NOTIFY_WHATSAPP="<your-whatsapp-number>"

# Example:
# export GATEWAY_NOTIFY_TELEGRAM="REDACTED_TELEGRAM"
# export GATEWAY_NOTIFY_WHATSAPP="REDACTED_WHATSAPP"
```

**重启 gateway：**
```bash
openclaw gateway restart
```

## 🚀 使用

1. Clone 本仓库到本地
2. 复制需要的 hooks 到 `~/.openclaw/hooks/`
3. 使用 `openclaw hooks enable <hook-name>` 启用
4. 重启 gateway: `openclaw gateway restart`

---

## 🧪 测试（开发用）

### 前置条件

安装测试依赖：
```bash
cd test/hooks/gateway-startup-notify
npm install
```

### 编译 TypeScript

测试前需要先编译 handler.ts：
```bash
npx tsc
```

这会生成 `dist/handler.js` 文件供测试使用。

### 运行测试

```bash
node test-handler.js
```

测试会 mock 所有外部命令，验证：
- 辅助函数（formatTokens, calcPercentage, formatBuildTime 等）
- buildGatewayMessage 纯函数
- 数据获取函数（getGatewayStatus, getVersionInfo, getSessions）

**总计：45 个测试**

### 测试模式

```javascript
// 1. Mock shell 命令返回值
mockResponses['gateway status'] = 'Runtime: running...';

// 2. 调用函数
const status = await getGatewayStatus('/usr/local/bin/openclaw');

// 3. 验证返回值
assert(status === 'running...');
```

---

## 📝 说明

- 本仓库包含个人定制的 OpenClaw hooks 和配置
- 所有 hooks 放在 `openclaw/hooks/` 目录下
- 每个 hook 是一个独立的目录，包含 `handler.ts`
- 测试代码放在 `test/hooks/` 目录下

## 🛡️ 安全

查看 [SECURITY.md](SECURITY.md) 了解安全保护配置。
