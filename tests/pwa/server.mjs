import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { extname, resolve, sep } from 'node:path'

// Loopback-only production fixture. Simulate an atomic second deployment with
// changed HTML and its precache revision, without changing source or dist files.
const dist = fileURLToPath(new URL('../../dist/', import.meta.url))
const originalHtml = await readFile(resolve(dist, 'index.html'), 'utf8')
const originalWorker = await readFile(resolve(dist, 'sw.js'), 'utf8')
const nextHtml = originalHtml.replace('<title>', '<meta name="pwa-test-release" content="B" /><title>')
const revision = createHash('md5').update(nextHtml).digest('hex')
const nextWorker = originalWorker.replace(/(url:"index\.html",revision:")[a-f0-9]+/, (_match, prefix) => `${prefix}${revision}`)
if (nextWorker === originalWorker) throw new Error('Could not locate the index.html precache revision.')
let release = 'A'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  response.setHeader('Cache-Control', 'no-store')
  if (pathname === '/__pwa-test__/release' && request.method === 'POST') {
    release = request.headers['x-pwa-release'] === 'B' ? 'B' : 'A'
    response.writeHead(204).end()
    return
  }
  const file = resolve(dist, pathname === '/' ? 'index.html' : `.${decodeURIComponent(pathname)}`)
  if (!file.startsWith(dist.endsWith(sep) ? dist : `${dist}${sep}`)) {
    response.writeHead(403).end()
    return
  }
  try {
    let body
    let type = types[extname(file)] ?? 'application/octet-stream'
    if (pathname === '/sw.js') {
      body = release === 'B' ? nextWorker : originalWorker
    } else if (pathname === '/' || pathname === '/index.html' || !extname(pathname)) {
      body = release === 'B' ? nextHtml : originalHtml
      type = 'text/html'
    } else {
      body = await readFile(file)
    }
    response.writeHead(200, { 'Content-Type': type }).end(body)
  } catch {
    response.writeHead(404).end()
  }
}).listen(4174, '127.0.0.1', () => console.log('Production PWA fixture: http://localhost:4174'))
