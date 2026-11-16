import { Node, mergeAttributes, type JSONContent } from '@tiptap/core'
export const screenplayKinds = [
  'action',
  'scene',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'centered',
  'lyric',
  'section',
  'synopsis',
  'note',
  'boneyard',
  'title',
  'pageBreak',
  'blank',
] as const
export type ScreenplayKind = (typeof screenplayKinds)[number]
type Inline = JSONContent[]
function inline(source: string, inherited: string[] = []): Inline {
  const result: Inline = []
  let plain = ''
  const flush = () => {
    if (plain) {
      result.push({
        type: 'text',
        text: plain,
        ...(inherited.length ? { marks: inherited.map((type) => ({ type })) } : {}),
      })
      plain = ''
    }
  }
  for (let i = 0; i < source.length;) {
    if (source[i] === '\\' && i + 1 < source.length) {
      plain += source[i + 1]
      i += 2
      continue
    }
    const delimiter = ['***', '**', '*', '_'].find((d) => source.startsWith(d, i))
    if (delimiter && source[i + delimiter.length] && !/\s/.test(source[i + delimiter.length])) {
      let end = i + delimiter.length
      while (
        (end = source.indexOf(delimiter, end)) >= 0 &&
        (source[end - 1] === '\\' || /\s/.test(source[end - 1]))
      )
        end += delimiter.length
      if (end > i + delimiter.length) {
        flush()
        const marks =
          delimiter === '***'
            ? ['bold', 'italic']
            : delimiter === '**'
              ? ['bold']
              : delimiter === '*'
                ? ['italic']
                : ['underline']
        result.push(
          ...inline(source.slice(i + delimiter.length, end), [
            ...new Set([...inherited, ...marks]),
          ]),
        )
        i = end + delimiter.length
        continue
      }
    }
    plain += source[i++]
  }
  flush()
  return result
}
function renderInline(nodes: Inline = []): string {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\n'
      let text = (node.text ?? '').replace(/[\\*_]/g, '\\$&')
      const marks = new Set(node.marks?.map((m) => m.type))
      if (marks.has('italic')) text = `*${text}*`
      if (marks.has('bold')) text = `**${text}**`
      if (marks.has('underline')) text = `_${text}_`
      return text
    })
    .join('')
}
export function parseFountain(source: string): JSONContent {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let dialogue = false,
    boneyard = false,
    titlePage = true
  const content = lines.map((raw, i): JSONContent => {
    const text = raw.trim()
    let kind: ScreenplayKind = 'action',
      prefix = '',
      suffix = '',
      value = raw
    const beforeBlank = i === 0 || !lines[i - 1].trim(),
      afterBlank = i === lines.length - 1 || !lines[i + 1].trim()
    const take = (k: ScreenplayKind, p: string, s = '') => {
      kind = k
      prefix = p
      suffix = s
      value = raw.slice(p.length, s ? raw.length - s.length : undefined)
    }
    if (boneyard || text.startsWith('/*')) {
      kind = 'boneyard'
      boneyard = !raw.includes('*/')
    } else if (!text && raw.length < 2) {
      kind = 'blank'
      dialogue = false
      titlePage = false
    } else if (titlePage && (/^[^:\n]+:/.test(raw) || /^( {3,}|\t)/.test(raw))) kind = 'title'
    else {
      titlePage = false
      if (/^={3,}$/.test(text)) kind = 'pageBreak'
      else if (/^\[\[.*\]\]$/.test(text)) kind = 'note'
      else if (/^#+\s?/.test(raw)) take('section', raw.match(/^#+\s?/)![0])
      else if (/^=(?!=)\s?/.test(raw)) take('synopsis', raw.match(/^=\s?/)![0])
      else if (raw.startsWith('!')) take('action', '!')
      else if (raw.startsWith('.') && /^\.[^\.\s]/.test(raw)) take('scene', '.')
      else if (raw.startsWith('@')) take('character', '@')
      else if (raw.startsWith('~')) take('lyric', '~')
      else if (/^\s*>.*<\s*$/.test(raw))
        take('centered', raw.match(/^\s*>\s*/)![0], raw.match(/\s*<\s*$/)![0])
      else if (/^\s*>/.test(raw)) take('transition', raw.match(/^\s*>\s*/)![0])
      else if (
        beforeBlank &&
        afterBlank &&
        /^(INT\.?\/EXT|INT\/EXT|INT|EXT|EST|I\/E)[. ]/i.test(text)
      )
        kind = 'scene'
      else if (beforeBlank && afterBlank && /^[^a-z]*TO:$/.test(text)) kind = 'transition'
      else if (dialogue) kind = /^\(.*\)$/.test(text) ? 'parenthetical' : 'dialogue'
      else if (
        beforeBlank &&
        !afterBlank &&
        /^\p{Lu}[\p{Lu}\p{N}\p{P}\p{Zs}]*(?:\([^)]*\))?\s*\^?$/u.test(text)
      )
        kind = 'character'
      if (kind === 'character') dialogue = true
      else if (!['dialogue', 'parenthetical'].includes(kind)) dialogue = false
    }
    const dual = kind === 'character' && /\s*\^$/.test(value)
    if (dual) {
      suffix = value.match(/\s*\^$/)![0]
      value = value.slice(0, -suffix.length)
    }
    const nodes = inline(value)
    return {
      type: 'screenplay',
      attrs: { kind, prefix, suffix, dual, original: raw, originalContent: JSON.stringify(nodes) },
      ...(nodes.length ? { content: nodes } : {}),
    }
  })
  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'screenplay', attrs: { kind: 'action' } }],
  }
}
export function serializeFountain(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((node) => {
      const nodes = node.content ?? [],
        attrs = node.attrs ?? {}
      if (
        attrs.original !== null &&
        attrs.original !== undefined &&
        attrs.originalContent === JSON.stringify(nodes)
      )
        return attrs.original as string
      const text = renderInline(nodes)
      switch (attrs.kind as ScreenplayKind) {
        case 'scene':
          return `.${text}`
        case 'character':
          return `@${text}${attrs.dual ? ' ^' : ''}`
        case 'transition':
          return `> ${text}`
        case 'centered':
          return `> ${text} <`
        case 'lyric':
          return `~${text}`
        case 'section':
          return `${attrs.prefix?.startsWith('#') ? attrs.prefix : '# '}${text}`
        case 'synopsis':
          return `= ${text}`
        case 'pageBreak':
          return '==='
        case 'blank':
          return text ? `!${text}` : ''
        case 'note':
          return text.startsWith('[[') ? text : `[[${text}]]`
        case 'boneyard':
          return text
        case 'title':
        case 'dialogue':
        case 'parenthetical':
          return text
        default:
          return `!${text}`
      }
    })
    .join('\n')
}
export const Screenplay = Node.create({
  name: 'screenplay',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      kind: { default: 'action' },
      dual: { default: false, rendered: false },
      prefix: { default: '' },
      suffix: { default: '' },
      original: { default: null, rendered: false },
      originalContent: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'p[data-screenplay]',
        getAttrs: (el) => ({ kind: (el as HTMLElement).dataset.screenplay }),
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-screenplay': node.attrs.kind }), 0]
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name !== 'screenplay') return false
        const kind = $from.parent.attrs.kind
        if (!$from.parent.textContent && ['dialogue', 'parenthetical'].includes(kind))
          return this.editor.commands.updateAttributes('screenplay', {
            kind: 'action',
            original: null,
          })
        return this.editor
          .chain()
          .splitBlock()
          .updateAttributes('screenplay', {
            kind: ['character', 'parenthetical', 'dialogue'].includes(kind) ? 'dialogue' : 'action',
            original: null,
            originalContent: null,
          })
          .run()
      },
    }
  },
})
