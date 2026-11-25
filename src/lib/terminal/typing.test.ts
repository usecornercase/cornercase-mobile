import { describe, expect, it } from 'vitest'
import { StickyCtrl } from './keys'
import { SENTINEL, Typing, type Keydown, type Typed } from './typing'

const press = (key: string, held: Partial<Keydown> = {}): Keydown => ({
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  isComposing: false,
  keyCode: 0,
  ...held,
})

const typed = (inputType: string, data: string | null = null, held: Partial<Typed> = {}): Typed => ({
  inputType,
  data,
  isComposing: false,
  dataTransfer: null,
  ...held,
})

const carrying = (text: string) => ({ dataTransfer: { getData: (format: string) => (format === 'text/plain' ? text : '') } })

const typing = () => new Typing(new StickyCtrl())

const armed = () => {
  const ctrl = new StickyCtrl()
  ctrl.toggle()
  return { ctrl, typing: new Typing(ctrl) }
}

const sent = (...send: unknown[]) => ({ send, prevent: true, restore: true })

const passed = { send: [], prevent: false, restore: false }

const swallowed = { send: [], prevent: true, restore: true }

describe('SENTINEL', () => {
  it('leaves a character in the field for a delete to remove', () => {
    expect(SENTINEL).toHaveLength(1)
  })
})

describe('beforeinput', () => {
  it.each([
    ['a typed key', 'insertText', 'a'],
    ['a prediction', 'insertText', 'hello '],
    ['a replacement', 'insertReplacementText', 'world'],
  ])('sends %s as text', (_, inputType, data) => {
    expect(typing().beforeinput(typed(inputType, data))).toEqual(sent({ text: data }))
  })

  it('reads a replacement carried by its data transfer', () => {
    const replaced = typed('insertReplacementText', null, carrying('word'))
    expect(typing().beforeinput(replaced)).toEqual(sent({ text: 'word' }))
  })

  it.each([
    ['a line break', 'insertLineBreak', 'enter'],
    ['a paragraph', 'insertParagraph', 'enter'],
    ['a delete', 'deleteContentBackward', 'backspace'],
  ])('sends %s as the key %s', (_, inputType, code) => {
    expect(typing().beforeinput(typed(inputType))).toEqual(sent({ key: { code } }))
  })

  it('sends a word delete as Alt+Backspace, which deletes the word before the cursor in a shell', () => {
    const step = typing().beforeinput(typed('deleteWordBackward'))
    expect(step).toEqual(sent({ key: { code: 'backspace', mods: ['alt'] } }))
  })

  it('sends a delete with the field left at its sentinel', () => {
    const input = typing()
    input.beforeinput(typed('deleteContentBackward'))
    expect(input.beforeinput(typed('deleteContentBackward'))).toEqual(sent({ key: { code: 'backspace' } }))
  })

  it('sends a native paste as a paste', () => {
    expect(typing().beforeinput(typed('insertFromPaste', 'ls -la\n'))).toEqual(sent({ paste: 'ls -la\n' }))
  })

  it('reads a native paste carried by its data transfer', () => {
    expect(typing().beforeinput(typed('insertFromPaste', null, carrying('pwd')))).toEqual(sent({ paste: 'pwd' }))
  })

  it.each([
    ['an empty paste', typed('insertFromPaste', null, carrying(''))],
    ['an empty insert', typed('insertText', '')],
    ['an insert without data', typed('insertText')],
    ['a drop', typed('insertFromDrop', 'file')],
  ])('swallows %s and sends nothing', (_, event) => {
    expect(typing().beforeinput(event)).toEqual(swallowed)
  })

  it.each([
    ['composition text', typed('insertCompositionText', 'に')],
    ['an insert while composing', typed('insertText', 'に', { isComposing: true })],
  ])('lets %s through', (_, event) => {
    expect(typing().beforeinput(event)).toEqual(passed)
  })
})

describe('stray', () => {
  it.each([
    ['a letter', 'a', {}, { text: 'a' }],
    ['a capital', 'A', { shiftKey: true }, { text: 'A' }],
    ['a space', ' ', {}, { text: ' ' }],
    ['an accented letter', 'é', { altKey: true }, { text: 'é' }],
    ['Ctrl+C', 'c', { ctrlKey: true }, { key: { code: 'c', mods: ['ctrl'] } }],
    ['Tab', 'Tab', {}, { key: { code: 'tab' } }],
    ['Shift+Tab', 'Tab', { shiftKey: true }, { key: { code: 'tab', mods: ['shift'] } }],
    ['Escape', 'Escape', {}, { key: { code: 'esc' } }],
    ['an arrow', 'ArrowUp', {}, { key: { code: 'up' } }],
    ['Enter', 'Enter', {}, { key: { code: 'enter' } }],
  ] as const)('sends %s', (_, key, held, event) => {
    expect(typing().stray(press(key, held))).toEqual(sent(event))
  })

  it.each([
    ['Cmd+V, the system\'s', 'v', { metaKey: true }],
    ['Cmd+Tab', 'Tab', { metaKey: true }],
    ['a dead key', 'Dead', {}],
    ['a bare modifier', 'Shift', { shiftKey: true }],
    ['Ctrl alone', 'Control', { ctrlKey: true }],
    ['a key in a composition', 'a', { isComposing: true }],
    ['a key the input method processes', 'a', { keyCode: 229 }],
  ] as const)('passes %s', (_, key, held) => {
    expect(typing().stray(press(key, held))).toEqual(passed)
  })

  it('passes a key while a composition is open', () => {
    const input = typing()
    input.compositionstart()
    expect(input.stray(press('a'))).toEqual(passed)
  })

  it('sends a letter with the sticky Ctrl, which it releases', () => {
    const { ctrl, typing } = armed()
    expect(typing.stray(press('c'))).toEqual(sent({ key: { code: 'c', mods: ['ctrl'] } }))
    expect(ctrl.armed).toBe(false)
  })
})

