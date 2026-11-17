import type { WysiwygEditor, ImageMetadata, Asset } from '../../packages/core/src/index'
import { createMediaClient } from '../../packages/media/src/index'
import { demoStyle } from '../shared'
import '../../packages/core/src/style.css'
export const media = createMediaClient(location.origin, { headers: { 'x-wysiwyg-demo': '1' } })
const style = document.createElement('style')
style.textContent =
  demoStyle +
  `.previews{display:flex;flex-wrap:wrap;gap:1.5rem}.previews figure{margin:0}.previews img{max-width:100%;width:240px;object-fit:contain}.previews figcaption{font-size:.85rem;margin-block:.5rem}.media-controls input[type=number]{width:6rem;font:inherit;padding:.4rem}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid Highlight;outline-offset:2px}`
document.head.append(style)
export const initialDocument = {
  id: 'media-demo',
  format: 'markdown' as const,
  source:
    '# Image integration\n\nUse Insert image to upload a JPEG, PNG or WebP file. Select a placement below to set its focus.\n',
}
export function mountMediaDemo(editor: WysiwygEditor) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const selector = $<HTMLSelectElement>('placement'),
    status = $('media-status'),
    error = $('media-error'),
    snapshot = $<HTMLTextAreaElement>('media-snapshot'),
    published = $<HTMLTextAreaElement>('published-html')
  let current: ImageMetadata | undefined
  let abort = new AbortController()
  const safe = async (action: () => Promise<unknown> | unknown) => {
    error.textContent = ''
    try {
      await action()
    } catch {
      error.textContent =
        'The media operation failed. Check the local API, storage and image server; your editing document is unchanged.'
    }
  }
  const refresh = () => {
    const images = editor.getHTMLSnapshot().images,
      selected = selector.value
    selector.replaceChildren(
      ...images.map((m, i) => {
        const option = document.createElement('option')
        option.value = m.occurrenceId
        option.textContent = `Image placement ${i + 1}`
        return option
      }),
    )
    if (images.some((m) => m.occurrenceId === selected)) selector.value = selected
    current = images.find((m) => m.occurrenceId === selector.value)
    $<HTMLInputElement>('focus-x').value = String(current?.focus?.x ?? 0.5)
    $<HTMLInputElement>('focus-y').value = String(current?.focus?.y ?? 0.5)
    status.textContent = `${images.length} placement(s) · revision ${editor.state().revision} · originals stay in object storage`
  }
  selector.onchange = () => {
    current = editor.getHTMLSnapshot().images.find((m) => m.occurrenceId === selector.value)
    if (current) editor.selectImage(current.occurrenceId)
    refresh()
  }
  $('apply-focus').onclick = () =>
    void safe(() => {
      if (!current) throw Error('No placement')
      editor.selectImage(current.occurrenceId)
      editor.execute('imageFocus', {
        focus: {
          x: Number($<HTMLInputElement>('focus-x').value),
          y: Number($<HTMLInputElement>('focus-y').value),
        },
        aspectRatio: Number($<HTMLSelectElement>('aspect').value),
      })
      refresh()
    })
  $('duplicate-placement').onclick = () => {
    if (current) {
      editor.duplicateImage(current.occurrenceId)
      refresh()
    }
  }
  $('refresh-images').onclick = () => editor.refreshImages()
  $('preview-variants').onclick = () =>
    void safe(async () => {
      if (!current?.asset) throw Error('No managed asset')
      abort.abort()
      abort = new AbortController()
      const previews = $('previews')
      previews.replaceChildren()
      for (const [name, width, height] of [
        ['Wide', 480, 270],
        ['Square', 320, 320],
        ['Portrait', 240, 360],
      ] as const) {
        const delivery = await media.preview(
            current.asset,
            { width, height, fit: 'cover', focus: current.focus },
            abort.signal,
          ),
          figure = document.createElement('figure'),
          img = document.createElement('img'),
          caption = document.createElement('figcaption')
        img.src = delivery.url
        img.alt = `${name} crop preview`
        img.width = width
        img.height = height
        caption.textContent = `${name} · ${width} × ${height}`
        figure.append(img, caption)
        previews.append(figure)
      }
    })
  $('save-media').onclick = () =>
    void safe(async () => {
      const value = await editor.getSnapshot()
      snapshot.value = JSON.stringify(value, null, 2)
      editor.markSaved(value.revision, value.id)
    })
  $('restore-media').onclick = () =>
    void safe(async () => {
      await editor.loadDocument(JSON.parse(snapshot.value))
      refresh()
    })
  $('publish-media').onclick = () =>
    void safe(async () => {
      const result = await media.publishHTML(editor.getHTMLSnapshot())
      published.value = result.html
      status.textContent = `Published captured revision ${result.revision}. The editor's source and history are unchanged.`
    })
  $('theme').onchange = () =>
    editor.configure({ theme: $<HTMLSelectElement>('theme').value as 'system' | 'light' | 'dark' })
  $('locale').onchange = () => editor.configure({ locale: $<HTMLSelectElement>('locale').value })
  $('media-format').onchange = () =>
    void safe(async () => {
      const format = $<HTMLSelectElement>('media-format').value as 'html' | 'markdown'
      await editor.loadDocument({
        id: crypto.randomUUID(),
        format,
        source:
          format === 'html'
            ? '<h1>Image integration</h1><p>Insert an image to begin.</p>'
            : initialDocument.source,
      })
      refresh()
    })
  const original = editor.getOptions().onChange
  editor.configure({
    onChange: (state) => {
      original?.(state)
      refresh()
    },
  })
  refresh()
  Object.assign(window, { mediaEditor: editor, mediaClient: media })
}
