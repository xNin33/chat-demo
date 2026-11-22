import { createServer } from 'node:http'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { randomUUID } from 'node:crypto'

const root = path.dirname(fileURLToPath(import.meta.url))
const attachments = path.join(root, 'attachments')
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT || 8090)
await mkdir(attachments, { recursive: true })
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const error = (status, message) => Object.assign(new Error(message), { status })

const server = createServer(async (req, res) => {
  try {
    // 限制 Host 与 Origin，阻止其他网站操作本地文件；开发代理保留原 Origin。
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
    if (!allowedHosts.has(req.headers.host)) throw error(403, 'Invalid host')
    const url = new URL(req.url, `http://${req.headers.host}`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (url.pathname.startsWith('/api/')) {
      const origins = new Set([
        `http://127.0.0.1:${port}`, `http://localhost:${port}`,
        'http://127.0.0.1:8090', 'http://localhost:8090',
      ])
      if ((req.headers.origin && !origins.has(req.headers.origin)) ||
          req.headers['sec-fetch-site'] === 'cross-site') throw error(403, 'Invalid origin')
      const match = /^\/api\/attachments\/([^/]+)$/.exec(url.pathname)
      if (!match || !uuid.test(match[1])) throw error(400, 'Invalid attachment ID')
      const file = path.join(attachments, match[1])
      const meta = `${file}.json`
      res.setHeader('Cache-Control', 'no-store')
      if (req.method === 'PUT') {
        const temporary = `${file}.${randomUUID()}.tmp`
        let bytes = 0
        const limit = new Transform({
          transform(chunk, _encoding, callback) {
            bytes += chunk.length
            callback(bytes > 512 * 1024 * 1024 ? error(413, 'Attachment exceeds 512 MiB') : null, chunk)
          },
        })
        try {
          await pipeline(req, limit, createWriteStream(temporary, { flags: 'wx' }))
          // 每次上传使用全新 UUID，禁止覆盖已有原件。
          await writeFile(meta, JSON.stringify({ type: req.headers['content-type'] || '' }), { flag: 'wx' })
          try {
            await rename(temporary, file)
          } catch (failure) {
            await rm(meta, { force: true })
            throw failure
          }
        } finally {
          await rm(temporary, { force: true })
        }
        res.writeHead(201).end()
        return
      }
      if (req.method === 'DELETE') {
        await rm(file, { force: true })
        await rm(meta, { force: true })
        res.writeHead(204).end()
        return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw error(405, 'Method not allowed')
      const info = await stat(file)
      const metadata = JSON.parse(await readFile(meta, 'utf8'))
      res.setHeader('Content-Type', metadata.type || 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment')
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
      res.setHeader('Content-Length', info.size)
      if (req.method === 'HEAD') res.end()
      else await pipeline(createReadStream(file), res)
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw error(405, 'Method not allowed')
    const pathname = decodeURIComponent(url.pathname)
    const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!file.startsWith(`${dist}${path.sep}`)) throw error(403, 'Invalid path')
    const info = await stat(file)
    if (!info.isFile()) throw error(404, 'Not found')
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
    res.setHeader('Content-Length', info.size)
    res.setHeader('Cache-Control', 'no-cache')
    if (req.method === 'HEAD') res.end()
    else await pipeline(createReadStream(file), res)
  } catch (failure) {
    if (res.headersSent || res.destroyed) {
      res.destroy()
      return
    }
    const status = failure.status || (failure.code === 'ENOENT' ? 404 : failure.code === 'EEXIST' ? 409 : 500)
    if (status === 500) console.error(failure)
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(status === 500 ? 'Local attachment service failed' : status === 404 ? 'Not found' : failure.message)
  }
})
server.listen(port, '127.0.0.1', () => console.log(`Chat: http://127.0.0.1:${port}`))