describe('keydown', () => {
  it.each([
    ['Enter', 'enter'],
    ['Backspace', 'backspace'],
    ['ArrowUp', 'up'],
    ['Escape', 'esc'],
    ['Tab', 'tab'],
  ])('sends %s as the key %s', (key, code) => {
    expect(typing().keydown(press(key))).toEqual(sent({ key: { code } }))
  })

  it('sends Ctrl+c of a hardware keyboard', () => {
    expect(typing().keydown(press('c', { ctrlKey: true }))).toEqual(sent({ key: { code: 'c', mods: ['ctrl'] } }))
  })

  it.each([
    ['a letter', press('a')],
    ['a shortcut', press('v', { metaKey: true })],
    ['a key while composing', press('Enter', { isComposing: true })],
  ])('lets %s through', (_, pressed) => {
    expect(typing().keydown(pressed)).toEqual(passed)
  })
})

describe('Enter and delete', () => {
  it.each([
    ['Enter', 'insertLineBreak'],
    ['Enter', 'insertParagraph'],
    ['Backspace', 'deleteContentBackward'],
  ])('are sent once when %s comes with %s', (key, inputType) => {
    const input = typing()
    const steps = [input.keydown(press(key)), input.beforeinput(typed(inputType))]
    expect(steps.flatMap(({ send }) => send)).toHaveLength(1)
  })

  it('swallows the line break of an Enter already sent', () => {
    const input = typing()
    input.keydown(press('Enter'))
    expect(input.beforeinput(typed('insertLineBreak'))).toEqual(swallowed)
  })

  it('sends a later line break that no key sent', () => {
    const input = typing()
    input.keydown(press('Enter'))
    input.beforeinput(typed('insertText', 'a'))
    expect(input.beforeinput(typed('insertLineBreak'))).toEqual(sent({ key: { code: 'enter' } }))
  })

  it('sends a line break after a key that was not Enter', () => {
    const input = typing()
    input.keydown(press('Backspace'))
    expect(input.beforeinput(typed('insertLineBreak'))).toEqual(sent({ key: { code: 'enter' } }))
  })

  it('swallows the word delete of an Alt+Backspace already sent', () => {
    const input = typing()
    input.keydown(press('Backspace', { altKey: true }))
    expect(input.beforeinput(typed('deleteWordBackward'))).toEqual(swallowed)
  })

  it('sends a line break that follows the key let go, as one the Enter never made', () => {
    const input = typing()
    input.keydown(press('Enter'))
    input.keyup()
    expect(input.beforeinput(typed('insertParagraph'))).toEqual(sent({ key: { code: 'enter' } }))
  })

  it('sends each of two Enters pressed in a row', () => {
    const input = typing()
    const steps = [input.keydown(press('Enter')), input.keydown(press('Enter'))]
    expect(steps.flatMap(({ send }) => send)).toEqual([{ key: { code: 'enter' } }, { key: { code: 'enter' } }])
  })
})

describe('composition', () => {
  const composing = () => {
    const input = typing()
    input.compositionstart()
    return input
  }

  it('sends nothing while it lasts', () => {
    const input = composing()
    const steps = [
      input.keydown(press('Enter')),
      input.beforeinput(typed('insertCompositionText', 'にほ')),
      input.beforeinput(typed('insertLineBreak')),
    ]
    expect(steps).toEqual([passed, passed, passed])
  })

  it('sends the final text once when it ends and restores the field', () => {
    expect(composing().compositionend('日本')).toEqual({ send: [{ text: '日本' }], prevent: false, restore: true })
  })

  it('sends nothing for a cancelled composition but restores the field', () => {
    expect(composing().compositionend('')).toEqual({ send: [], prevent: false, restore: true })
  })

  it('takes keys again once it ends', () => {
    const input = composing()
    input.compositionend('日本')
    expect(input.keydown(press('Enter'))).toEqual(sent({ key: { code: 'enter' } }))
  })
})

