import type { WysiwygEditor } from './editor.js'
import { translator } from './i18n.js'
import { screenplayKinds } from './fountain.js'
import type { CommandId } from './types.js'
export const commandIds: CommandId[] = [
  'undo',
  'redo',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'heading',
  'paragraph',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'link',
  'unlink',
  'openLink',
  'image',
  'imageAlt',
  'imageFocus',
  'table',
  'addRow',
  'addColumn',
  'deleteRow',
  'deleteColumn',
  'deleteTable',
  'mergeCells',
  'splitCell',
  'screenplay',
  'find',
  'replace',
  'replaceAll',
  'pastePlain',
  'cancelUpload',
]
const shortcuts: Partial<Record<CommandId, string>> = {
  bold: 'Mod+B',
  italic: 'Mod+I',
  underline: 'Mod+U',
  undo: 'Mod+Z',
  redo: 'Mod+Shift+Z',
  find: 'Mod+F',
  pastePlain: 'Mod+Shift+V',
}
export class Surface {
  readonly body = document.createElement('div')
  private toolbar = document.createElement('div')
  private panel = document.createElement('div')
  private status = document.createElement('div')
  private palette = document.createElement('div')
  private buttons = new Map<CommandId, HTMLButtonElement>()
  private keyHandler: (event: KeyboardEvent) => void
  constructor(
    private host: WysiwygEditor,
    private root: HTMLElement,
  ) {
    this.toolbar.className = 'wk-toolbar'
    this.toolbar.setAttribute('role', 'toolbar')
    this.body.className = 'wk-body'
    this.panel.className = 'wk-panel'
    this.panel.hidden = true
    this.palette.className = 'wk-palette'
    this.palette.hidden = true
    this.status.className = 'wk-status'
    this.status.setAttribute('role', 'status')
    this.status.setAttribute('aria-live', 'polite')
    root.append(this.toolbar, this.panel, this.palette, this.body, this.status)
    this.keyHandler = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'k') {
          event.preventDefault()
          this.openPalette()
        }
        if (event.key.toLowerCase() === 'f') {
          event.preventDefault()
          this.openFind()
        }
      }
      if (event.key === 'Escape') {
        this.panel.hidden = true
        this.palette.hidden = true
        this.host.focus()
      }
    }
    root.addEventListener('keydown', this.keyHandler)
    this.body.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    })
    this.body.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files[0]
      if (file) {
        event.preventDefault()
        this.insertFile(file)
      }
    })
    this.body.addEventListener('paste', (event) => {
      const file = Array.from(event.clipboardData?.files ?? [])[0]
      if (file) {
        event.preventDefault()
        this.insertFile(file)
      }
    })
  }
  t(id: string) {
    const options = this.host.getOptions()
    return translator(options.locale, options.messages)(id)
  }
  private button(label: string, action: () => void) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.onclick = action
    return b
  }
  private safely(action: () => void | Promise<void>) {
    try {
      const result = action()
      if (result instanceof Promise)
        void result.catch((error) =>
          this.host.diagnostic({
            code: 'COMMAND_FAILED',
            message: error instanceof Error ? error.message : this.t('error'),
            severity: 'error',
          }),
        )
    } catch (error) {
      this.host.diagnostic({
        code: 'COMMAND_FAILED',
        message: error instanceof Error ? error.message : this.t('error'),
        severity: 'error',
      })
    }
  }
  private run(id: CommandId) {
    this.safely(() => {
      if (id === 'image') this.openImage()
      else if (id === 'link') this.openLink()
      else if (id === 'imageAlt') this.openAlt()
      else if (id === 'imageFocus') this.openFocus()
      else if (id === 'screenplay') this.openScreenplay()
      else if (id === 'replace' || id === 'replaceAll' || id === 'find') this.openFind()
      else this.host.execute(id)
    })
  }
  openCommand(id: CommandId) {
    this.run(id)
  }
  refresh() {
    const options = this.host.getOptions()
    this.toolbar.hidden = options.toolbar === false
    const visible: CommandId[] =
      this.host.format === 'fountain'
        ? ['undo', 'redo', 'bold', 'italic', 'underline', 'screenplay', 'find']
        : [
            'undo',
            'redo',
            'bold',
            'italic',
            'heading',
            'bulletList',
            'link',
            'image',
            'table',
            'find',
          ]
    const current = this.toolbar.dataset.format
    if (current !== this.host.format) {
      this.toolbar.replaceChildren()
      this.buttons.clear()
      this.toolbar.dataset.format = this.host.format
      for (const id of visible) {
        const button = this.button('', () => this.run(id))
        button.dataset.command = id
        button.onmousedown = (event) => event.preventDefault()
        this.toolbar.append(button)
        this.buttons.set(id, button)
      }
      const palette = this.button('⌘K / Ctrl+K', () => this.openPalette())
      palette.dataset.palette = 'true'
      this.toolbar.append(palette)
    }
    this.toolbar.setAttribute('aria-label', this.t('commands'))
    this.body.querySelector('[role=textbox]')?.setAttribute('aria-label', this.t('editor'))
    for (const [id, button] of this.buttons) {
      const state = this.host.commandState(id)
      button.textContent = this.t(id)
      button.title = this.t(id) + (shortcuts[id] ? ` (${shortcuts[id]})` : '')
      button.disabled = !state.enabled
      button.setAttribute('aria-pressed', String(state.active))
    }
    this.toolbar.querySelector('[data-palette]')?.setAttribute('aria-label', this.t('commands'))
  }
  showStatus(message: string, error = false) {
    this.status.textContent = message
    this.status.dataset.error = String(error)
  }
  private startPanel() {
    this.panel.replaceChildren()
    this.panel.hidden = false
    this.palette.hidden = true
    return this.panel
  }
  private input(label: string, value = '', type = 'text') {
    const wrapper = document.createElement('label'),
      input = document.createElement('input')
    wrapper.append(document.createTextNode(label))
    input.type = type
    input.value = value
    wrapper.append(input)
    return { wrapper, input }
  }
  private closeButton() {
    return this.button(this.t('close'), () => {
      this.panel.hidden = true
      this.palette.hidden = true
      this.host.focus()
    })
  }
  openPalette() {
    this.palette.replaceChildren()
    this.palette.hidden = false
    this.panel.hidden = true
    const { wrapper, input } = this.input(this.t('commands')),
      list = document.createElement('div')
    list.className = 'wk-command-list'
    this.palette.append(wrapper, list, this.closeButton())
    const render = () => {
      list.replaceChildren()
      for (const id of commandIds.filter((id) =>
        (this.t(id) + ' ' + id).toLocaleLowerCase().includes(input.value.toLocaleLowerCase()),
      )) {
        const state = this.host.commandState(id)
        const button = this.button(
          this.t(id) + (shortcuts[id] ? ` · ${shortcuts[id]}` : ''),
          () => {
            this.palette.hidden = true
            this.run(id)
          },
        )
        button.disabled = !state.enabled
        list.append(button)
      }
      if (!list.childElementCount) list.textContent = this.t('noCommands')
    }
    input.oninput = render
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
      }
    }
    render()
    input.focus()
  }
  openFind() {
    const panel = this.startPanel(),
      search = this.input(this.t('search')),
      replacement = this.input(this.t('replacement')),
      sensitive = this.input(this.t('caseSensitive'), '', 'checkbox'),
      count = document.createElement('output')
    let index = -1
    const matches = () => this.host.find(search.input.value, sensitive.input.checked)
    const navigate = (delta: number) => {
      const result = matches()
      count.value = `${result.length} ${this.t('matches')}`
      if (result.length) {
        index = (index + delta + result.length) % result.length
        this.host.selectMatch(result[index])
      }
    }
    search.input.oninput = () => {
      index = -1
      navigate(1)
    }
    sensitive.input.onchange = () => navigate(1)
    const replace = this.button(this.t('replace'), () => {
        this.host.replaceMatches(
          search.input.value,
          replacement.input.value,
          false,
          sensitive.input.checked,
        )
        navigate(1)
      }),
      all = this.button(this.t('replaceAll'), () => {
        this.host.replaceMatches(
          search.input.value,
          replacement.input.value,
          true,
          sensitive.input.checked,
        )
        navigate(1)
      })
    replace.disabled = all.disabled = !!this.host.getOptions().readOnly
    panel.append(
      search.wrapper,
      replacement.wrapper,
      sensitive.wrapper,
      count,
      this.button(this.t('previous'), () => navigate(-1)),
      this.button(this.t('next'), () => navigate(1)),
      replace,
      all,
      this.closeButton(),
    )
    search.input.focus()
  }
  openPlainPaste() {
    const panel = this.startPanel(),
      text = document.createElement('textarea')
    text.setAttribute('aria-label', this.t('pastePlain'))
    panel.append(
      text,
      this.button(this.t('apply'), () => {
        this.host.insertPlainText(text.value)
        this.panel.hidden = true
        this.host.focus()
      }),
      this.closeButton(),
    )
    text.focus()
    text.onpaste = () => {
      this.showStatus(this.t('pastePlain'))
    }
    // Native paste-as-plain-text (Mod+Shift+V) works directly in the editor. This panel deliberately
    // leaves clipboard permission with the browser; no silent clipboard reads are made.
  }
  private openLink() {
    const panel = this.startPanel(),
      url = this.input(this.t('url'))
    panel.append(
      url.wrapper,
      this.button(this.t('apply'), () =>
        this.safely(() => {
          this.host.execute('link', url.input.value)
          this.panel.hidden = true
        }),
      ),
      this.closeButton(),
    )
    url.input.focus()
  }
  private openImage() {
    const panel = this.startPanel(),
      url = this.input(this.t('url')),
      alt = this.input(this.t('alt')),
      file = document.createElement('input')
    file.type = 'file'
    file.accept = 'image/png,image/jpeg,image/webp'
    file.setAttribute('aria-label', this.t('image'))
    file.disabled = !this.host.getOptions().uploadImage
    file.onchange = () => {
      if (file.files?.[0]) this.insertFile(file.files[0])
    }
    panel.append(
      url.wrapper,
      alt.wrapper,
      this.button(this.t('apply'), () =>
        this.safely(() => {
          this.host.execute('image', { src: url.input.value, alt: alt.input.value })
          this.panel.hidden = true
        }),
      ),
      file,
      this.closeButton(),
    )
    url.input.focus()
  }
  private insertFile(file: File) {
    this.safely(() => this.host.insertFile(file))
  }
  private openAlt() {
    const panel = this.startPanel(),
      alt = this.input(this.t('alt'), this.host.selectedImage().alt ?? '')
    panel.append(
      alt.wrapper,
      this.button(this.t('apply'), () => {
        this.host.execute('imageAlt', alt.input.value)
        this.panel.hidden = true
      }),
      this.closeButton(),
    )
    alt.input.focus()
  }
  private openFocus() {
    const panel = this.startPanel(),
      media = this.host.selectedImage().media,
      focus = media?.focus ?? { x: 0.5, y: 0.5 }
    const x = this.input(this.t('focusX'), String(focus.x), 'number'),
      y = this.input(this.t('focusY'), String(focus.y), 'number')
    for (const input of [x.input, y.input]) {
      input.min = '0'
      input.max = '1'
      input.step = '.01'
    }
    panel.append(
      x.wrapper,
      y.wrapper,
      this.button(this.t('apply'), () =>
        this.safely(() => {
          this.host.execute('imageFocus', {
            focus: { x: Number(x.input.value), y: Number(y.input.value) },
            aspectRatio: 16 / 9,
          })
          this.panel.hidden = true
        }),
      ),
      this.button(this.t('reset'), () => {
        this.host.execute('imageFocus', {})
        this.panel.hidden = true
      }),
      this.closeButton(),
    )
    x.input.focus()
  }
  private openScreenplay() {
    const panel = this.startPanel()
    for (const kind of screenplayKinds)
      panel.append(
        this.button(this.t(kind), () => {
          this.host.execute('screenplay', kind)
          this.panel.hidden = true
        }),
      )
    panel.append(this.closeButton())
  }
  dispose() {
    this.root.removeEventListener('keydown', this.keyHandler)
  }
}
