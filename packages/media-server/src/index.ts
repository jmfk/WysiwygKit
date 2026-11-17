/** Server-only integration. Call these methods only after host authorization. Never bundle this entry in a client. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import type { Asset, Point } from '@wysiwygkit/core'

export class MediaError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'MediaError'
  }
}
import type { Variant, UploadPlan, Delivery, Publication } from '@wysiwygkit/media'
export type { Variant, UploadPlan, Delivery, Publication } from '@wysiwygkit/media'
export type MediaHostOptions = {
  s3: S3Client
  bucket: string
  namespace: string
  receiptKey: Uint8Array
  imgproxy: { url: string; key: Uint8Array; salt: Uint8Array }
  publicOrigin: string
  now?: () => number
  previewTTL?: number
}
type Receipt = {
  v: 1
  kind: 'upload' | 'preview'
  namespace: string
  exp: number
  id: string
  version: string
  size?: number
  mime?: string
  digest?: string
  variant?: Variant
}
const allowedTypes: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const isMissing = (e: unknown) =>
  (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404
const isConflict = (e: unknown) =>
  [409, 412].includes(
    (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode ?? 0,
  )
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
function identity(id: string, version: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || version !== '1')
    throw new MediaError('INVALID_ASSET', 'Invalid asset reference.')
}
export function validateVariant(input: Variant): Required<Variant> {
  const {
    width,
    height = 0,
    fit = height ? 'cover' : 'contain',
    focus = { x: 0.5, y: 0.5 },
    format = 'webp',
  } = input ?? {}
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    width > 2048 ||
    !Number.isInteger(height) ||
    height < 0 ||
    height > 2048 ||
    !['contain', 'cover'].includes(fit) ||
    !['png', 'webp', 'jpeg'].includes(format) ||
    !focus ||
    typeof focus !== 'object' ||
    [focus.x, focus.y].some((n) => !Number.isFinite(n) || n < 0 || n > 1) ||
    (fit === 'cover' && !height)
  )
    throw new MediaError('INVALID_VARIANT', 'Unsupported image dimensions, crop or format.')
  return {
    width,
    height,
    fit,
    focus: { x: Math.round(focus.x * 10000) / 10000, y: Math.round(focus.y * 10000) / 10000 },
    format,
  }
}
function renditionSize(asset: Pick<Asset, 'width' | 'height'>, variant: Required<Variant>) {
  const scale = Math.min(variant.width / asset.width, (variant.height || 2048) / asset.height)
  return {
    width: variant.fit === 'cover' ? variant.width : Math.max(1, Math.round(asset.width * scale)),
    height:
      variant.fit === 'cover' ? variant.height : Math.max(1, Math.round(asset.height * scale)),
  }
}
function publicationVariant(publication: Publication, width: number): Required<Variant> {
  return validateVariant({
    width,
    height: publication.aspectRatio ? Math.round(width / publication.aspectRatio) : undefined,
    fit: publication.aspectRatio ? 'cover' : 'contain',
    focus: publication.focus,
    format: 'webp',
  })
}
// Some decoders expose only the default PNG frame. Inspect chunk boundaries rather than image payload text.
function animatedPNG(bytes: Buffer) {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset),
      end = offset + 12 + length
    if (end > bytes.length) break
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (type === 'acTL') return true
    if (type === 'IEND') break
    offset = end
  }
  return false
}
/** The caller supplies an authorized, server-derived source. This never accepts a browser URL. */
export function signImgproxy(
  source: string,
  variant: Variant,
  config: MediaHostOptions['imgproxy'],
): string {
  const v = validateVariant(variant)
  if (!source.startsWith('s3://') || config.key.length < 32 || config.salt.length < 16)
    throw new MediaError(
      'INVALID_SIGNING_CONFIG',
      'An authorized S3 source and signing configuration are required.',
      500,
    )
  const path = `/rs:${v.fit === 'cover' ? 'fill' : 'fit'}:${v.width}:${v.height || 2048}:1/g:fp:${v.focus.x}:${v.focus.y}/${Buffer.from(source).toString('base64url')}.${v.format}`
  const signature = createHmac('sha256', config.key)
    .update(config.salt)
    .update(path)
    .digest('base64url')
  return new URL(`/${signature}${path}`, config.url).href
}
export class S3MediaHost {
  private options: MediaHostOptions
  constructor(options: MediaHostOptions) {
    if (
      !/^[a-z0-9][a-z0-9/-]{2,100}$/.test(options.namespace) ||
      options.namespace.includes('..') ||
      options.namespace.endsWith('/') ||
      options.receiptKey.length < 32 ||
      (options.previewTTL !== undefined &&
        (!Number.isInteger(options.previewTTL) ||
          options.previewTTL < 1 ||
          options.previewTTL > 300))
    )
      throw new MediaError('INVALID_CONFIG', 'Invalid media namespace or receipt key.', 500)
    for (const origin of [options.publicOrigin, options.imgproxy.url]) {
      const u = new URL(origin)
      if (
        u.protocol !== 'https:' &&
        !(u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))
      )
        throw new MediaError(
          'INVALID_CONFIG',
          'HTTPS or an explicit loopback endpoint is required.',
          500,
        )
    }
    this.options = options
  }
  private now() {
    return Math.floor((this.options.now?.() ?? Date.now()) / 1000)
  }
  private key(id: string, version: string) {
    identity(id, version)
    return `${this.options.namespace}/originals/${id}/${version}`
  }
  private encode(value: Receipt) {
    const data = Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${data}.${createHmac('sha256', this.options.receiptKey).update(data).digest('base64url')}`
  }
  private decode(token: string, kind: Receipt['kind']): Receipt {
    if (typeof token !== 'string' || token.length > 4096)
      throw new MediaError('INVALID_RECEIPT', 'Invalid media capability.', 403)
    const [data, signature, ...extra] = token.split('.')
    const expected = createHmac('sha256', this.options.receiptKey)
      .update(data ?? '')
      .digest()
    const actual = Buffer.from(signature ?? '', 'base64url')
    if (extra.length || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new MediaError('INVALID_RECEIPT', 'Invalid media capability.', 403)
    let value: Receipt
    try {
      value = JSON.parse(Buffer.from(data, 'base64url').toString())
    } catch {
      throw new MediaError('INVALID_RECEIPT', 'Invalid media capability.', 403)
    }
    if (
      value.v !== 1 ||
      value.kind !== kind ||
      value.namespace !== this.options.namespace ||
      !Number.isSafeInteger(value.exp) ||
      value.exp <= this.now()
    )
      throw new MediaError(
        'EXPIRED_OR_FOREIGN_RECEIPT',
        'Expired or foreign media capability.',
        403,
      )
    identity(value.id, value.version)
    return value
  }
  async beginUpload(input: {
    size: number
    mimeType: string
    sha256: string
  }): Promise<UploadPlan> {
    if (
      !Number.isSafeInteger(input.size) ||
      input.size < 1 ||
      input.size > 4_000_000 ||
      !Object.values(allowedTypes).includes(input.mimeType) ||
      !/^[a-f0-9]{64}$/.test(input.sha256)
    )
      throw new MediaError(
        'INVALID_UPLOAD',
        'Choose a JPEG, PNG or still WebP image smaller than 4 MB, with a SHA-256 digest.',
      )
    const receipt: Receipt = {
      v: 1,
      kind: 'upload',
      namespace: this.options.namespace,
      id: randomUUID(),
      version: '1',
      exp: this.now() + 300,
      size: input.size,
      mime: input.mimeType,
      digest: input.sha256,
    }
    const checksum = Buffer.from(input.sha256, 'hex').toString('base64'),
      command = new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: `${this.options.namespace}/staging/${receipt.id}`,
        ContentType: input.mimeType,
        ChecksumSHA256: checksum,
      })
    const url = await getSignedUrl(this.options.s3, command, {
      expiresIn: 300,
      signableHeaders: new Set(['content-type']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    })
    return {
      url,
      headers: { 'Content-Type': input.mimeType, 'x-amz-checksum-sha256': checksum },
      receipt: this.encode(receipt),
      expiresAt: receipt.exp * 1000,
    }
  }
  private fromHead(
    id: string,
    version: string,
    head: { Metadata?: Record<string, string>; ContentLength?: number },
  ): Asset {
    const meta = head.Metadata ?? {},
      width = Number(meta.width),
      height = Number(meta.height)
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      !/^[a-f0-9]{64}$/.test(meta.digest ?? '')
    )
      throw new MediaError(
        'INVALID_STORED_ASSET',
        'The stored original is missing verified metadata.',
        409,
      )
    return { id, version, width, height, uri: `asset:${id}@${version}` }
  }
  async asset(id: string, version: string): Promise<Asset> {
    try {
      return this.fromHead(
        id,
        version,
        await this.options.s3.send(
          new HeadObjectCommand({ Bucket: this.options.bucket, Key: this.key(id, version) }),
        ),
      )
    } catch (e) {
      if (e instanceof MediaError) throw e
      if (isMissing(e)) throw new MediaError('ASSET_NOT_FOUND', 'The original is unavailable.', 404)
      throw new MediaError('STORAGE_UNAVAILABLE', 'Object storage is unavailable.', 503)
    }
  }
  private async finalized(receipt: Receipt): Promise<Asset> {
    const head = await this.options.s3.send(
      new HeadObjectCommand({
        Bucket: this.options.bucket,
        Key: this.key(receipt.id, receipt.version),
      }),
    )
    if (head.Metadata?.digest !== receipt.digest)
      throw new MediaError('UPLOAD_CONFLICT', 'An incompatible original already exists.', 409)
    return this.fromHead(receipt.id, receipt.version, head)
  }
  async completeUpload(token: string): Promise<Asset> {
    const receipt = this.decode(token, 'upload'),
      key = this.key(receipt.id, receipt.version),
      params = { Bucket: this.options.bucket, Key: key }
    try {
      return await this.finalized(receipt)
    } catch (e) {
      if (!isMissing(e)) throw e
    }
    const stage = `${this.options.namespace}/staging/${receipt.id}`
    let response
    try {
      response = await this.options.s3.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: stage }),
      )
    } catch (e) {
      // Another finalizer may commit and remove staging after our initial HEAD miss.
      if (isMissing(e)) return this.finalized(receipt)
      throw e
    }
    const body = response.Body as
      | (AsyncIterable<Uint8Array> & { destroy?: () => void; cancel?: () => Promise<void> })
      | undefined
    let size = 0,
      bytes: Buffer
    try {
      if (!body || response.ContentLength !== receipt.size)
        throw new MediaError('UPLOAD_SIZE_MISMATCH', 'The uploaded size does not match its plan.')
      const chunks: Buffer[] = []
      for await (const part of body) {
        size += part.length
        if (size > 4_000_000)
          throw new MediaError('UPLOAD_TOO_LARGE', 'The uploaded image exceeds the limit.')
        chunks.push(Buffer.from(part))
      }
      bytes = Buffer.concat(chunks)
    } finally {
      // An early validation rejection must release the HTTP connection, including an unread body.
      if (body?.destroy) body.destroy()
      else await body?.cancel?.().catch(() => undefined)
    }
    if (size !== receipt.size || sha(bytes) !== receipt.digest)
      throw new MediaError(
        'UPLOAD_DIGEST_MISMATCH',
        'The uploaded bytes do not match the upload plan.',
      )
    let width: number, height: number, mime: string
    try {
      const metadata = await sharp(bytes, {
        limitInputPixels: 32_000_000,
        failOn: 'warning',
      }).metadata()
      mime = allowedTypes[metadata.format ?? '']
      if (
        !mime ||
        mime !== receipt.mime ||
        (metadata.pages ?? 1) > 1 ||
        (metadata.format === 'png' && animatedPNG(bytes))
      )
        throw new Error('Unsupported image')
      const decoded = await sharp(bytes, { limitInputPixels: 32_000_000, failOn: 'warning' })
        .rotate()
        .raw()
        .toBuffer({ resolveWithObject: true })
      width = decoded.info.width
      height = decoded.info.height
    } catch {
      throw new MediaError(
        'INVALID_IMAGE',
        'The uploaded file is not a valid supported still image.',
      )
    }
    const metadata = { width: String(width), height: String(height), digest: receipt.digest!, mime }
    try {
      await this.options.s3.send(
        new PutObjectCommand({
          ...params,
          Body: bytes,
          ContentType: mime,
          ContentLength: bytes.length,
          Metadata: metadata,
          ChecksumSHA256: Buffer.from(receipt.digest!, 'hex').toString('base64'),
          IfNoneMatch: '*',
        }),
      )
    } catch (e) {
      if (!isConflict(e)) throw e
      return this.finalized(receipt)
    }
    // Cleanup is restricted to this receipt's staging object. A live PUT grant may recreate it until expiry.
    await this.options.s3
      .send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: stage }))
      .catch(() => undefined)
    return {
      id: receipt.id,
      version: receipt.version,
      width,
      height,
      uri: `asset:${receipt.id}@${receipt.version}`,
    }
  }
  async preview(id: string, version: string, request: Variant): Promise<Delivery> {
    const asset = await this.asset(id, version),
      variant = validateVariant(request),
      exp = this.now() + (this.options.previewTTL ?? 60)
    const token = this.encode({
      v: 1,
      kind: 'preview',
      namespace: this.options.namespace,
      id,
      version,
      exp,
      variant,
    })
    const { width, height } = renditionSize(asset, variant)
    return {
      url: new URL(`/api/media/preview/${token}`, this.options.publicOrigin).href,
      expiresAt: exp * 1000,
      width,
      height,
    }
  }
  async previewBytes(token: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
    const receipt = this.decode(token, 'preview')
    await this.asset(receipt.id, receipt.version)
    return this.render(receipt.id, receipt.version, receipt.variant!)
  }
  private async render(id: string, version: string, variant: Variant) {
    const url = signImgproxy(
      `s3://${this.options.bucket}/${this.key(id, version)}`,
      variant,
      this.options.imgproxy,
    )
    let response: Response
    try {
      response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
    } catch {
      throw new MediaError('IMAGE_SERVER_UNAVAILABLE', 'The image server is unavailable.', 503)
    }
    if (!response.ok)
      throw new MediaError(
        'IMAGE_SERVER_REJECTED',
        'The image server could not produce this rendition.',
        502,
      )
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > 16_000_000)
      throw new MediaError('RENDITION_LIMIT', 'The rendition exceeds its output limit.', 502)
    return { bytes, mimeType: response.headers.get('content-type') ?? 'application/octet-stream' }
  }
  async publish(
    id: string,
    version: string,
    input: { focus?: Point; aspectRatio?: number },
  ): Promise<Publication> {
    const asset = await this.asset(id, version),
      focus = validateVariant({ width: 320, focus: input.focus }).focus,
      aspectRatio = input.aspectRatio
    if (
      aspectRatio !== undefined &&
      (!Number.isFinite(aspectRatio) || aspectRatio < 0.5 || aspectRatio > 3)
    )
      throw new MediaError('INVALID_VARIANT', 'Publication aspect ratio must be between 0.5 and 3.')
    const descriptor = {
        asset,
        focus,
        ...(aspectRatio ? { aspectRatio } : {}),
        widths: [320, 640, 960],
      },
      publicationId = sha(
        Buffer.from(JSON.stringify({ namespace: this.options.namespace, ...descriptor })),
      )
    const publication = { id: publicationId, ...descriptor }
    try {
      await this.options.s3.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: `${this.options.namespace}/publications/${publicationId}.json`,
          Body: JSON.stringify(publication),
          ContentType: 'application/json',
          IfNoneMatch: '*',
        }),
      )
    } catch (e) {
      if (!isConflict(e)) throw e
    }
    return publication
  }
  publicationVariants(publication: Publication) {
    const seen = new Set<number>()
    return publication.widths
      .map((width) => ({
        url: this.publicURL(publication.id, width),
        ...renditionSize(publication.asset, publicationVariant(publication, width)),
      }))
      .filter((variant) => {
        if (seen.has(variant.width)) return false
        seen.add(variant.width)
        return true
      })
  }
  publicURL(id: string, width: number) {
    if (!/^[a-f0-9]{64}$/.test(id) || ![320, 640, 960].includes(width))
      throw new MediaError('INVALID_PUBLICATION', 'Unknown publication rendition.', 404)
    return new URL(`/media/published/${id}/${width}.webp`, this.options.publicOrigin).href
  }
  async publicBytes(id: string, width: number) {
    this.publicURL(id, width)
    let result
    try {
      result = await this.options.s3.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: `${this.options.namespace}/publications/${id}.json`,
        }),
      )
    } catch (e) {
      if (isMissing(e))
        throw new MediaError('PUBLICATION_NOT_FOUND', 'This image has not been published.', 404)
      throw e
    }
    if (!result.Body || !result.ContentLength || result.ContentLength > 4096)
      throw new MediaError('INVALID_PUBLICATION', 'Invalid publication record.', 409)
    const publication = JSON.parse(await result.Body.transformToString()) as Publication
    if (!publication.widths.includes(width))
      throw new MediaError('INVALID_VARIANT', 'Unpublished rendition.', 404)
    return this.render(
      publication.asset.id,
      publication.asset.version,
      publicationVariant(publication, width),
    )
  }
}
export function mediaHostFromEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const requireValue = (key: string) => {
    if (!env[key]) throw new MediaError('MISSING_CONFIG', `${key} is required.`, 500)
    return env[key]!
  }
  const s3 = new S3Client({
    endpoint: requireValue('MEDIA_S3_ENDPOINT'),
    region: requireValue('MEDIA_S3_REGION'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireValue('MEDIA_ACCESS_KEY'),
      secretAccessKey: requireValue('MEDIA_SECRET_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  const options: MediaHostOptions = {
    s3,
    bucket: requireValue('MEDIA_BUCKET'),
    namespace: requireValue('MEDIA_NAMESPACE'),
    receiptKey: Buffer.from(requireValue('MEDIA_RECEIPT_KEY'), 'hex'),
    imgproxy: {
      url: requireValue('IMGPROXY_BASE_URL'),
      key: Buffer.from(requireValue('IMGPROXY_KEY'), 'hex'),
      salt: Buffer.from(requireValue('IMGPROXY_SALT'), 'hex'),
    },
    publicOrigin: requireValue('MEDIA_PUBLIC_ORIGIN'),
  }
  return { host: new S3MediaHost(options), options }
}
