// Redacted provider acceptance: no configuration, URLs, receipts or provider response text is logged.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { mediaHostFromEnvironment, signImgproxy } from '../../packages/media-server/dist/index.js'
try {
  const { host, options } = mediaHostFromEnvironment(),
    bytes = await readFile('tests/fixtures/pixel.png'),
    plan = await host.beginUpload({
      size: bytes.length,
      mimeType: 'image/png',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  const put = await fetch(plan.url, { method: 'PUT', headers: plan.headers, body: bytes })
  console.log({ uploadStatus: put.status })
  if (put.ok) {
    const asset = await host.completeUpload(plan.receipt),
      response = await fetch(
        signImgproxy(
          `s3://${options.bucket}/${options.namespace}/originals/${asset.id}/1`,
          { width: 100, height: 100, fit: 'cover', format: 'png' },
          options.imgproxy,
        ),
      ),
      body = (await response.text()).toLowerCase()
    console.log({
      imageStatus: response.status,
      knownErrorWords: [
        'disabled',
        'support',
        'invalid',
        'bucket',
        'found',
        'region',
        'unsupported',
        'empty',
        'scheme',
        'storage',
        'configure',
        'access',
        'credentials',
        'authorization',
        'transport',
        'request',
        'failed',
        'parse',
        'download',
        'enabled',
        'format',
        'provider',
        'keys',
        'header',
        'retrieve',
      ].filter((word) => body.includes(word)),
    })
  }
} catch (error) {
  console.log({
    providerAcceptance: 'failed',
    code: ['NoSuchKey', 'AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch'].includes(
      error.name,
    )
      ? error.name
      : 'operation-failed',
  })
  process.exitCode = 1
}
