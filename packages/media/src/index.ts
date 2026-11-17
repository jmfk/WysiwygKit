import type { Asset, ImageMetadata, Point } from '@wysiwygkit/core'
import { uploadPresigned } from '@wysiwygkit/core'
export type Variant = {
  width: number
  height?: number
  fit?: 'contain' | 'cover'
  focus?: Point
  format?: 'png' | 'webp' | 'jpeg'
}
export type UploadPlan = {
  url: string
  headers: Record<string, string>
  receipt: string
  expiresAt: number
}
export type Delivery = { url: string; expiresAt: number; width: number; height: number }
export type Publication = {
  id: string
  asset: Asset
  focus: Point
  aspectRatio?: number
  widths: number[]
}
export type PublishingInput = {
  id: string
  revision: number
  html: string
  images: ImageMetadata[]
}
export type PublishingOutput = { id: string; revision: number; html: string }
export class MediaClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MediaClientError'
  }
}
/** All requests are authorized by the host. This adapter never handles storage credentials. */
export function createMediaClient(
  baseURL: string,
  options: { headers?: Record<string, string>; fetch?: typeof fetch } = {},
) {
  const perform = options.fetch ?? fetch
  const url = (path: string) => new URL(path, baseURL).href
  async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await perform(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(body),
      signal,
      credentials: 'same-origin',
      redirect: 'error',
    })
    const result = (await response.json()) as T & { code?: string; message?: string }
    if (!response.ok)
      throw new MediaClientError(
        result.code ?? 'MEDIA_REQUEST_FAILED',
        result.message ?? 'The host could not complete this media operation.',
      )
    return result
  }
  const preview = (asset: Asset, variant: Variant = { width: 960 }, signal?: AbortSignal) =>
    post<Delivery>('/api/media/resolve', { id: asset.id, version: asset.version, variant }, signal)
  const publish = (
    asset: Asset,
    metadata: Pick<ImageMetadata, 'focus' | 'aspectRatio'>,
    signal?: AbortSignal,
  ) =>
    post<Publication & { variants: { url: string; width: number; height: number }[] }>(
      '/api/media/publish',
      { id: asset.id, version: asset.version, ...metadata },
      signal,
    )
  return {
    async uploadImage(file: File, signal: AbortSignal): Promise<Asset> {
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('')
      const plan = await post<UploadPlan>(
        '/api/media/uploads',
        { size: file.size, mimeType: file.type, sha256: digest },
        signal,
      )
      await uploadPresigned(file, plan, signal)
      return post<Asset>('/api/media/complete', { receipt: plan.receipt }, signal)
    },
    async resolveAsset(asset: Asset, signal: AbortSignal) {
      return preview(asset, { width: 960 }, signal)
    },
    preview,
    publish,
    /** Produces explicit public publication URLs; never exports private preview capabilities. */
    async publishHTML(input: PublishingInput, signal?: AbortSignal): Promise<PublishingOutput> {
      const document = new DOMParser().parseFromString(input.html, 'text/html'),
        images = Array.from(document.querySelectorAll('img'))
      if (images.length !== input.images.length)
        throw new MediaClientError(
          'IMAGE_MAPPING',
          'Publishing image metadata does not match the captured HTML.',
        )
      // Validate the complete capture before the first irreversible public publication.
      for (const metadata of input.images) {
        if (!metadata.asset)
          throw new MediaClientError(
            'UNMANAGED_IMAGE',
            'A publishing host must explicitly resolve unmanaged image references.',
          )
      }
      for (let i = 0; i < images.length; i++) {
        const metadata = input.images[i]
        const publication = await publish(metadata.asset!, metadata, signal),
          variants = publication.variants
        if (!variants.length)
          throw new MediaClientError('NO_RENDITIONS', 'The host returned no public renditions.')
        for (const variant of variants) {
          const protocol = new URL(variant.url).protocol
          if (
            !['http:', 'https:'].includes(protocol) ||
            new URL(variant.url).pathname.startsWith('/api/media/')
          )
            throw new MediaClientError(
              'INVALID_PUBLICATION',
              'A durable public delivery URL is required.',
            )
        }
        const largest = variants[variants.length - 1],
          image = images[i]
        image.setAttribute('src', largest.url)
        image.setAttribute('srcset', variants.map((v) => `${v.url} ${v.width}w`).join(', '))
        image.setAttribute('sizes', '(max-width: 960px) 100vw, 960px')
        image.setAttribute('width', String(largest.width))
        image.setAttribute('height', String(largest.height))
        image.removeAttribute('data-source')
      }
      return { id: input.id, revision: input.revision, html: document.body.innerHTML }
    },
  }
}
