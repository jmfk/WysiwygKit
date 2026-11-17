import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEditor,
  type WysiwygEditor,
  type Asset,
  type ImageDelivery,
} from '../../packages/core/src/index'
import { createMediaClient } from '../../packages/media/src/index'
const editors: WysiwygEditor[] = []
const asset: Asset = {
  id: 'example',
  version: '1',
  width: 600,
  height: 400,
  uri: 'asset:example@1',
}
async function make() {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = createEditor(element, {
    document: { id: 'media', format: 'markdown', source: 'Text' },
    uploadImage: async () => asset,
  })
  editors.push(editor)
  await editor.ready
  await editor.insertFile(new File(['fixture'], 'image.png', { type: 'image/png' }))
  return editor
}
afterEach(() => {
  editors.forEach((e) => e.dispose())
  editors.length = 0
  vi.useRealTimers()
  document.body.replaceChildren()
})
describe('ephemeral delivery and captured publication', () => {
  it('automatically refreshes expiring delivery without changing source, revision, selection or history', async () => {
    const editor = await make()
    vi.useFakeTimers()
    const resolve = vi.fn(async () => ({
      url: 'https://media.example/preview.png',
      expiresAt: Date.now() + 6000,
    }))
    editor.configure({ resolveAsset: resolve })
    const id = editor.getHTMLSnapshot().images[0].occurrenceId
    editor.selectImage(id)
    editor.refreshImages()
    await Promise.resolve()
    const before = {
      source: editor.getSource(),
      revision: editor.state().revision,
      undo: editor.commandState('undo'),
      selected: document.querySelector('.ProseMirror-selectednode'),
    }
    const calls = resolve.mock.calls.length
    await vi.advanceTimersByTimeAsync(1001)
    expect(resolve.mock.calls.length).toBeGreaterThan(calls)
    expect(editor.getSource()).toBe(before.source)
    expect(editor.state().revision).toBe(before.revision)
    expect(editor.commandState('undo')).toEqual(before.undo)
    expect(document.querySelector('.ProseMirror-selectednode')).toBe(before.selected)
    expect((await editor.getSnapshot()).source).not.toContain('media.example')
  })
  it('ignores resolution arriving after node destruction', async () => {
    const editor = await make()
    let complete!: (delivery: ImageDelivery) => void
    editor.configure({
      resolveAsset: () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    })
    editor.refreshImages()
    const image = document.querySelector('.wk-image img')!
    await editor.loadDocument({ id: 'replacement', format: 'markdown', source: 'Replacement' })
    complete({ url: 'https://media.example/stale.png' })
    await Promise.resolve()
    expect(image.hasAttribute('src')).toBe(false)
    expect(editor.getSource()).toBe('Replacement')
  })
  it('duplicates original identity but retains independent placements and undo', async () => {
    const editor = await make(),
      first = editor.getHTMLSnapshot().images[0].occurrenceId
    editor.selectImage(first)
    editor.execute('imageFocus', { focus: { x: 0.1, y: 0.7 }, aspectRatio: 1 })
    expect(editor.duplicateImage(first)).toBe(true)
    const images = editor.getHTMLSnapshot().images
    expect(images[0].asset).toEqual(images[1].asset)
    expect(images[0].occurrenceId).not.toBe(images[1].occurrenceId)
    editor.selectImage(images[1].occurrenceId)
    editor.execute('imageFocus', { focus: { x: 0.9, y: 0.3 }, aspectRatio: 1 })
    expect(editor.getHTMLSnapshot().images[0].focus?.x).toBe(0.1)
    editor.execute('undo')
    expect(editor.getHTMLSnapshot().images[1].focus?.x).toBe(0.1)
  })
  it('publishes a captured revision while later editor changes remain independent', async () => {
    const editor = await make(),
      input = editor.getHTMLSnapshot(),
      source = editor.getSource()
    let respond!: (response: Response) => void
    const client = createMediaClient('https://host.example', {
      fetch: (() =>
        new Promise<Response>((resolve) => {
          respond = resolve
        })) as typeof fetch,
    })
    const publishing = client.publishHTML(input)
    editor.selectImage(input.images[0].occurrenceId)
    editor.execute('imageFocus', { focus: { x: 0.2, y: 0.8 }, aspectRatio: 1 })
    respond(
      new Response(
        JSON.stringify({
          variants: [
            {
              url: 'https://host.example/media/published/public/320.webp',
              width: 320,
              height: 213,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const output = await publishing
    expect(output.revision).toBe(input.revision)
    expect(output.html).toContain('srcset=')
    expect(output.html).not.toContain('asset:')
    expect(editor.getSource()).toBe(source)
    expect(editor.state().revision).toBeGreaterThan(input.revision)
    expect(input.images[0].focus).toBeUndefined()
  })
  it('refuses to publish unmanaged images or private delivery URLs', async () => {
    const client = createMediaClient('https://host.example', {
      fetch: (async () =>
        new Response(
          JSON.stringify({
            variants: [
              { url: 'https://host.example/api/media/preview/private', width: 320, height: 213 },
            ],
          }),
        )) as typeof fetch,
    })
    await expect(
      client.publishHTML({
        id: 'x',
        revision: 0,
        html: '<img src="a.png">',
        images: [{ occurrenceId: 'x' }],
      }),
    ).rejects.toMatchObject({ code: 'UNMANAGED_IMAGE' })
    await expect(
      client.publishHTML({
        id: 'x',
        revision: 0,
        html: '<img src="asset:example@1">',
        images: [{ occurrenceId: 'x', asset }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PUBLICATION' })
  })
})

describe('delivery refresh failures', () => {
  it('retains the current presentation and retries a transient renewal failure', async () => {
    const editor = await make()
    vi.useFakeTimers()
    const resolve = vi
      .fn()
      .mockImplementationOnce(async () => ({
        url: 'https://media.example/first.png',
        expiresAt: Date.now() + 6000,
      }))
      .mockRejectedValueOnce(new Error('Temporary outage'))
      .mockImplementation(async () => ({
        url: 'https://media.example/renewed.png',
        expiresAt: Date.now() + 60000,
      }))
    editor.configure({ resolveAsset: resolve })
    editor.refreshImages()
    await Promise.resolve()
    const image = document.querySelector('.wk-image img')!
    const before = editor.state()
    await vi.advanceTimersByTimeAsync(1001)
    expect(image.getAttribute('src')).toBe('https://media.example/first.png')
    await vi.advanceTimersByTimeAsync(5000)
    expect(resolve.mock.calls.length).toBeGreaterThan(2)
    expect(image.getAttribute('src')).toBe('https://media.example/renewed.png')
    expect(editor.state().revision).toBe(before.revision)
    expect(editor.state().dirty).toBe(before.dirty)
  })
})

it('preflights all placements before making any public asset', async () => {
  const perform = vi.fn()
  const client = createMediaClient('https://host.example', { fetch: perform })
  await expect(
    client.publishHTML({
      id: 'x',
      revision: 1,
      html: '<img src="asset:example@1"><img src="unmanaged.png">',
      images: [{ occurrenceId: 'managed', asset }, { occurrenceId: 'external' }],
    }),
  ).rejects.toMatchObject({ code: 'UNMANAGED_IMAGE' })
  expect(perform).not.toHaveBeenCalled()
})

it('renews a capability that expires while its resolver is in flight', async () => {
  const editor = await make()
  vi.useFakeTimers()
  const resolve = vi
    .fn()
    .mockResolvedValueOnce({ url: 'https://media.example/expired.png', expiresAt: Date.now() - 1 })
    .mockImplementation(async () => ({
      url: 'https://media.example/fresh.png',
      expiresAt: Date.now() + 60000,
    }))
  editor.configure({ resolveAsset: resolve })
  editor.refreshImages()
  await vi.advanceTimersByTimeAsync(1001)
  expect(document.querySelector('.wk-image img')?.getAttribute('src')).toBe(
    'https://media.example/fresh.png',
  )
  expect(editor.getSource()).not.toContain('media.example')
})

it('does not overflow the timer for delivery lifetimes longer than 25 days', async () => {
  const editor = await make()
  vi.useFakeTimers()
  const resolve = vi.fn(async () => ({
    url: 'https://media.example/long-lived.png',
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  }))
  editor.configure({ resolveAsset: resolve })
  editor.refreshImages()
  await vi.advanceTimersByTimeAsync(100)
  expect(resolve).toHaveBeenCalledTimes(1)
})

it.each([{ aspectRatio: 4 }, { focus: { x: -1, y: 0.5 } }])(
  'preflights invalid publication geometry before any public write: %j',
  async (invalid) => {
    const perform = vi.fn()
    const client = createMediaClient('https://host.example', { fetch: perform })
    await expect(
      client.publishHTML({
        id: 'x',
        revision: 1,
        html: '<img src="asset:example@1"><img src="asset:example@1">',
        images: [
          { occurrenceId: 'first', asset, aspectRatio: 1 },
          { occurrenceId: 'second', asset, ...invalid },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_VARIANT' })
    expect(perform).not.toHaveBeenCalled()
  },
)

it('removes unmanaged presentation when the current remote-image policy disallows it', async () => {
  const editor = await make()
  editor.configure({ allowRemoteImages: true })
  await editor.loadDocument({
    id: 'remote',
    format: 'markdown',
    source: '![Remote](https://media.example/remote.png)',
  })
  const image = document.querySelector('.wk-image img')!
  expect(image.getAttribute('src')).toBe('https://media.example/remote.png')
  editor.configure({ allowRemoteImages: false })
  editor.refreshImages()
  expect(image.hasAttribute('src')).toBe(false)
  const id = editor.getHTMLSnapshot().images[0].occurrenceId
  editor.selectImage(id)
  editor.execute('imageAlt', 'Updated alternative')
  expect(image.hasAttribute('src')).toBe(false)
})
