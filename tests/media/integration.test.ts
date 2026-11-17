import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { randomBytes } from 'node:crypto'
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import sharp from 'sharp'
import {
  mediaHostFromEnvironment,
  S3MediaHost,
  signImgproxy,
  type Variant,
} from '../../packages/media-server/src/index'
import { focalCover } from '../../packages/core/src/media'
const { host, options } = mediaHostFromEnvironment()
let fixture: Buffer, asset: Awaited<ReturnType<typeof host.completeUpload>>
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
async function upload(bytes: Buffer, mimeType = 'image/png') {
  const plan = await host.beginUpload({ size: bytes.length, mimeType, sha256: digest(bytes) }),
    response = await fetch(plan.url, {
      method: 'PUT',
      headers: plan.headers,
      body: bytes as unknown as BodyInit,
    })
  expect(response.ok).toBe(true)
  return { plan, asset: await host.completeUpload(plan.receipt) }
}
const code = async (action: () => Promise<unknown>) => {
  try {
    await action()
    return 'accepted'
  } catch (e) {
    return (e as { code?: string }).code ?? 'provider-rejected'
  }
}
beforeAll(async () => {
  const pixels = Buffer.alloc(600 * 400 * 3)
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 600; x++) {
      const i = (y * 600 + x) * 3
      pixels[i] = x < 200 ? 220 : 20
      pixels[i + 1] = x >= 200 && x < 400 ? 220 : 20
      pixels[i + 2] = x >= 400 ? 220 : 20
      if (y < 40) pixels[i + 1] = 100
    }
  fixture = await sharp(pixels, { raw: { width: 600, height: 400, channels: 3 } })
    .png()
    .toBuffer()
  asset = (await upload(fixture)).asset
})
describe('real S3-compatible immutable upload', () => {
  it('validates bytes, dimensions, digest and retry after host restart', async () => {
    const { plan, asset } = await upload(fixture)
    expect(asset.width).toBe(600)
    expect(asset.height).toBe(400)
    const restarted = new S3MediaHost(options)
    expect((await restarted.completeUpload(plan.receipt)).id).toBe(asset.id)
    expect(asset.uri.startsWith('asset:')).toBe(true)
  })
  it('preserves the finalized original when a reusable staging grant is replayed', async () => {
    const { plan, asset } = await upload(fixture)
    expect(
      (
        await fetch(plan.url, {
          method: 'PUT',
          headers: plan.headers,
          body: fixture as unknown as BodyInit,
        })
      ).ok,
    ).toBe(true)
    const retried = await host.completeUpload(plan.receipt)
    expect(retried.id).toBe(asset.id)
    const bytes = await options.s3.send(
      new GetObjectCommand({
        Bucket: options.bucket,
        Key: `${options.namespace}/originals/${asset.id}/1`,
      }),
    )
    expect(digest(Buffer.from(await bytes.Body!.transformToByteArray())) === digest(fixture)).toBe(
      true,
    )
  })
  it('rejects mutated receipts and valid receipts from another namespace', async () => {
    const plan = await host.beginUpload({
      size: fixture.length,
      mimeType: 'image/png',
      sha256: digest(fixture),
    })
    expect(await code(() => host.completeUpload(plan.receipt.slice(0, -8) + 'tampered'))).toBe(
      'INVALID_RECEIPT',
    )
    expect(
      await code(() =>
        new S3MediaHost({ ...options, namespace: options.namespace + '-other' }).completeUpload(
          plan.receipt,
        ),
      ),
    ).toBe('EXPIRED_OR_FOREIGN_RECEIPT')
  })
  it('rejects size/type limits and invalid image bytes after storage accepts their checksum', async () => {
    expect(
      await code(() =>
        host.beginUpload({ size: 4_000_001, mimeType: 'image/png', sha256: digest(fixture) }),
      ),
    ).toBe('INVALID_UPLOAD')
    const bad = Buffer.from('<svg><script>bad</script></svg>'),
      plan = await host.beginUpload({
        size: bad.length,
        mimeType: 'image/png',
        sha256: digest(bad),
      })
    expect(
      (
        await fetch(plan.url, {
          method: 'PUT',
          headers: plan.headers,
          body: bad as unknown as BodyInit,
        })
      ).ok,
    ).toBe(true)
    expect(await code(() => host.completeUpload(plan.receipt))).toBe('INVALID_IMAGE')
  })
  it('binds the checksum to the actual captured staging bytes', async () => {
    const plan = await host.beginUpload({
      size: fixture.length,
      mimeType: 'image/png',
      sha256: digest(fixture),
    })
    const decoded = JSON.parse(Buffer.from(plan.receipt.split('.')[0], 'base64url').toString()) as {
      id: string
    }
    await options.s3.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: `${options.namespace}/staging/${decoded.id}`,
        Body: Buffer.alloc(fixture.length, 7),
        ContentType: 'image/png',
      }),
    )
    expect(await code(() => host.completeUpload(plan.receipt))).toBe('UPLOAD_DIGEST_MISMATCH')
  })
  it('has no normal-runtime delete permission on immutable originals', async () => {
    let denied = false
    try {
      await options.s3.send(
        new DeleteObjectCommand({
          Bucket: options.bucket,
          Key: `${options.namespace}/originals/${asset.id}/1`,
        }),
      )
    } catch (e) {
      denied = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 403
    }
    expect(denied).toBe(true)
  })
})
describe('real pinned OSS imgproxy', () => {
  it('bounds an automatic-height rendition for a tall original', async () => {
    const bytes = await sharp({
      create: { width: 100, height: 1000, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer()
    const tall = (await upload(bytes)).asset
    const delivery = await host.preview(tall.id, '1', { width: 960 })
    const result = await host.previewBytes(new URL(delivery.url).pathname.split('/').pop()!)
    const meta = await sharp(result.bytes).metadata()
    expect(meta.height).toBe(2048)
    expect(meta.width).toBe(delivery.width)
    expect(meta.height).toBe(delivery.height)
  })
  it('uses signed S3 sources and refuses a modified transform signature', async () => {
    const url = signImgproxy(
      `s3://${options.bucket}/${options.namespace}/originals/${asset.id}/1`,
      { width: 160, height: 160, fit: 'cover', focus: { x: 0.5, y: 0.5 }, format: 'png' },
      options.imgproxy,
    )
    expect((await fetch(url)).ok).toBe(true)
    expect((await fetch(url.replace('/rs:fill:160', '/rs:fill:161'))).ok).toBe(false)
  })
  it.each([
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 },
    { x: 0.1, y: 0.9 },
  ])('matches focal-cover geometry at %j', async (focus) => {
    const variant: Variant = { width: 160, height: 160, fit: 'cover', focus, format: 'png' },
      delivery = await host.preview(asset.id, asset.version, variant),
      token = new URL(delivery.url).pathname.split('/').pop()!,
      rendered = await host.previewBytes(token),
      actual = await sharp(rendered.bytes)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      geometry = focalCover(600, 400, 160, 160, focus)
    const reference = await sharp(fixture)
      .resize(Math.round(geometry.width), Math.round(geometry.height))
      .extract({
        left: Math.round(-geometry.left),
        top: Math.round(-geometry.top),
        width: 160,
        height: 160,
      })
      .removeAlpha()
      .raw()
      .toBuffer()
    expect(actual.info.width).toBe(160)
    expect(actual.info.height).toBe(160)
    let delta = 0
    for (let i = 0; i < reference.length; i++) delta += Math.abs(reference[i] - actual.data[i])
    expect(delta / reference.length).toBeLessThan(2)
  })
  it('interprets dimensions and focal axes after EXIF orientation', async () => {
    const jpeg = await sharp(fixture).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
      oriented = (await upload(jpeg, 'image/jpeg')).asset
    expect(oriented.width).toBe(400)
    expect(oriented.height).toBe(600)
    const delivery = await host.preview(oriented.id, '1', {
        width: 80,
        height: 120,
        fit: 'contain',
        format: 'png',
      }),
      result = await host.previewBytes(new URL(delivery.url).pathname.split('/').pop()!)
    const meta = await sharp(result.bytes).metadata()
    expect(meta.width).toBe(80)
    expect(meta.height).toBe(120)
  })
  it('expires private previews without changing the durable asset reference', async () => {
    let now = Date.now()
    const timed = new S3MediaHost({ ...options, now: () => now, previewTTL: 1 }),
      delivery = await timed.preview(asset.id, '1', { width: 160 })
    now += 2000
    expect(
      await code(() => timed.previewBytes(new URL(delivery.url).pathname.split('/').pop()!)),
    ).toBe('EXPIRED_OR_FOREIGN_RECEIPT')
    const refreshed = await timed.preview(asset.id, '1', { width: 160 })
    expect(refreshed.url === delivery.url).toBe(false)
    expect((await timed.asset(asset.id, '1')).uri).toBe(asset.uri)
  })
  it('requires explicit publication and preserves public delivery across signing-key rotation', async () => {
    expect(await code(() => host.publicBytes('0'.repeat(64), 320))).toBe('PUBLICATION_NOT_FOUND')
    const publication = await host.publish(asset.id, '1', {
        focus: { x: 0.1, y: 0.7 },
        aspectRatio: 1,
      }),
      result = await host.publicBytes(publication.id, 320)
    expect(result.mimeType.startsWith('image/')).toBe(true)
    const restarted = new S3MediaHost(options)
    expect((await restarted.publicBytes(publication.id, 640)).bytes.length > 0).toBe(true)
    const rotated = new S3MediaHost({
      ...options,
      imgproxy: { ...options.imgproxy, key: randomBytes(32), salt: randomBytes(32) },
    })
    expect(rotated.publicURL(publication.id, 320) === host.publicURL(publication.id, 320)).toBe(
      true,
    )
    expect(host.publicURL(publication.id, 320).includes('/preview/')).toBe(false)
    expect(await code(() => host.publicBytes(publication.id, 321))).toBe('INVALID_PUBLICATION')
  })
  it('keeps image-server credentials read-only and scoped to originals', async () => {
    const reader = new S3Client({
      endpoint: process.env.MEDIA_S3_ENDPOINT,
      region: process.env.MEDIA_S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    let denied = false
    try {
      await reader.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: `${options.namespace}/originals/forbidden/1`,
          Body: fixture,
        }),
      )
    } catch (e) {
      denied = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 403
    } finally {
      reader.destroy()
    }
    expect(denied).toBe(true)
  })
})
