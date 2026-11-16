import type { Point } from './types.js'
export function focalCover(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
  focus: Point = { x: 0.5, y: 0.5 },
) {
  if (
    [width, height, targetWidth, targetHeight].some((v) => !Number.isFinite(v) || v <= 0) ||
    [focus.x, focus.y].some((v) => !Number.isFinite(v) || v < 0 || v > 1)
  )
    throw new RangeError('Invalid image geometry')
  const scale = Math.max(targetWidth / width, targetHeight / height),
    w = width * scale,
    h = height * scale
  return {
    width: w,
    height: h,
    left: -Math.max(0, Math.min(w - targetWidth, focus.x * w - targetWidth / 2)),
    top: -Math.max(0, Math.min(h - targetHeight, focus.y * h - targetHeight / 2)),
  }
}
export function validFocus(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false
  const p = value as Point
  return [p.x, p.y].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)
}
/** Host calls this with a short-lived upload plan; never a storage access key. */
export async function uploadPresigned(
  file: Blob,
  plan: { url: string; headers?: Record<string, string> },
  signal?: AbortSignal,
) {
  const url = new URL(plan.url)
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('HTTPS upload required')
  const response = await fetch(url, {
    method: 'PUT',
    headers: plan.headers,
    body: file,
    signal,
    credentials: 'omit',
    redirect: 'error',
  })
  if (!response.ok) throw new Error(`Upload failed (${response.status})`)
  // Finalization and durable identity are host responsibilities. A successful PUT is not a finalized asset.
}
/** Small-file, local-only storage for demos and offline hosts. The caller owns persistence. */
export async function localDataAsset(
  file: File,
  signal: AbortSignal,
): Promise<import('./types.js').Asset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4_000_000)
    throw new Error('Choose a PNG, JPEG or WebP image smaller than 4 MB.')
  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => {
      reader.abort()
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    reader.onload = () => {
      signal.removeEventListener('abort', abort)
      resolve(String(reader.result))
    }
    reader.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(new Error('The file could not be read.'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }
    reader.readAsDataURL(file)
  })
  const image = new globalThis.Image()
  image.src = uri
  await image.decode()
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (image.naturalWidth * image.naturalHeight > 32_000_000)
    throw new Error('Choose an image smaller than 32 megapixels.')
  return {
    id: crypto.randomUUID(),
    version: '1',
    width: image.naturalWidth,
    height: image.naturalHeight,
    uri,
  }
}
