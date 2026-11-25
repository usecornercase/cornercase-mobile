import type { Key_Deserialize } from '../bindings'
import { pasted, physical, type InputEvent, type Pressed, type StickyCtrl } from './keys'

export const SENTINEL = ' '

export type Keydown = Pressed & Pick<KeyboardEvent, 'isComposing' | 'keyCode'>

const PROCESSED_BY_IME = 229

export type Typed = Pick<globalThis.InputEvent, 'inputType' | 'data' | 'isComposing'> & {
  dataTransfer: Pick<DataTransfer, 'getData'> | null
}

export type Step = { send: InputEvent[]; prevent: boolean; restore: boolean }

const PASSED: Step = { send: [], prevent: false, restore: false }

const SWALLOWED: Step = { send: [], prevent: true, restore: true }

const KEYS = new Map<string, Key_Deserialize>([
  ['insertLineBreak', { code: 'enter' }],
  ['insertParagraph', { code: 'enter' }],
  ['deleteContentBackward', { code: 'backspace' }],
  ['deleteWordBackward', { code: 'backspace', mods: ['alt'] }],
])

const INSERTS = new Set(['insertText', 'insertReplacementText'])

const composed = (typed: Typed) => typed.isComposing || typed.inputType.includes('Composition')

const carried = (typed: Typed) => typed.data ?? typed.dataTransfer?.getData('text/plain') ?? ''

const typedAlone = (pressed: Keydown): InputEvent | null =>
  !pressed.metaKey && !pressed.ctrlKey && [...pressed.key].length === 1 ? { text: pressed.key } : null

const inserted = (typed: Typed): InputEvent | null => {
  if (typed.inputType === 'insertFromPaste') return pasted(carried(typed))
  if (!INSERTS.has(typed.inputType)) return null
  const text = carried(typed)
  return text === '' ? null : { text }
}

export class Typing {
  readonly #ctrl: StickyCtrl
  #composing = false
  #pressed: string | undefined

  constructor(ctrl: StickyCtrl) {
    this.#ctrl = ctrl
  }

  keydown(pressed: Keydown): Step {
    this.#pressed = undefined
    if (this.#processing(pressed)) return PASSED
    const event = physical(pressed)
    if (event === null) return PASSED
    if ('key' in event) this.#pressed = event.key?.code
    return this.#sent([event])
  }

  stray(pressed: Keydown): Step {
    if (this.#processing(pressed)) return PASSED
    const event = physical(pressed) ?? typedAlone(pressed)
    return event === null ? PASSED : this.#sent([event])
  }

  keyup() {
    this.#pressed = undefined
  }

  beforeinput(typed: Typed): Step {
    const pressed = this.#pressed
    this.#pressed = undefined
    if (this.#composing || composed(typed)) return PASSED
    const key = KEYS.get(typed.inputType)
    if (key !== undefined) return key.code === pressed ? SWALLOWED : this.#sent([{ key }])
    const event = inserted(typed)
    return event === null ? SWALLOWED : this.#sent([event])
  }

  compositionstart() {
    this.#composing = true
  }

  compositionend(data: string): Step {
    this.#composing = false
    return { send: data === '' ? [] : this.#ctrl.apply([{ text: data }]), prevent: false, restore: true }
  }

  #processing(pressed: Keydown) {
    return this.#composing || pressed.isComposing || pressed.keyCode === PROCESSED_BY_IME
  }

  #sent(events: InputEvent[]): Step {
    return { send: this.#ctrl.apply(events), prevent: true, restore: true }
  }
}
