import { Editor, Extension, Mark, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Plugin } from '@tiptap/pm/state'
import { TableKit } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { parseFountain, serializeFountain, Screenplay, screenplayKinds } from './fountain.js'
import { sanitizeHTML, safeURL } from './security.js'
import { focalCover, validFocus } from './media.js'
import { imageSpans, sourceDigest, verifySidecar } from './metadata.js'
import { resolveLocale } from './i18n.js'
import { Surface } from './surface.js'
import {
  EditorError,
  type Asset,
  type CommandId,
  type Diagnostic,
  type Direction,
  type DocumentInput,
  type EditorOptions,
  type EditorState,
  type ImageMetadata,
  type Snapshot,
  type Theme,
} from './types.js'

const LanguageSpan = Mark.create({
  name: 'languageSpan',
  addAttributes() {
    return {
      lang: { default: null },
      dir: { default: null },
      isolated: { default: false, rendered: false },
    }
  },
  parseHTML() {
    return [
      { tag: 'bdi', getAttrs: () => ({ isolated: true }) },
      { tag: 'span[lang]' },
      { tag: 'span[dir]' },
    ]
  },
  renderHTML({ mark, HTMLAttributes }) {
    return [mark.attrs.isolated ? 'bdi' : 'span', HTMLAttributes, 0]
  },
})
const languageAttrs = Extension.create({
  name: 'contentLanguage',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'blockquote',
          'tableCell',
          'tableHeader',
          'screenplay',
          'textStyle',
        ],
        attributes: { lang: { default: null }, dir: { default: null } },
      },
    ]
  },
})
export type Match = { from: number; to: number }
export class WysiwygEditor {
  readonly ready: Promise<void>
  private engine!: Editor
  private surface: Surface
  private options: EditorOptions
  private input: DocumentInput
  private revision = 0
  private savedRevision = 0
  private generation = 0
  private disposed = false
  private loading = false
  private loadTicket = 0
  private aborters = new Set<AbortController>()
  private autosaveTimer?: ReturnType<typeof setTimeout>
  private language?: string
  private direction: Direction
  private root: HTMLElement
  constructor(element: HTMLElement, options: EditorOptions) {
    if (!element) throw new EditorError('MOUNT_REQUIRED', 'An editor mount element is required.')
    this.options = { ...options }
    this.input = options.document
    this.language = options.language
    this.direction = options.direction ?? 'auto'
    this.root = document.createElement('section')
    this.root.className = 'wk-editor'
    element.append(this.root)
    this.surface = new Surface(this, this.root)
    this.configure({})
    this.ready = this.loadDocument(options.document).then(() => undefined)
  }
  private assertAlive() {
    if (this.disposed) throw new EditorError('DISPOSED', 'The editor has been disposed.')
  }
  state(): EditorState {
    return {
      documentId: this.input.id,
      format: this.input.format,
      revision: this.revision,
      dirty: this.revision !== this.savedRevision,
      readOnly: !!this.options.readOnly,
    }
  }
  private notify(changed = false) {
    if (this.loading || this.disposed) return
    if (changed) {
      this.revision++
      this.options.onChange?.(this.state())
      clearTimeout(this.autosaveTimer)
      if (this.options.onAutosave) {
        const generation = this.generation
        this.autosaveTimer = setTimeout(() => {
          void this.getSnapshot()
            .then((s) => {
              if (!this.disposed && generation === this.generation)
                return this.options.onAutosave?.(s)
            })
            .catch(() =>
              this.diagnostic({
                code: 'AUTOSAVE_FAILED',
                severity: 'error',
                message: 'Autosave failed. Your edits are still available.',
              }),
            )
        }, this.options.autosaveDelay ?? 750)
      }
    }
    this.options.onState?.(this.state())
    this.surface.refresh()
  }
  diagnostic(value: Diagnostic) {
    this.options.onDiagnostic?.(value)
    this.surface.showStatus(value.message, value.severity === 'error')
  }
  configure(options: Partial<Omit<EditorOptions, 'document'>>) {
    this.assertAlive()
    if (options.theme !== undefined && !['system', 'light', 'dark'].includes(options.theme))
      throw new EditorError('INVALID_CONFIG', 'Invalid theme.')
    if (options.uiDirection !== undefined && !['auto', 'ltr', 'rtl'].includes(options.uiDirection))
      throw new EditorError('INVALID_CONFIG', 'Invalid UI direction.')
    if (options.locale !== undefined) {
      try {
        Intl.getCanonicalLocales(options.locale)
      } catch {
        throw new EditorError('INVALID_CONFIG', 'Invalid UI locale.')
      }
    }
    for (const key of ['readOnly', 'toolbar', 'allowRemoteImages'] as const)
      if (options[key] !== undefined && typeof options[key] !== 'boolean')
        throw new EditorError('INVALID_CONFIG', 'Boolean configuration value required.')
    this.options = {
      ...this.options,
      ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
    }
    const locale = resolveLocale(this.options.locale)
    this.root.dataset.theme = this.options.theme ?? 'system'
    this.root.lang = locale
    this.root.dir =
      this.options.uiDirection && this.options.uiDirection !== 'auto'
        ? this.options.uiDirection
        : locale === 'ar'
          ? 'rtl'
          : 'ltr'
    this.engine?.setEditable(!this.options.readOnly, false)
    this.surface.refresh()
  }
  setContentLanguage(language?: string, direction: Direction = this.direction) {
    this.assertAlive()
    if (this.options.readOnly) return false
    if (!['auto', 'ltr', 'rtl'].includes(direction))
      throw new EditorError('INVALID_DIRECTION', 'Invalid text direction.')
    if (language) {
      try {
        Intl.getCanonicalLocales(language)
      } catch {
        throw new EditorError('INVALID_LANGUAGE', 'A BCP 47 language tag is required.')
      }
    }
    this.language = language
    this.direction = direction
    this.applyContentLanguage()
    this.notify(true)
    return true
  }
  setBlockLanguage(language: string | null, direction: Direction = 'auto') {
    this.assertAlive()
    if (this.format !== 'html')
      throw new EditorError(
        'BLOCK_LANGUAGE_NOT_PORTABLE',
        'Per-block language metadata currently requires HTML. Use document language for Markdown or Fountain.',
      )
    if (this.options.readOnly) return false
    if (language) Intl.getCanonicalLocales(language)
    const type = this.engine.state.selection.$from.parent.type.name
    const result = this.engine.commands.updateAttributes(type, { lang: language, dir: direction })
    return result
  }
  private applyContentLanguage() {
    if (this.engine) {
      this.engine.view.dom.setAttribute('dir', this.direction)
      this.engine.view.dom.setAttribute('lang', this.language ?? 'und')
    }
  }
  private extensions(format: string) {
    const owner = this
    const identities = Extension.create({
      name: 'imageIdentities',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction: (_transactions, _old, state) => {
              const seen = new Set<string>(),
                tr = state.tr
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'image') {
                  let media = node.attrs.media as ImageMetadata | null
                  if (!media?.occurrenceId || seen.has(media.occurrenceId)) {
                    media = { ...media, occurrenceId: crypto.randomUUID() }
                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, media })
                  }
                  seen.add(media.occurrenceId)
                }
              })
              return tr.docChanged ? tr.setMeta('addToHistory', false) : null
            },
          }),
        ]
      },
    })
    const MediaImage = Image.extend({
      addAttributes() {
        return { ...this.parent?.(), media: { default: null, rendered: false } }
      },
      addNodeView() {
        return ({ node, editor, getPos }) => {
          const figure = document.createElement('figure'),
            img = document.createElement('img')
          figure.className = 'wk-image'
          figure.append(img)
          figure.contentEditable = 'false'
          const abort = new AbortController()
          let current = node,
            renderTicket = 0
          let layoutFrame: number | undefined
          const resize = new ResizeObserver(() => {
            if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame)
            layoutFrame = requestAnimationFrame(layout)
          })
          function layout() {
            const media = current.attrs.media as ImageMetadata | null
            const width = media?.asset?.width ?? img.naturalWidth,
              height = media?.asset?.height ?? img.naturalHeight
            if (media?.aspectRatio && width && height && figure.clientWidth) {
              figure.style.aspectRatio = String(media.aspectRatio)
              figure.style.position = 'relative'
              figure.style.overflow = 'hidden'
              const geometry = focalCover(
                width,
                height,
                figure.clientWidth,
                figure.clientWidth / media.aspectRatio,
                media.focus,
              )
              Object.assign(img.style, {
                position: 'absolute',
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
                left: `${geometry.left}px`,
                top: `${geometry.top}px`,
                maxWidth: 'none',
              })
            } else {
              figure.style.aspectRatio = ''
              img.style.cssText = ''
            }
          }
          function render() {
            const ticket = ++renderTicket
            img.alt = current.attrs.alt ?? ''
            img.title = current.attrs.title ?? ''
            const media = current.attrs.media as ImageMetadata | null
            const src = String(current.attrs.src ?? '')
            img.removeAttribute('src')
            if (media?.asset && owner.options.resolveAsset) {
              void owner.options
                .resolveAsset(media.asset, abort.signal)
                .then((url) => {
                  if (
                    !abort.signal.aborted &&
                    ticket === renderTicket &&
                    (safeURL(url, true) || url.startsWith('blob:')) &&
                    !url.startsWith('asset:')
                  )
                    img.src = url
                })
                .catch(() => {
                  if (!abort.signal.aborted) figure.dataset.error = 'Image could not be resolved.'
                })
            } else if (
              safeURL(src, true) &&
              !src.startsWith('asset:') &&
              (owner.options.allowRemoteImages ||
                src.startsWith('data:') ||
                !/^https?:\/\//i.test(src))
            )
              img.src = src
            img.onload = layout
            layout()
          }
          figure.onclick = () => {
            const pos = getPos()
            if (typeof pos === 'number') editor.commands.setNodeSelection(pos)
          }
          resize.observe(figure)
          render()
          return {
            dom: figure,
            update(updated) {
              if (updated.type !== current.type) return false
              current = updated
              render()
              return true
            },
            selectNode() {
              figure.classList.add('ProseMirror-selectednode')
            },
            deselectNode() {
              figure.classList.remove('ProseMirror-selectednode')
            },
            destroy() {
              abort.abort()
              resize.disconnect()
              if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame)
            },
          }
        }
      },
    })
    return [
      StarterKit.configure({
        trailingNode: false,
        link: { openOnClick: false },
        ...(format === 'fountain'
          ? {
              paragraph: false,
              heading: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
              blockquote: false,
              codeBlock: false,
              horizontalRule: false,
              code: false,
              strike: false,
            }
          : {}),
      }),
      languageAttrs,
      LanguageSpan,
      identities,
      ...(format === 'fountain'
        ? [Screenplay]
        : [
            MediaImage.configure({ allowBase64: true }),
            TableKit.configure({ table: { resizable: false } }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Markdown.configure({ markedOptions: { gfm: true } }),
          ]),
    ]
  }
  async loadDocument(input: DocumentInput, options: { acceptNormalization?: boolean } = {}) {
    this.assertAlive()
    const ticket = ++this.loadTicket
    if (
      !input ||
      typeof input.id !== 'string' ||
      !input.id ||
      !['markdown', 'html', 'fountain'].includes(input.format) ||
      typeof input.source !== 'string'
    )
      throw new EditorError('INVALID_DOCUMENT', 'Document ID, format and source are required.')
    if (new TextEncoder().encode(input.source).length > 10_000_000)
      throw new EditorError('DOCUMENT_LIMIT', 'Document exceeds the 10 MB source limit.')
    if (input.metadata) await verifySidecar(input.source, input.format, input.metadata)
    this.assertAlive()
    if (ticket !== this.loadTicket)
      throw new EditorError('LOAD_SUPERSEDED', 'A newer document load replaced this request.')
    const diagnostics: Diagnostic[] = []
    let content: JSONContent | string = input.source
    if (input.format === 'html') {
      const clean = sanitizeHTML(input.source)
      content = clean.html
      diagnostics.push(...clean.diagnostics)
    }
    const holder = document.createElement('div')
    const candidate = new Editor({
      element: holder,
      extensions: this.extensions(input.format),
      content: input.format === 'fountain' ? parseFountain(input.source) : '',
      enableInputRules: input.format !== 'fountain',
      editable: !this.options.readOnly,
      editorProps: {
        attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Document editor' },
        handleClick: (_view, _pos, event) => {
          const link = (event.target as HTMLElement).closest('a')
          if (link) {
            event.preventDefault()
            const href = link.getAttribute('href')
            if (href && safeURL(href)) this.options.onOpenLink?.(href)
            return true
          }
          return false
        },
        transformPastedHTML: (html) => {
          const result = sanitizeHTML(html)
          result.diagnostics.forEach((d) => this.diagnostic(d))
          return result.html
        },
      },
      onUpdate: ({ editor }) => {
        if (this.engine === editor) this.notify(true)
      },
      onSelectionUpdate: ({ editor }) => {
        if (this.engine === editor) this.notify()
      },
    })
    try {
      if (input.format === 'markdown') {
        const json = candidate.markdown!.parse(input.source)
        const clean = (node: JSONContent) => {
          if (
            node.attrs?.lang ||
            node.attrs?.dir ||
            node.marks?.some((m) => m.type === 'languageSpan')
          )
            diagnostics.push({
              code: 'UNSUPPORTED_LANGUAGE_METADATA',
              message:
                'Per-block or inline language metadata currently requires HTML; this Markdown load may omit it on export.',
              severity: 'warning',
            })
          if (node.type === 'image' && !safeURL(String(node.attrs?.src ?? ''), true)) {
            node.attrs = { ...node.attrs, src: '' }
            diagnostics.push({
              code: 'UNSAFE_URL_REMOVED',
              message: 'An unsafe image URL was removed.',
              severity: 'warning',
            })
          }
          if (node.marks)
            node.marks = node.marks.filter((mark) => {
              if (mark.type === 'link' && !safeURL(String(mark.attrs?.href ?? ''))) {
                diagnostics.push({
                  code: 'UNSAFE_URL_REMOVED',
                  message: 'An unsafe link was removed.',
                  severity: 'warning',
                })
                return false
              }
              return true
            })
          node.content?.forEach(clean)
        }
        clean(json)
        candidate
          .chain()
          .setContent(json, { emitUpdate: false })
          .setMeta('addToHistory', false)
          .run()
        if (
          /^---\s*\n/.test(input.source) ||
          /\$\$|<\/?(?:script|style|iframe|svg)\b/i.test(input.source)
        )
          diagnostics.push({
            code: 'UNSUPPORTED_MARKDOWN',
            message: 'This Markdown contains unsupported front matter, math or active HTML.',
            severity: 'warning',
          })
      } else if (input.format === 'html')
        candidate
          .chain()
          .setContent(content, { emitUpdate: false })
          .setMeta('addToHistory', false)
          .run()
      if (diagnostics.length && !options.acceptNormalization) {
        diagnostics.forEach((d) => this.diagnostic(d))
        throw new EditorError(
          'NORMALIZATION_REQUIRED',
          'Review the diagnostics and explicitly accept normalization before loading.',
        )
      }
      if (input.metadata) {
        const spans = imageSpans(input.source, input.format)
        let i = 0
        const tr = candidate.state.tr
        candidate.state.doc.descendants((node, pos) => {
          if (node.type.name === 'image') {
            const span = spans[i++]
            const mapping = input.metadata!.images.find(
              (entry) => span && entry.start === span.start && entry.end === span.end,
            )
            if (mapping) {
              const meta = mapping.metadata
              if (meta.focus && !validFocus(meta.focus))
                throw new EditorError('INVALID_FOCUS', 'Focal coordinates must be within [0, 1].')
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, media: meta })
            }
          }
        })
        candidate.view.dispatch(tr.setMeta('addToHistory', false))
      }
      this.loading = true
      this.abortUploads()
      clearTimeout(this.autosaveTimer)
      this.generation++
      this.engine?.destroy()
      this.surface.body.replaceChildren(holder)
      this.engine = candidate
      this.input = { id: input.id, format: input.format, source: input.source }
      this.revision = 0
      this.savedRevision = 0
      this.language = input.metadata?.language ?? this.options.language
      this.direction = input.metadata?.direction ?? this.options.direction ?? 'auto'
      this.applyContentLanguage()
      this.loading = false
      this.surface.refresh()
      this.notify()
      diagnostics.forEach((d) => this.diagnostic(d))
      return diagnostics
    } catch (error) {
      candidate.destroy()
      this.loading = false
      throw error
    }
  }
  private serialize() {
    this.assertAlive()
    if (!this.engine) throw new EditorError('NOT_READY', 'The editor is not ready.')
    return this.input.format === 'fountain'
      ? serializeFountain(this.engine.getJSON())
      : this.input.format === 'markdown'
        ? this.engine.getMarkdown()
        : this.engine.getHTML()
  }
  getSource() {
    const source = this.serialize()
    if (
      this.language ||
      this.direction !== 'auto' ||
      this.imageMetadata().some((m) => m.focus || m.asset || m.caption)
    )
      this.diagnostic({
        code: 'METADATA_OMITTED',
        message: 'Plain source omits portable metadata. Save a snapshot to retain it.',
        severity: 'warning',
      })
    return source
  }
  private imageMetadata(): ImageMetadata[] {
    const entries: ImageMetadata[] = []
    this.engine.state.doc.descendants((node) => {
      if (node.type.name === 'image')
        entries.push(node.attrs.media ?? { occurrenceId: crypto.randomUUID() })
    })
    return entries
  }
  async getSnapshot(): Promise<Snapshot> {
    const source = this.serialize(),
      state = this.state(),
      language = this.language,
      direction = this.direction,
      spans = imageSpans(source, state.format),
      images = this.imageMetadata().map((metadata, i) => ({ ...spans[i], metadata }))
    if (images.some((entry) => entry.start === undefined))
      throw new EditorError(
        'METADATA_MAPPING',
        'Image serialization did not produce a matching source span.',
      )
    const sourceDigestValue = await sourceDigest(source)
    return {
      id: state.documentId,
      format: state.format,
      source,
      revision: state.revision,
      metadata: { schemaVersion: 1, sourceDigest: sourceDigestValue, language, direction, images },
    }
  }
  markSaved(revision: number, documentId = this.input.id) {
    this.assertAlive()
    if (
      documentId !== this.input.id ||
      !Number.isSafeInteger(revision) ||
      revision > this.revision ||
      revision < 0
    )
      return false
    this.savedRevision = Math.max(this.savedRevision, revision)
    this.notify()
    return true
  }
  getOptions() {
    return { ...this.options }
  }
  get format() {
    return this.input.format
  }
  private hasImage() {
    return this.engine?.isActive('image') ?? false
  }
  commandState(id: CommandId) {
    const rich = this.format !== 'fountain',
      e = this.engine
    if (!e) return { enabled: false, active: false }
    const unavailable =
      (!rich &&
        ![
          'bold',
          'italic',
          'underline',
          'undo',
          'redo',
          'screenplay',
          'find',
          'replace',
          'replaceAll',
          'pastePlain',
          'cancelUpload',
        ].includes(id)) ||
      (this.format === 'markdown' && ['underline', 'mergeCells', 'splitCell'].includes(id))
    let enabled =
      !unavailable && (!this.options.readOnly || ['find', 'openLink', 'cancelUpload'].includes(id))
    if (id === 'undo') enabled &&= e.can().undo()
    if (id === 'redo') enabled &&= e.can().redo()
    if (
      [
        'addRow',
        'addColumn',
        'deleteRow',
        'deleteColumn',
        'deleteTable',
        'mergeCells',
        'splitCell',
      ].includes(id)
    )
      enabled &&= e.isActive('table')
    if (['imageAlt', 'imageFocus'].includes(id)) enabled &&= this.hasImage()
    if (['openLink', 'unlink'].includes(id)) enabled &&= e.isActive('link')
    return { enabled, active: !unavailable && e.isActive(id === 'screenplay' ? 'screenplay' : id) }
  }
  execute(id: CommandId, arg?: unknown): boolean {
    this.assertAlive()
    if (!this.commandState(id).enabled) return false
    if (
      arg === undefined &&
      ['link', 'image', 'imageAlt', 'imageFocus', 'screenplay'].includes(id)
    ) {
      this.surface.openCommand(id)
      return true
    }
    const e = this.engine,
      c = e.chain().focus()
    switch (id) {
      case 'bold':
        return c.toggleBold().run()
      case 'italic':
        return c.toggleItalic().run()
      case 'underline':
        return c.toggleUnderline().run()
      case 'strike':
        return c.toggleStrike().run()
      case 'code':
        return c.toggleCode().run()
      case 'paragraph':
        return c.setParagraph().run()
      case 'heading':
        return c.toggleHeading({ level: (Number(arg) || 2) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
      case 'bulletList':
        return c.toggleBulletList().run()
      case 'orderedList':
        return c.toggleOrderedList().run()
      case 'taskList':
        return c.toggleTaskList().run()
      case 'blockquote':
        return c.toggleBlockquote().run()
      case 'codeBlock':
        return c.toggleCodeBlock().run()
      case 'horizontalRule':
        return c.setHorizontalRule().run()
      case 'undo':
        return c.undo().run()
      case 'redo':
        return c.redo().run()
      case 'link': {
        if (typeof arg !== 'string' || !safeURL(arg))
          throw new EditorError('INVALID_URL', 'Enter an allowed link URL.')
        return c.extendMarkRange('link').setLink({ href: arg }).run()
      }
      case 'unlink':
        return c.extendMarkRange('link').unsetLink().run()
      case 'openLink': {
        const href = e.getAttributes('link').href
        if (href && safeURL(href)) {
          this.options.onOpenLink?.(href)
          return true
        }
        return false
      }
      case 'image': {
        const data = arg as { src: string; alt?: string; asset?: Asset }
        if (!data || !safeURL(data.src, true))
          throw new EditorError('INVALID_URL', 'Enter an allowed image reference.')
        return c
          .insertContent({
            type: 'image',
            attrs: {
              src: data.src,
              alt: data.alt ?? '',
              media: {
                occurrenceId: crypto.randomUUID(),
                ...(data.asset ? { asset: data.asset } : {}),
              },
            },
          })
          .run()
      }
      case 'imageAlt':
        if (typeof arg !== 'string') return false
        return c.updateAttributes('image', { alt: arg }).run()
      case 'imageFocus': {
        const data = arg as { focus?: { x: number; y: number }; aspectRatio?: number }
        if (
          !data ||
          (data.focus && !validFocus(data.focus)) ||
          (data.aspectRatio !== undefined &&
            (!Number.isFinite(data.aspectRatio) || data.aspectRatio <= 0 || data.aspectRatio > 100))
        )
          throw new EditorError('INVALID_FOCUS', 'Invalid focal point or aspect ratio.')
        const media = e.getAttributes('image').media ?? { occurrenceId: crypto.randomUUID() }
        return c
          .updateAttributes('image', {
            media: { ...media, focus: data.focus, aspectRatio: data.aspectRatio },
          })
          .run()
      }
      case 'table':
        return c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      case 'addRow':
        return c.addRowAfter().run()
      case 'addColumn':
        return c.addColumnAfter().run()
      case 'deleteRow':
        return c.deleteRow().run()
      case 'deleteColumn':
        return c.deleteColumn().run()
      case 'deleteTable':
        return c.deleteTable().run()
      case 'mergeCells':
        return c.mergeCells().run()
      case 'splitCell':
        return c.splitCell().run()
      case 'screenplay':
        if (!screenplayKinds.includes(arg as never)) return false
        return c.setNode('screenplay', { kind: arg, original: null, originalContent: null }).run()
      case 'find':
        this.surface.openFind()
        return true
      case 'cancelUpload':
        this.abortUploads()
        return true
      case 'pastePlain':
        if (typeof arg === 'string') return this.insertPlainText(arg)
        this.surface.openPlainPaste()
        return true
      case 'replace':
      case 'replaceAll': {
        const data = arg as { text: string; replacement: string; caseSensitive?: boolean }
        return (
          !!data &&
          this.replaceMatches(data.text, data.replacement, id === 'replaceAll', data.caseSensitive)
        )
      }
      default:
        return false
    }
  }
  find(text: string, caseSensitive = false): Match[] {
    this.assertAlive()
    if (!text) return []
    const results: Match[] = []
    // Concatenate adjacent text nodes within each text block so marks do not split a match.
    this.engine.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return
      let value = ''
      const positions: number[] = []
      node.descendants((child, offset) => {
        if (child.isText) {
          for (let i = 0; i < child.text!.length; i++) {
            value += child.text![i]
            positions.push(pos + 1 + offset + i)
          }
        } else if (child.isLeaf) {
          value += '\uFFFC'
          positions.push(pos + 1 + offset)
        }
      })
      const boundaries = new Set<number>([0, value.length])
      for (const part of new Intl.Segmenter(this.language, { granularity: 'grapheme' }).segment(
        value,
      ))
        boundaries.add(part.index)
      for (let i = 0; i <= value.length - text.length; i++) {
        const candidate = value.slice(i, i + text.length)
        if (
          caseSensitive
            ? candidate === text
            : candidate.toLocaleLowerCase() === text.toLocaleLowerCase()
        ) {
          if (boundaries.has(i) && boundaries.has(i + text.length)) {
            results.push({ from: positions[i], to: positions[i + text.length - 1] + 1 })
            i += text.length - 1
          }
        }
      }
      return false
    })
    return results
  }
  selectMatch(match: Match) {
    this.engine.commands.setTextSelection(match)
    this.engine.commands.scrollIntoView()
  }
  replaceMatches(text: string, replacement: string, all = false, caseSensitive = false) {
    if (this.options.readOnly) return false
    const matches = this.find(text, caseSensitive)
    if (!matches.length) return false
    const selected = this.engine.state.selection
    const chosen = all ? matches : [matches.find((m) => m.from >= selected.from) ?? matches[0]],
      tr = this.engine.state.tr
    for (const match of [...chosen].reverse()) tr.insertText(replacement, match.from, match.to)
    this.engine.view.dispatch(tr)
    return true
  }
  insertPlainText(text: string) {
    this.assertAlive()
    if (this.options.readOnly) return false
    const tr = this.engine.state.tr.insertText(text)
    this.engine.view.dispatch(tr)
    return true
  }
  outline() {
    const entries: { position: number; text: string; kind: string; level: number }[] = []
    this.engine.state.doc.descendants((node, position) => {
      if (
        node.type.name === 'heading' ||
        (node.type.name === 'screenplay' && ['section', 'scene'].includes(node.attrs.kind))
      )
        entries.push({
          position,
          text: node.textContent,
          kind: node.type.name === 'heading' ? 'heading' : node.attrs.kind,
          level: node.attrs.level ?? 1,
        })
    })
    return entries
  }
  counts() {
    const text = this.engine.state.doc.textBetween(0, this.engine.state.doc.content.size, '\n')
    return {
      words: Array.from(
        new Intl.Segmenter(this.language, { granularity: 'word' }).segment(text),
      ).filter((s) => s.isWordLike).length,
      characters: Array.from(
        new Intl.Segmenter(this.language, { granularity: 'grapheme' }).segment(text),
      ).length,
      scenes: this.outline().filter((e) => e.kind === 'scene').length,
    }
  }
  selectedImage() {
    return this.engine?.getAttributes('image') ?? {}
  }
  async insertFile(file: File) {
    if (!this.commandState('image').enabled) return
    if (!this.options.uploadImage)
      throw new EditorError(
        'UPLOAD_HANDLER_REQUIRED',
        'The host must provide an image upload handler.',
      )
    const generation = this.generation,
      abort = new AbortController()
    this.aborters.add(abort)
    let bookmark = this.engine.state.selection.getBookmark()
    const map = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      bookmark = bookmark.map(transaction.mapping)
    }
    this.engine.on('transaction', map)
    this.surface.showStatus(this.surface.t('upload'))
    try {
      const asset = await this.options.uploadImage(file, abort.signal)
      if (
        abort.signal.aborted ||
        this.disposed ||
        generation !== this.generation ||
        this.options.readOnly
      )
        return
      const selection = bookmark.resolve(this.engine.state.doc)
      this.engine.commands.setTextSelection({ from: selection.from, to: selection.to })
      this.execute('image', { src: asset.uri, asset, alt: file.name })
      this.surface.showStatus('')
    } finally {
      if (!this.disposed && generation === this.generation) this.engine.off('transaction', map)
      this.aborters.delete(abort)
    }
  }
  private abortUploads() {
    for (const abort of this.aborters) abort.abort()
    this.aborters.clear()
  }
  focus() {
    this.assertAlive()
    this.engine.commands.focus()
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    ++this.loadTicket
    this.abortUploads()
    clearTimeout(this.autosaveTimer)
    this.engine?.destroy()
    this.surface.dispose()
    this.root.remove()
  }
}
export function createEditor(element: HTMLElement, options: EditorOptions) {
  return new WysiwygEditor(element, options)
}
