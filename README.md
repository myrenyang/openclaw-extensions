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
│           ├── README.md       # 测试文档
│           ├── dist/           # 编译后的 JS
│           ├── mocks/          # Mock 数据
│           ├── package.json    # 测试依赖
│           └── tsconfig.json   # TypeScript 配置
├── .gitignore
├── .pre-commit-config.yaml     # Pre-commit 配置
├── SECURITY.md                 # 安全保护文档
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

## 📝 说明

- 本仓库包含个人定制的 OpenClaw hooks 和配置
- 所有 hooks 放在 `openclaw/hooks/` 目录下
- 每个 hook 是一个独立的目录，包含 `handler.ts`
- 测试代码放在 `test/hooks/` 目录下，查看 [test/hooks/gateway-startup-notify/README.md](test/hooks/gateway-startup-notify/README.md)

## 🛡️ 安全

查看 [SECURITY.md](SECURITY.md) 了解安全保护配置。
