import { afterEach, describe, it, expect } from 'vitest'
import {
  createEditor,
  type WysiwygEditor,
  focalCover,
  catalogs,
} from '../../packages/core/src/index'
import { imageSpans } from '../../packages/core/src/metadata'
const editors: WysiwygEditor[] = []
async function make(
  source = 'Hello **world**',
  format: 'markdown' | 'html' | 'fountain' = 'markdown',
) {
  const el = document.createElement('div')
  document.body.append(el)
  const e = createEditor(el, { document: { id: crypto.randomUUID(), source, format } })
  editors.push(e)
  await e.ready
  return e
}
afterEach(() => {
  editors.forEach((e) => e.dispose())
  editors.length = 0
  document.body.replaceChildren()
})
describe('rich editor contracts', () => {
  it('round trips Markdown tables, lists and formatting semantically', async () => {
    const e = await make(
      '# Title\n\n**Bold** and *italic*.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- Item',
    )
    const first = await e.getSnapshot()
    await e.loadDocument(first)
    expect((await e.getSnapshot()).source).toBe(first.source)
    expect(first.source).toContain('| A')
    expect(first.source).toContain('**Bold**')
  })
  it('round trips Fountain metadata through the actual schema', async () => {
    const source =
      'Title: Test\n\nINT. ROOM - DAY\n\nALEX\n_Underline_ and **bold**.\n\n[[Keep me]]\n'
    const e = await make(source, 'fountain')
    expect((await e.getSnapshot()).source).toBe(source)
  })
  it('rejects unsafe HTML without replacing the working document', async () => {
    const e = await make()
    await expect(
      e.loadDocument({
        id: 'bad',
        format: 'html',
        source: '<p onclick="alert(1)">Hi<script>alert(1)</script></p>',
      }),
    ).rejects.toThrow('normalization')
    expect(e.state().documentId).not.toBe('bad')
    await e.loadDocument(
      { id: 'clean', format: 'html', source: '<p onclick="x">Hi<script>x</script></p>' },
      { acceptNormalization: true },
    )
    expect(e.getSource()).toBe('<p>Hi</p>')
  })
  it('never accepts executable URLs through commands', async () => {
    const e = await make()
    expect(() => e.execute('image', { src: 'javascript:alert(1)' })).toThrow()
    expect(() => e.execute('link', 'data:text/html,evil')).toThrow()
  })
  it('prevents mutations in read-only mode and does not dirty a theme change', async () => {
    const e = await make()
    e.configure({ theme: 'dark', locale: 'ar', readOnly: true })
    expect(e.state().dirty).toBe(false)
    expect(e.execute('bold')).toBe(false)
    expect(e.replaceMatches('Hello', 'Bye', true)).toBe(false)
    expect(e.insertPlainText('bad')).toBe(false)
  })
  it('keeps newer edits dirty when an old save completes', async () => {
    const e = await make('Hello')
    e.replaceMatches('Hello', 'First')
    const old = await e.getSnapshot()
    e.replaceMatches('First', 'Second')
    e.markSaved(old.revision, old.id)
    expect(e.state().dirty).toBe(true)
    expect(e.getSource()).toContain('Second')
    e.markSaved(e.state().revision)
    expect(e.state().dirty).toBe(false)
  })
  it('finds across marks and replaces all in one undo step', async () => {
    const e = await make('Hello **world**. Hello world.')
    expect(e.find('Hello world')).toHaveLength(2)
    e.replaceMatches('Hello world', 'Goodbye', true)
    expect(e.getSource()).toContain('Goodbye')
    e.execute('undo')
    expect(e.find('Hello world')).toHaveLength(2)
  })
  it('does not split grapheme clusters during replacement', async () => {
    const e = await make('e\u0301 👨‍👩‍👧‍👦')
    expect(e.find('e')).toHaveLength(0)
    expect(e.find('👩')).toHaveLength(0)
    expect(e.find('e\u0301')).toHaveLength(1)
  })
  it('preserves independent image focus metadata and stable occurrence IDs', async () => {
    const e = await make('![one](https://example.test/a.png)\n\n![two](https://example.test/a.png)')
    const first = await e.getSnapshot(),
      again = await e.getSnapshot()
    expect(first.metadata?.images.map((i) => i.metadata.occurrenceId)).toEqual(
      again.metadata?.images.map((i) => i.metadata.occurrenceId),
    )
    expect(new Set(first.metadata?.images.map((i) => i.metadata.occurrenceId)).size).toBe(2)
    first.metadata!.images[0].metadata.focus = { x: 0.1, y: 0.7 }
    await e.loadDocument(first)
    const restored = await e.getSnapshot()
    expect(restored.metadata?.images[0].metadata.focus).toEqual({ x: 0.1, y: 0.7 })
    expect(restored.metadata?.images[1].metadata.focus).toBeUndefined()
  })
  it('rejects mismatched sidecars instead of guessing duplicate-image mappings', async () => {
    const e = await make('![one](a.png)')
    const s = await e.getSnapshot()
    s.source += ' changed'
    await expect(e.loadDocument(s)).rejects.toThrow('different source')
  })
  it('preserves multilingual HTML language/direction markup', async () => {
    const e = await make('<p lang="ar" dir="rtl">مرحبًا <bdi dir="ltr">Hello</bdi></p>', 'html')
    expect(e.getSource()).toContain('lang="ar"')
    expect(e.getSource()).toContain('dir="rtl"')
  })
})
describe('media and locale invariants', () => {
  it('clamps focal cover at image edges and ignores UI direction', () => {
    expect(focalCover(400, 200, 100, 100, { x: 0, y: 0.5 })).toEqual({
      width: 200,
      height: 100,
      left: -0,
      top: -0,
    })
    expect(focalCover(400, 200, 100, 100, { x: 1, y: 0.5 }).left).toBe(-100)
    expect(() => focalCover(0, 100, 100, 100)).toThrow()
  })
  it('declares the same keys in all runtime catalogs', () => {
    for (const catalog of Object.values(catalogs))
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(catalogs.en).sort())
  })
  it('maps UTF-8 offsets rather than UTF-16 string positions', () => {
    const source = '日本 ![x](one.png)'
    expect(imageSpans(source, 'markdown')).toEqual([{ start: 7, end: 20 }])
  })
})

