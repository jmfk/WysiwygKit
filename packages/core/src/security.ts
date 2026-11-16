import DOMPurify from 'dompurify'
import type { Diagnostic } from './types.js'
export function safeURL(value: string, image = false): boolean {
  if (/[\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return false
  if (image && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))
    return value.length <= 7_000_000
  if (image && value.startsWith('asset:')) return /^asset:[a-zA-Z0-9._@/-]+$/.test(value)
  if (!value) return false
  try {
    const url = new URL(value, 'https://local.invalid/')
    return ['https:', 'http:', ...(!image ? ['mailto:', 'tel:'] : [])].includes(url.protocol)
  } catch {
    return false
  }
}
export function sanitizeHTML(source: string): { html: string; diagnostics: Diagnostic[] } {
  const html = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      'body',
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'code',
      'pre',
      'blockquote',
      'ul',
      'ol',
      'li',
      'hr',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'td',
      'th',
      'span',
      'bdi',
      'input',
      'label',
      'div',
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'colspan',
      'rowspan',
      'start',
      'lang',
      'dir',
      'data-type',
      'data-checked',
      'type',
      'checked',
      'disabled',
    ],
    ALLOW_DATA_ATTR: false,
    ADD_DATA_URI_TAGS: [],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcset'],
  })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let removed = false
  doc.querySelectorAll('[href],[src]').forEach((el) => {
    for (const attr of ['href', 'src']) {
      const value = el.getAttribute(attr)
      if (value !== null && !safeURL(value, attr === 'src')) {
        el.removeAttribute(attr)
        removed = true
      }
    }
  })
  const diagnostics: Diagnostic[] = []
  if (DOMPurify.removed.length || removed)
    diagnostics.push({
      code: 'UNSAFE_HTML_REMOVED',
      message: 'Unsafe or unsupported HTML was removed.',
      severity: 'warning',
    })
  return { html: doc.body.innerHTML, diagnostics }
}
