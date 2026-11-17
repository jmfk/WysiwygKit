import { afterEach, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import { S3MediaHost } from '../../packages/media-server/src/index'
const s3 = new S3Client({
  endpoint: 'http://127.0.0.1:1',
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
})
const host = new S3MediaHost({
  s3,
  bucket: 'test-bucket',
  namespace: 'test/media',
  receiptKey: Buffer.alloc(32, 1),
  imgproxy: { url: 'http://127.0.0.1:1', key: Buffer.alloc(32, 2), salt: Buffer.alloc(32, 3) },
  publicOrigin: 'http://127.0.0.1:1',
})
afterEach(() => vi.restoreAllMocks())
it('releases the storage response when its declared size fails validation', async () => {
  const bytes = Buffer.from('test')
  const plan = await host.beginUpload({
    size: bytes.length,
    mimeType: 'image/png',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
  const body = Readable.from([bytes])
  vi.spyOn(s3, 'send')
    .mockRejectedValueOnce(
      Object.assign(new Error('Missing'), { $metadata: { httpStatusCode: 404 } }),
    )
    .mockResolvedValueOnce({ Body: body, ContentLength: bytes.length + 1 } as never)
  await expect(host.completeUpload(plan.receipt)).rejects.toMatchObject({
    code: 'UPLOAD_SIZE_MISMATCH',
  })
  expect(body.destroyed).toBe(true)
})
it('rechecks a matching committed original if another finalizer removed staging', async () => {
  const digest = createHash('sha256').update('test').digest('hex')
  const plan = await host.beginUpload({ size: 4, mimeType: 'image/png', sha256: digest })
  const missing = () => Object.assign(new Error('Missing'), { $metadata: { httpStatusCode: 404 } })
  const send = vi
    .spyOn(s3, 'send')
    .mockRejectedValueOnce(missing())
    .mockRejectedValueOnce(missing())
    .mockResolvedValueOnce({ Metadata: { digest, width: '600', height: '400' } } as never)
  const result = await host.completeUpload(plan.receipt)
  expect(result.width).toBe(600)
  expect(send).toHaveBeenCalledTimes(3)
})
it('refuses a conflicting committed original on the staging-miss retry path', async () => {
  const plan = await host.beginUpload({
    size: 4,
    mimeType: 'image/png',
    sha256: createHash('sha256').update('test').digest('hex'),
  })
  const missing = () => Object.assign(new Error('Missing'), { $metadata: { httpStatusCode: 404 } })
  vi.spyOn(s3, 'send')
    .mockRejectedValueOnce(missing())
    .mockRejectedValueOnce(missing())
    .mockResolvedValueOnce({
      Metadata: { digest: '0'.repeat(64), width: '600', height: '400' },
    } as never)
  await expect(host.completeUpload(plan.receipt)).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' })
})