describe('source mapping boundaries', () => {
  it('ignores image syntax inside fenced and inline code', () => {
    const source = '```md\n![fake](a.png)\n```\n\n`![fake](b.png)`\n\n![real](c.png)'
    const ranges = imageSpans(source, 'markdown')
    expect(ranges).toHaveLength(1)
    expect(
      new TextDecoder().decode(
        new TextEncoder().encode(source).slice(ranges[0].start, ranges[0].end),
      ),
    ).toBe('![real](c.png)')
  })
})

describe('host configuration boundaries', () => {
  it('rejects malformed runtime configuration and preserves prior settings', async () => {
    const e = await make()
    expect(() => e.configure({ theme: 'unexpected' as never })).toThrow('Invalid theme')
    expect(e.getOptions().theme).toBeUndefined()
  })
  it('does not silently promise unsupported block-language persistence', async () => {
    const e = await make()
    expect(() => e.setBlockLanguage('ar', 'rtl')).toThrow('requires HTML')
    e.setContentLanguage('ar', 'rtl')
    expect((await e.getSnapshot()).metadata?.language).toBe('ar')
  })
})

describe('asynchronous ownership', () => {
  it('never inserts a delayed upload into a replacement document', async () => {
    const e = await make('First')
    let complete!: (asset: import('../../packages/core/src/types').Asset) => void
    e.configure({
      uploadImage: () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    })
    const pending = e.insertFile(new File(['bytes'], 'a.png', { type: 'image/png' }))
    await e.loadDocument({ id: 'second', format: 'markdown', source: 'Second' })
    complete({ id: 'asset1', version: '1', width: 1, height: 1, uri: 'https://example.test/a.png' })
    await pending
    expect(e.getSource()).toBe('Second')
  })
  it('cancels stale save acknowledgements including invalid revisions', async () => {
    const e = await make('Text')
    e.insertPlainText('change')
    expect(e.markSaved(Number.NaN)).toBe(false)
    expect(e.state().dirty).toBe(true)
  })
})
