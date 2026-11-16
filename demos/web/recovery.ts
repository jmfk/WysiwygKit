import type { Snapshot } from '../../packages/core/src/types'
/** Explicit demo opt-in. This is a cache, not a guarantee that the last keystroke survives a crash. */
export class LocalRecovery {
  constructor(
    private storage: Storage,
    private prefix = 'editor-demo-recovery',
    private ttl = 24 * 60 * 60 * 1000,
  ) {}
  save(snapshot: Snapshot) {
    const serialized = JSON.stringify({ savedAt: Date.now(), snapshot })
    if (new TextEncoder().encode(serialized).length > 1_000_000)
      throw new Error('Recovery copy exceeds the 1 MB demo limit. Export the snapshot to keep it.')
    this.storage.setItem(`${this.prefix}:${snapshot.format}`, serialized)
  }
  read(format: string): Snapshot | undefined {
    const key = `${this.prefix}:${format}`,
      raw = this.storage.getItem(key)
    if (!raw) return
    const value = JSON.parse(raw) as { savedAt: number; snapshot: Snapshot }
    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > this.ttl) {
      this.storage.removeItem(key)
      return
    }
    return value.snapshot
  }
  clear(format: string) {
    this.storage.removeItem(`${this.prefix}:${format}`)
  }
}
