# chat-demo

English | [简体中文](README.zh-CN.md)

A local chat app powered by the DeepSeek API. The browser calls DeepSeek directly. A local Node.js service serves the app and stores desktop attachment originals in `attachments/`.

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/xNin33/chat-demo.git
cd chat-demo
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open [the local app](http://127.0.0.1:8090/) and enter your DeepSeek API key in Settings. The service listens on loopback. The build writes to `dist/`. Keep `server.mjs`, `dist/`, and `attachments/` together when moving a desktop installation.

On Windows, double-click [`restart-server.cmd`](restart-server.cmd) after installing dependencies to build and restart the server. If the build fails, the running server is kept. Startup logs are in `tmp/restart-server/`.

## Features

- Search chat history, jump to a matching message, rename chats inline, and select multiple chats to pin or delete. History loads in batches and long chats use a virtualized message list. The desktop conversation rail jumps to prompts and shows the current version and total version count.
- Edit prompts and their attachments to create branches. Switch between versions or regenerate a reply. Stream responses with deep thinking, smart search, link reading, and source citations.
- Add files by selecting, pasting, or dragging them into the composer. Open images in the app, zoom with the wheel, drag to pan, and switch images with the arrow keys. Click a sent file to open it in the side panel. The panel previews up to 256 KiB of text and offers an original-file download for unsupported formats and truncated previews.
- Render Markdown, highlighted code, KaTeX math, and Mermaid diagrams. Scroll wide formulas inside their own blocks. Copy or download code blocks and run HTML in a sandboxed preview.
- Use voice input or read replies aloud. The app supports Simplified Chinese, English, light and dark themes, and mobile layouts.

## Data and storage

Desktop browsers with a directory picker offer to choose a chat history folder on the first visit to the production app. Chat changes automatically update a `chat-demo-history-*.zip` archive in that folder. You can restore it using the history import in Settings. Choose browser storage to skip setup, or select a folder later under Settings → Data management. The production app stores chats and new attachments in the browser on mobile. Development mode continues to use IndexedDB and the project's `attachments/` directory.

Your API key and settings are stored in localStorage. Conversations and attachment references remain in IndexedDB. On desktop, original attachments are stored on disk under UUIDs, with original filenames in conversation metadata. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

On initialization, existing attachment Blobs are migrated individually, removing each Blob only after its disk write succeeds. Keep the original browser profile and origin, including hostname and port, for migration. `localhost` and `127.0.0.1` are different origins. For data from another site or `file://`, export a ZIP using the old version and import it here. Failed migrations retain the remaining Blobs and show the initialization retry UI.

Deletion and history replacement clean up only removed disk references belonging to the current browser. Cleanup failures are reported in the console and may leave unused files on disk; they do not undo committed conversation changes.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and settings are preserved; files already uploaded to the API service are not deleted.

## Troubleshooting

- If attachment upload returns **HTTP 402**, check the DeepSeek API account balance, top up, and then retry from the attachment card. See [DeepSeek API error codes](https://api-docs.deepseek.com/quick_start/error_codes/).
- If the app cannot read or save attachment originals, make sure the local service is running. In development, start both processes below.

## Development

In separate terminals, run `pnpm server:dev` and `pnpm dev`, then open [the development app](http://localhost:8090/). Rspack proxies local attachment requests to port 8091.

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Start the Rspack frontend on port 8090                |
| `pnpm server:dev` | Start the development attachment service on port 8091 |
| `pnpm start`      | Serve the build and local attachments on port 8090    |
| `pnpm build`      | Build into `dist/`                                    |
| `pnpm type`       | Run TypeScript type checks                            |
| `pnpm lint`       | Lint with oxlint                                      |
| `pnpm format`     | Format with oxfmt                                     |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default through the Anthropic-compatible Messages and Files APIs. Speech uses the ASR and TTS endpoints. A custom API service needs to support the search, link reading, titles, and `latest_reminder` extensions. Attachment formats and sizes are subject to validation by the app and the API.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
