import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { ShownCtrl } from './ctrl.svelte'
import Typist from './Typist.svelte'
import typistSource from './Typist.svelte?raw'
import { Typing, type Step } from './typing'

const typist = (disabled = false) =>
  render(Typist, { props: { ctrl: new ShownCtrl(), send: () => {}, disabled } }).body

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('Typist', () => {
  it('is a plain field that holds the sentinel', () => {
    expect(typist()).toMatch(
      /<textarea class="typist svelte-[\w-]+" aria-label="Terminal input" rows="1" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"> <\/textarea>/,
    )
  })

  it('is disabled on a closed tab', () => {
    expect(typist(true)).toMatch(/<textarea [^>]*disabled=""/)
  })

  it('can be focused from a tap without scrolling the page', () => {
    expect(typistSource).toContain('export const focus = () => textarea?.focus({ preventScroll: true })')
    expect(typistSource).toContain('bind:this={textarea}')
  })

  it('takes a key pressed off any field: it focuses the field first, then sends what Typing makes of it', () => {
    expect(flat(typistSource)).toContain(
      'export const take = (event: KeyboardEvent) => { focus() run(event, typing.stray(event)) }',
    )
  })

  it('sends nothing on a closed tab', () => {
    expect(typistSource).toContain('if (!disabled && step.send.length > 0) send(step.send)')
  })

  it.each([
    'onkeydown={(event) => run(event, typing.keydown(event))}',
    'onkeyup={() => typing.keyup()}',
    'onbeforeinput={(event) => run(event, typing.beforeinput(event))}',
    'oncompositionstart={() => typing.compositionstart()}',
    'oncompositionend={(event) => run(event, typing.compositionend(event.data))}',
  ])('leaves its events to Typing: %s', (text) => {
    expect(typistSource).toContain(text)
  })

  it('puts the sentinel back with the caret after it', () => {
    expect(flat(typistSource)).toContain(
      'field.value = SENTINEL field.setSelectionRange(SENTINEL.length, SENTINEL.length)',
    )
  })

  it.each(['font-size: 16px;', 'opacity: 0;', 'caret-color: transparent;', 'user-select: text;'])(
    'holds %s',
    (text) => {
      expect(flat(typistSource)).toContain(text)
    },
  )

  it('cancels an event only when Typing says so', () => {
    expect(typistSource).toContain('if (step.prevent) event.preventDefault()')
  })
})

type Fired =
  | ['keydown', string, number]
  | ['keyup']
  | ['beforeinput', string, string | null]
  | ['compositionstart']
  | ['compositionend', string]

const BOARD: Fired[] = [
  ...[...'ls '].flatMap((data): Fired[] => [
    ['keydown', 'Unidentified', 229],
    ['beforeinput', 'insertText', data],
    ['keyup'],
  ]),
  ['keydown', 'Backspace', 8],
  ['keyup'],
  ['keydown', 'Unidentified', 229],
  ['compositionstart'],
  ['beforeinput', 'insertCompositionText', '-'],
  ['beforeinput', 'insertCompositionText', '-a'],
  ['compositionend', '-a'],
  ['keyup'],
  ['keydown', 'Enter', 229],
  ['beforeinput', 'insertLineBreak', null],
  ['keyup'],
  ['keydown', 'Enter', 13],
  ['keyup'],
]

const replayed = (fired: Fired[]) => {
  const typing = new Typing(new ShownCtrl())
  const step = (event: Fired): Step | null => {
    if (event[0] === 'keydown') {
      const [, key, keyCode] = event
      const held = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, isComposing: false }
      return typing.keydown({ key, keyCode, ...held })
    }
    if (event[0] === 'beforeinput') {
      const [, inputType, data] = event
      return typing.beforeinput({ inputType, data, isComposing: inputType.includes('Composition'), dataTransfer: null })
    }
    if (event[0] === 'compositionend') return typing.compositionend(event[1])
    if (event[0] === 'compositionstart') typing.compositionstart()
    else typing.keyup()
    return null
  }
  return fired.map((event) => ({ event: event.slice(0, 2).join(' '), step: step(event) }))
}

describe('Typist with an Android keyboard: GBoard on the emulator, a composition and a processed Enter', () => {
  const steps = replayed(BOARD)

  it('sends each character, the delete, the composition and each of its two Enters once, in order', () => {
    expect(steps.flatMap(({ step }) => step?.send ?? [])).toEqual([
      { text: 'l' },
      { text: 's' },
      { text: ' ' },
      { key: { code: 'backspace' } },
      { text: '-a' },
      { key: { code: 'enter' } },
      { key: { code: 'enter' } },
    ])
  })

  it('cancels no keydown the keyboard is still processing, so its input still comes', () => {
    const processing = steps.filter((_, at) => {
      const fired = BOARD[at]
      return fired[0] === 'keydown' && fired[2] === 229
    })
    expect(processing.map(({ step }) => step?.prevent)).toEqual([false, false, false, false, false])
  })

  it('cancels no input of a composition, which the WebView cannot cancel', () => {
    const composing = steps.filter(({ event }) => event === 'beforeinput insertCompositionText')
    expect(composing.map(({ step }) => step?.prevent)).toEqual([false, false])
  })
})
