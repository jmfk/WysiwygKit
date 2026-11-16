import {
  createEditor,
  type Format,
  type Theme,
  type Direction,
  type Snapshot,
} from '../../packages/core/src/index'
import '../../packages/core/src/style.css'
import { LocalRecovery } from './recovery'
import { samples, localImage, demoStyle } from '../shared'
const style = document.createElement('style')
style.textContent = demoStyle
document.head.append(style)
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const error = $('error'),
  source = $<HTMLTextAreaElement>('source'),
  snapshot = $<HTMLTextAreaElement>('snapshot')
const editor = createEditor($('editor'), {
  document: { id: 'web-markdown', format: 'markdown', source: samples.markdown },
  uploadImage: localImage,
  onAutosave: (snapshot) => {
    if ($<HTMLInputElement>('recovery').checked) {
      const recovery = new LocalRecovery(localStorage)
      recovery.save(snapshot)
      editor.markSaved(snapshot.revision, snapshot.id)
    }
  },
  resolveAsset: async (asset) => asset.uri,
  onState: (state) => {
    $('state').textContent =
      `${state.format} · revision ${state.revision} · ${state.readOnly ? 'read only' : state.dirty ? 'unsaved edits' : 'saved'}`
  },
  onDiagnostic: (d) => {
    error.textContent = `${d.code}: ${d.message}`
  },
  onOpenLink: (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
})
// Public demo handle also lets browser regression tests exercise the same host API.
Object.assign(window, { demoEditor: editor })
source.value = samples.markdown
async function safely(action: () => unknown | Promise<unknown>) {
  error.textContent = ''
  try {
    await action()
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e)
  }
}
$<HTMLSelectElement>('format').onchange = (event) =>
  void safely(async () => {
    const format = (event.target as HTMLSelectElement).value as Format
    await editor.loadDocument({ id: crypto.randomUUID(), format, source: samples[format] })
    source.value = samples[format]
  })
$<HTMLSelectElement>('theme').onchange = (e) =>
  editor.configure({ theme: (e.target as HTMLSelectElement).value as Theme })
$<HTMLSelectElement>('locale').onchange = (e) =>
  editor.configure({ locale: (e.target as HTMLSelectElement).value })
$<HTMLSelectElement>('direction').onchange = (e) =>
  editor.setContentLanguage(undefined, (e.target as HTMLSelectElement).value as Direction)
$<HTMLInputElement>('readonly').onchange = (e) =>
  editor.configure({ readOnly: (e.target as HTMLInputElement).checked })
$('export').onclick = () =>
  void safely(async () => {
    const value = await editor.getSnapshot()
    source.value = value.source
    snapshot.value = JSON.stringify(value, null, 2)
    editor.markSaved(value.revision, value.id)
  })
$('load').onclick = () =>
  void safely(() =>
    editor.loadDocument(
      { id: crypto.randomUUID(), format: editor.format, source: source.value },
      { acceptNormalization: $<HTMLInputElement>('normalize').checked },
    ),
  )
$('restore').onclick = () =>
  void safely(() => editor.loadDocument(JSON.parse(snapshot.value) as Snapshot))
void editor.ready.catch((e) => {
  error.textContent = String(e)
})

$('recover').onclick = () =>
  void safely(async () => {
    if (editor.state().dirty)
      throw new Error('Export your current edits before restoring a recovery copy.')
    const recovered = new LocalRecovery(localStorage).read(editor.format)
    if (!recovered) throw new Error('No unexpired recovery copy is available.')
    await editor.loadDocument(recovered)
    source.value = recovered.source
  })
$('clear-recovery').onclick = () =>
  void safely(() => new LocalRecovery(localStorage).clear(editor.format))
