import { describe, it, expect } from 'vitest'
import { parseFountain, serializeFountain } from '../../packages/core/src/fountain'
const screenplay =
  'Title: A TEST\nAuthor: Someone\n\n.INT. SOMEWHERE - DAY #3A#\n\nA **bold** and _underlined_ action.\n\nALEX\n(quietly)\nHello there.\n\n@ليلى ^\nمرحبًا.\n\n# Act I\n= Summary\n\n[[A note]]\n\n/*\nDiscarded scene\n*/\n\n~A lyric\n\n> FADE OUT.\n\n> THE END <\n\n===\n'
describe('Fountain source fidelity', () => {
  it('retains title fields, emphasis, forced elements, dual markers and comments', () =>
    expect(serializeFountain(parseFountain(screenplay))).toBe(screenplay))
  it('classifies scene, character, parenthetical and dialogue', () =>
    expect(
      parseFountain('INT. ROOM - DAY\n\nALEX\n(quietly)\nHello.').content?.map(
        (n) => n.attrs?.kind,
      ),
    ).toEqual(['scene', 'blank', 'character', 'parenthetical', 'dialogue']))
  it('uses underline, not italic, for underscore emphasis', () =>
    expect(parseFountain('_underlined_').content?.[0].content?.[0].marks).toEqual([
      { type: 'underline' },
    ]))
  it('preserves original CRLF semantics as LF and intentional spaces', () =>
    expect(serializeFountain(parseFountain('! A line\r\n  \r\nNext\r\n'))).toBe(
      '! A line\n  \nNext\n',
    ))
  it('keeps new or edited action forced, preventing accidental reclassification', () => {
    const doc = parseFountain('LOUD ACTION')
    doc.content![0].content = [{ type: 'text', text: 'ALEX' }]
    expect(serializeFountain(doc)).toBe('!ALEX')
  })
})
