# 1.2.1：补回 cwd 对话兼容修复

1.2.0 分支基于原镜像继续开发，未包含先前维护版的 cwd 变量兼容补丁。其 `rewritePromptAssembly()` 仍会插入 `Your working directory is {{cwd}}.`，但 DeepSeek Harness Desktop 0.2.1-rc.3 的 agent-loop 只注册了 `provider` 和 `model`，因此在调用模型前报错：

```text
unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"; registered variables: provider, model
```

1.2.1 在组装结果中补充缺失的 `cwd`：从当前会话的 `session.header.cwd` 读取，宿主或作用域已有变量值优先，无目录会话使用空字符串。输入对象保持不变，不使用进程工作目录代替会话目录。

## 验证

```sh
npm test
```

8 项无需依赖或 API 密钥的回归测试覆盖当前会话取值、多个会话、中文路径、已有宿主值、空值、无目录、冻结输入、重复组装和保留其他变量。Windows/Linux 的 Node.js 18/22/24 CI 会执行这些测试。

使用可信的本机宿主代码，直接验证其真实渲染函数：

```sh
node scripts/verify-host-prompt.mjs "完整路径/resources/app/dsh/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js"
```

密封安装可改传 `resources/app.asar`；保留了原归档的解包安装也可传 `resources/app.asar.bak`。验证脚本仅读取宿主，不执行插件的启动、补丁应用、还原或自动重启操作。

已在 Windows 上使用 0.2.1-rc.3 当前解包宿主和原始 ASAR 备份验证：旧代码复现报错，新代码成功渲染，其他未知变量仍正常报错。本变更不重新验证 1.2.0 的其余补丁和自动开关功能。

## 升级

安装包含此提交的 1.2.1 后完全退出并重新打开 DeepSeek Harness，确保旧模块缓存被释放。使用带具体提交哈希的下载地址锁定依赖，可以避免固定的 master 归档地址及旧 lockfile 缓存继续安装 1.2.0。

## 来源

原作者为 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)，保留原 LICENSE、署名和历史。1.2.1 在现有 [alen123222/dsh-purge](https://github.com/alen123222/dsh-purge) 的 1.2.0 分支上补回兼容修复；回归用例来自先前的 [cwd 维护版](https://github.com/alen123222/dsh-purge-cwd-fix)。
