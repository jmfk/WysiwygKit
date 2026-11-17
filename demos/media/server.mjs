import { createServer } from 'node:http'
import { mediaHostFromEnvironment, MediaError } from '../../packages/media-server/dist/index.js'
const { host } = mediaHostFromEnvironment()
const allowedHosts = new Set([
  '127.0.0.1:13700',
  'localhost:13700',
  '127.0.0.1:13701',
  'localhost:13701',
])
const allowedOrigins = new Set(['http://127.0.0.1:13700', 'http://localhost:13700'])
const json = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}
let busy = 0
const waiting = []
async function imageOperation(action) {
  if (busy >= 2) {
    if (waiting.length >= 8)
      throw new MediaError('BUSY', 'The image queue is full. Retry shortly.', 503)
    await new Promise((resolve) => waiting.push(resolve))
  } else busy++
  try {
    return await action()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else busy--
  }
}
export const server = createServer(async (request, response) => {
  try {
    if (
      !allowedHosts.has(request.headers.host) ||
      (request.headers.origin && !allowedOrigins.has(request.headers.origin))
    )
      throw new MediaError(
        'ORIGIN_REJECTED',
        'This loopback demo does not accept this origin.',
        403,
      )
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    if (request.method === 'GET' && path === '/health') {
      json(response, 200, { ready: true })
      return
    }
    if (
      request.method === 'GET' &&
      (path.startsWith('/api/media/preview/') || path.startsWith('/media/published/'))
    ) {
      const parts = path.split('/')
      const result = await imageOperation(() =>
        path.startsWith('/api/')
          ? host.previewBytes(parts[4])
          : host.publicBytes(parts[3], Number(parts[4]?.replace(/\.webp$/, ''))),
      )
      response.writeHead(200, {
        'content-type': result.mimeType,
        'cache-control': path.startsWith('/api/')
          ? 'private, no-store'
          : 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
      response.end(result.bytes)
      return
    }
    // Demo-only browser intent header: not a production user authentication system.
    if (
      request.method !== 'POST' ||
      request.headers['x-wysiwyg-demo'] !== '1' ||
      request.headers['content-type'] !== 'application/json'
    )
      throw new MediaError('DEMO_INTENT_REQUIRED', 'Use the supplied loopback demo client.', 403)
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (Buffer.byteLength(body) > 8192)
        throw new MediaError('REQUEST_TOO_LARGE', 'The request exceeds its metadata limit.', 413)
    }
    let input
    try {
      input = JSON.parse(body)
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Invalid metadata')
    } catch {
      throw new MediaError('INVALID_JSON', 'Invalid request metadata.')
    }
    let result
    if (path === '/api/media/uploads') result = await host.beginUpload(input)
    else if (path === '/api/media/complete')
      result = await imageOperation(() => host.completeUpload(input.receipt))
    else if (path === '/api/media/resolve')
      result = await host.preview(input.id, input.version, input.variant)
    else if (path === '/api/media/publish') {
      const publication = await host.publish(input.id, input.version, input)
      result = {
        ...publication,
        variants: host.publicationVariants(publication),
      }
    } else throw new MediaError('NOT_FOUND', 'Unknown media operation.', 404)
    json(response, 200, result)
  } catch (error) {
    const known = error instanceof MediaError
    json(response, known ? error.status : 503, {
      code: known ? error.code : 'MEDIA_UNAVAILABLE',
      message: known ? error.message : 'The configured media provider is unavailable.',
    })
  }
})
server.listen(13701, '127.0.0.1', () =>
  console.log('Media demo ready on http://127.0.0.1:13701 (loopback only).'),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
