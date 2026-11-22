# chat-demo

[English](README.md) | 简体中文

基于 DeepSeek API 的本地聊天应用。浏览器直接请求 DeepSeek API。Node.js 本地服务托管前端，并将桌面端的附件原件保存在 `attachments/`。

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/xNin33/chat-demo.git
cd chat-demo
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

打开[本地应用](http://127.0.0.1:8090/)，在设置中填写 DeepSeek API Key。服务默认只监听本机，构建产物位于 `dist/`。迁移桌面安装时，请一并保留 `server.mjs`、`dist/` 和 `attachments/`。

Windows 上，安装依赖后双击 [`restart-server.cmd`](restart-server.cmd) 即可构建并重启服务器。构建失败时会保留当前服务进程，启动日志位于 `tmp/restart-server/`。

## 功能

- 搜索聊天记录并定位到匹配的消息，在会话内直接重命名，也可多选会话批量置顶或删除。侧栏分批显示会话，长对话使用虚拟列表。桌面端对话导轨支持直接跳转到提问，并显示「当前版本/总版本数」。
- 编辑提问及其附件以创建分支，可在不同版本间切换，也可重新生成回复。支持流式回复、深度思考、智能搜索、链接阅读和来源引用。
- 可选择、粘贴或拖拽添加附件。图片在应用内打开，支持滚轮缩放、拖拽平移和方向键切换。点击已发文件可打开侧栏预览，文本最多显示 256 KiB，预览不完整或格式不支持时可下载原件。
- 渲染 Markdown、代码高亮、KaTeX 公式和 Mermaid 图表。宽公式可在块内横向滚动。代码块支持复制和下载，HTML 可在沙箱内预览。
- 支持语音输入、回复朗读、简体中文与英文、浅色与深色主题，以及移动端布局。

## 数据

支持目录选择的桌面浏览器在首次打开正式版时会提示选择聊天记录目录。启用后，会话变更会自动更新该目录中的 `chat-demo-history-*.zip`，可通过设置中的历史导入恢复。选择「使用浏览器存储」可跳过，之后可在「设置 → 数据管理」重新选择。手机正式版将新附件和会话保存在浏览器中。开发模式继续使用 IndexedDB 和项目的 `attachments/` 目录。

API Key 和设置保存在浏览器 localStorage。会话和附件引用保存在 IndexedDB，桌面端的附件原件保存在 `attachments/`。磁盘文件使用内部 UUID 命名，原始文件名保留在会话元数据中。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

首次初始化会逐个迁移当前 origin 的旧附件，写盘成功后才移除旧 Blob；失败时显示初始化错误，可启动服务后重试。旧记录按浏览器用户配置、协议、域名和端口隔离：迁移时沿用原网址（例如始终使用 `localhost:8090`），不要换成 `127.0.0.1:8090`。其他站点或 `file://` 的记录先从旧版导出 ZIP，再在新版导入。

备份时需同时备份浏览器会话数据与 `attachments/`。仅拷贝附件目录不会恢复聊天记录。删除会话只清理本浏览器中已无引用的原件；清空历史和导入成功后清理被替换的原件，清理失败会在控制台报告并留下磁盘文件，不撤销已提交的会话操作。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 常见问题

- 上传附件返回 **HTTP 402** 时，请检查 DeepSeek API 账户余额。补足余额后，在附件卡片上重试。[DeepSeek API 错误码](https://api-docs.deepseek.com/zh-cn/quick_start/error_codes/)
- 附件原件无法读取或保存时，请确认本地服务正在运行。开发模式需要启动下方两个进程。

## 开发

在两个终端分别运行 `pnpm server:dev` 和 `pnpm dev`，然后打开[开发页面](http://localhost:8090/)。Rspack 会将本地附件请求代理到 8091 端口。

| 命令              | 用途                               |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | 启动 Rspack 前端开发服务器（8090） |
| `pnpm server:dev` | 启动开发附件服务（8091）           |
| `pnpm start`      | 托管 dist 并提供附件服务（8090）   |
| `pnpm build`      | 构建到 `dist/`                     |
| `pnpm type`       | TypeScript 类型检查                |
| `pnpm lint`       | oxlint 检查                        |
| `pnpm format`     | oxfmt 格式化                       |

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理。

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages 和 Files API 通信。语音使用 ASR 和 TTS 接口。自定义 API 服务需支持搜索、链接阅读、标题和 `latest_reminder` 等扩展。附件格式和大小受应用及 API 校验限制。

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
