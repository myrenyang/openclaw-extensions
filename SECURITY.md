# Security - 安全保护

本仓库配置了多层安全保护，防止敏感信息泄露。

---

## 🛡️ Pre-commit Hooks

在 commit 前自动检查代码中的敏感信息。

### 安装的工具

**pre-commit-hooks:**
- `detect-private-key` - 检测 RSA/SSH/EC 私钥
- `trailing-whitespace` - 清理尾部空格
- `end-of-file-fixer` - 修复文件末尾换行

**detect-secrets (Yelp):**
- 熵值分析检测高熵字符串
- 检测 API keys、密码、令牌等
- 使用 `.secrets.baseline` 文件管理已知密钥

### 自定义检查

**~/.git-templates/hooks/pre-commit:**
1. 电话号码检测（澳洲/中国格式）
2. API Keys 检测
3. 密码/令牌检测
4. AWS 凭证检测
5. 私钥检测（匹配私钥文件头）
6. 高熵字符串检测

---

## 📋 敏感信息检测清单

| 类型 | 检测方式 | 级别 |
|------|----------|------|
| 电话号码 | 正则匹配（澳洲/中国格式） | ❌ 阻止 |
| API Keys | 正则 + 熵值分析 | ❌ 阻止 |
| 密码/令牌 | 正则匹配 | ⚠️ 警告 |
| AWS 凭证 | 正则匹配（AKIA 开头） | ❌ 阻止 |
| 私钥 | 正则匹配（私钥文件头） | ❌ 阻止 |
| 高熵字符串 | 熵值分析（32+ 位随机字符串） | ⚠️ 警告 |

---

## 🔧 使用方法

### 更新 baseline

如果代码中有合法的密钥（如测试用），添加到 baseline：

```bash
detect-secrets scan --baseline .secrets.baseline
```

### 运行测试

验证 pre-commit hooks 是否正常工作：

```bash
pre-commit run --all-files
```

---

## ⚠️ 注意事项

1. **不要提交敏感信息** - 使用环境变量或密钥管理工具
2. **定期更新 baseline** - 确保 baseline 不包含新的敏感信息
3. **保持 hooks 更新** - 运行 `pre-commit autoupdate`

---

## 📖 参考资料

- [pre-commit](https://pre-commit.com/)
- [detect-secrets](https://github.com/Yelp/detect-secrets)
- [pre-commit-hooks](https://github.com/pre-commit/pre-commit-hooks)