describe('an Android keyboard', () => {
  const ime = (key = 'Unidentified') => press(key, { keyCode: 229 })

  it.each([
    ['an unidentified key', ime()],
    ['a named key the keyboard is still processing', ime('Enter')],
  ])('lets the keydown of %s through', (_, pressed) => {
    expect(typing().keydown(pressed)).toEqual(passed)
  })

  it.each([
    ['a typed character', typed('insertText', 'a'), sent({ text: 'a' })],
    ['a delete', typed('deleteContentBackward'), sent({ key: { code: 'backspace' } })],
    ['a line break', typed('insertLineBreak'), sent({ key: { code: 'enter' } })],
  ])('sends %s that follows an unidentified keydown', (_, event, step) => {
    const input = typing()
    input.keydown(ime())
    expect(input.beforeinput(event)).toEqual(step)
  })

  it('sends a word typed character by character, one character at a time', () => {
    const input = typing()
    const steps = [...'ls'].flatMap((character) => [
      input.keydown(ime()),
      input.beforeinput(typed('insertText', character)),
    ])
    expect(steps.flatMap(({ send }) => send)).toEqual([{ text: 'l' }, { text: 's' }])
  })

  it('sends a composed word once, when it ends, and restores the field', () => {
    const input = typing()
    input.keydown(ime())
    input.compositionstart()
    const steps = ['l', 'ls'].flatMap((data) => [
      input.keydown(ime()),
      input.beforeinput(typed('insertCompositionText', data, { isComposing: true })),
    ])
    expect([...steps, input.compositionend('ls')]).toEqual([
      passed,
      passed,
      passed,
      passed,
      { send: [{ text: 'ls' }], prevent: false, restore: true },
    ])
  })

  it('sends nothing for a word deleted while it was composed', () => {
    const input = typing()
    input.compositionstart()
    input.beforeinput(typed('insertCompositionText', 'l', { isComposing: true }))
    input.beforeinput(typed('insertCompositionText', '', { isComposing: true }))
    expect(input.compositionend('')).toEqual({ send: [], prevent: false, restore: true })
  })

  it('sends a delete that comes after an empty composition', () => {
    const input = typing()
    input.compositionstart()
    input.compositionend('')
    input.keydown(ime())
    expect(input.beforeinput(typed('deleteContentBackward'))).toEqual(sent({ key: { code: 'backspace' } }))
  })

  it('sends each delete with the field left at its sentinel and no keydown before it', () => {
    const input = typing()
    const steps = [input.beforeinput(typed('deleteContentBackward')), input.beforeinput(typed('deleteContentBackward'))]
    expect(steps.flatMap(({ send }) => send)).toEqual([{ key: { code: 'backspace' } }, { key: { code: 'backspace' } }])
  })

  it('sends one Enter for its keydown and its line break', () => {
    const input = typing()
    const steps = [input.keydown(press('Enter', { keyCode: 13 })), input.beforeinput(typed('insertLineBreak'))]
    expect(steps).toEqual([sent({ key: { code: 'enter' } }), swallowed])
  })

  it('sends a composed word and then the Enter that ended it', () => {
    const input = typing()
    input.compositionstart()
    input.beforeinput(typed('insertCompositionText', 'ls', { isComposing: true }))
    const steps = [input.compositionend('ls'), input.keydown(press('Enter', { keyCode: 13 }))]
    expect(steps.flatMap(({ send }) => send)).toEqual([{ text: 'ls' }, { key: { code: 'enter' } }])
  })
})

describe('sticky ctrl', () => {
  it('applies to a typed character', () => {
    expect(armed().typing.beforeinput(typed('insertText', 'c'))).toEqual(sent({ key: { code: 'c', mods: ['ctrl'] } }))
  })

  it('applies only to the first character of a prediction', () => {
    const step = armed().typing.beforeinput(typed('insertText', 'cat '))
    expect(step).toEqual(sent({ key: { code: 'c', mods: ['ctrl'] } }, { text: 'at ' }))
  })

  it('applies to a key of a hardware keyboard', () => {
    expect(armed().typing.keydown(press('ArrowLeft'))).toEqual(sent({ key: { code: 'left', mods: ['ctrl'] } }))
  })

  it('applies to the final text of a composition', () => {
    const { typing: input } = armed()
    input.compositionstart()
    expect(input.compositionend('d').send).toEqual([{ key: { code: 'd', mods: ['ctrl'] } }])
  })

  it('lets go after the key it applied to', () => {
    const { ctrl, typing: input } = armed()
    input.beforeinput(typed('insertText', 'c'))
    expect([ctrl.armed, input.beforeinput(typed('insertText', 'c'))]).toEqual([false, sent({ text: 'c' })])
  })

  it('stays armed through keys that send nothing', () => {
    const { ctrl, typing: input } = armed()
    input.keydown(press('Control', { ctrlKey: true }))
    input.beforeinput(typed('insertFromDrop', 'file'))
    expect(ctrl.armed).toBe(true)
  })
})
