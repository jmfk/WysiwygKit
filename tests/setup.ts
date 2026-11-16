import { webcrypto } from 'node:crypto'
import { vi } from 'vitest'
vi.stubGlobal('crypto', webcrypto)
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
Element.prototype.getClientRects = () => [] as unknown as DOMRectList
Element.prototype.getBoundingClientRect = () => ({
  width: 800,
  height: 600,
  top: 0,
  bottom: 600,
  left: 0,
  right: 800,
  x: 0,
  y: 0,
  toJSON() {},
})
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = Element.prototype.getBoundingClientRect
