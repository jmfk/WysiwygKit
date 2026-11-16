import type { Format, Sidecar } from './types.js'
import { EditorError } from './types.js'
import { validFocus } from './media.js'
import { safeURL } from './security.js'
/** Source spans are UTF-8 byte offsets and always bound to the complete source digest. */
export function imageSpans(source: string, format: Format): { start: number; end: number }[] {
  const escaped = (index: number) => {
    let backslashes = 0
    while (index > 0 && source[--index] === '\\') backslashes++
    return backslashes % 2 === 1
  }
  const ranges: { start: number; end: number }[] = []
  const bytes = (position: number) => new TextEncoder().encode(source.slice(0, position)).length
  if (format === 'html') {
    for (const m of source.matchAll(/<img\b[^>]*>/g))
      ranges.push({ start: bytes(m.index), end: bytes(m.index! + m[0].length) })
  } else if (format === 'markdown') {
    let codeDelimiter = ''
    for (let i = 0; i < source.length; i++) {
      if (
        !escaped(i) &&
        (source[i] === '`' || ((i === 0 || source[i - 1] === '\n') && source[i] === '~'))
      ) {
        const char = source[i]
        let end = i
        while (source[end] === char) end++
        const run = source.slice(i, end)
        if (char === '`' || run.length >= 3) {
          if (!codeDelimiter) codeDelimiter = run
          else if (run === codeDelimiter) codeDelimiter = ''
          i = end - 1
          continue
        }
      }
      if (codeDelimiter) continue
      if (source[i] !== '!' || source[i + 1] !== '[' || escaped(i)) continue
      let p = i + 2
      for (; p < source.length; p++) {
        if (source[p] === '\\') {
          p++
          continue
        }
        if (source[p] === ']') break
      }
      if (source[p + 1] !== '(') continue
      let depth = 1,
        q = p + 2
      for (; q < source.length; q++) {
        if (source[q] === '\\') {
          q++
          continue
        }
        if (source[q] === '(') depth++
        if (source[q] === ')' && !--depth) break
      }
      if (depth === 0) {
        ranges.push({ start: bytes(i), end: bytes(q + 1) })
        i = q
      }
    }
  }
  return ranges
}
export async function sourceDigest(source: string): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new EditorError(
      'CRYPTO_UNAVAILABLE',
      'A secure context is required for portable metadata snapshots.',
    )
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}
export async function verifySidecar(source: string, format: Format, value: Sidecar): Promise<void> {
  if (
    value.schemaVersion !== 1 ||
    !['auto', 'ltr', 'rtl'].includes(value.direction) ||
    !Array.isArray(value.images)
  )
    throw new EditorError('METADATA_VERSION', 'Unsupported or malformed metadata.')
  if (value.sourceDigest !== (await sourceDigest(source)))
    throw new EditorError(
      'METADATA_MISMATCH',
      'Metadata belongs to different source. Reconcile it or explicitly discard it.',
    )
  const spans = imageSpans(source, format),
    seen = new Set<string>(),
    targets = new Set<string>()
  if (value.language) {
    try {
      Intl.getCanonicalLocales(value.language)
    } catch {
      throw new EditorError('INVALID_LANGUAGE', 'Invalid metadata language tag.')
    }
  }
  for (const entry of value.images) {
    if (
      !spans.some((s) => s.start === entry.start && s.end === entry.end) ||
      !entry.metadata?.occurrenceId ||
      seen.has(entry.metadata.occurrenceId)
    )
      throw new EditorError('METADATA_MISMATCH', 'Image mappings do not match the source.')
    const target = `${entry.start}:${entry.end}`
    if (targets.has(target)) throw new EditorError('METADATA_MISMATCH', 'Duplicate image mapping.')
    targets.add(target)
    const meta = entry.metadata
    if (meta.focus && !validFocus(meta.focus))
      throw new EditorError('INVALID_FOCUS', 'Invalid focal coordinates.')
    if (
      meta.aspectRatio !== undefined &&
      (!Number.isFinite(meta.aspectRatio) || meta.aspectRatio <= 0 || meta.aspectRatio > 100)
    )
      throw new EditorError('INVALID_FOCUS', 'Invalid aspect ratio.')
    if (
      meta.asset &&
      (!meta.asset.id ||
        !meta.asset.version ||
        !safeURL(meta.asset.uri, true) ||
        ![meta.asset.width, meta.asset.height].every((v) => Number.isFinite(v) && v > 0))
    )
      throw new EditorError('INVALID_ASSET', 'Invalid asset metadata.')
    seen.add(entry.metadata.occurrenceId)
  }
}
