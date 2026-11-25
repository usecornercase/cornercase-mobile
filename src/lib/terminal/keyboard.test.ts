import { describe, expect, it, vi } from 'vitest'
import { GAP, isField, Keyboard, seen, whileClosed, type Screen, type Viewport } from './keyboard.svelte'

const WIDTH = 411

const FULL = 900

const KEYBOARD = 340

class Target {
  #listeners = new Map<string, Set<() => void>>()

  addEventListener(name: string, listener: () => void) {
    this.#listeners.set(name, (this.#listeners.get(name) ?? new Set()).add(listener))
  }

  removeEventListener(name: string, listener: () => void) {
    this.#listeners.get(name)?.delete(listener)
  }

  fire(name: string) {
    for (const listener of this.#listeners.get(name) ?? []) listener()
  }

  get listening() {
    return [...this.#listeners.values()].reduce((count, listeners) => count + listeners.size, 0)
  }
}

class FakeViewport extends Target implements Viewport {
  height = FULL
  offsetTop = 0
}

class FakeScreen extends Target implements Screen {
  innerWidth = WIDTH
  innerHeight = FULL
  visualViewport: FakeViewport | null

  constructor(viewport: FakeViewport | null = new FakeViewport()) {
    super()
    this.visualViewport = viewport
  }
}

const watched = (screen = new FakeScreen()) => {
  const field = { focused: true }
  const keyboard = new Keyboard(screen, () => field.focused)
  const stop = keyboard.watch()
  return { screen, viewport: screen.visualViewport ?? new FakeViewport(), keyboard, stop, field }
}

const shown = ({ height, offset, covered, open }: Keyboard) => ({ height, offset, covered, open })

describe('Keyboard', () => {
  it('reads the visible height as soon as it watches', () => {
    expect(shown(watched().keyboard)).toEqual({ height: FULL, offset: 0, covered: false, open: false })
  })

  it('follows the keyboard as it opens', () => {
    const { viewport, keyboard } = watched()
    viewport.height = FULL - KEYBOARD
    viewport.fire('resize')
    expect(shown(keyboard)).toEqual({ height: FULL - KEYBOARD, offset: 0, covered: true, open: true })
  })

  it('follows the offset when the page scrolls under it', () => {
    const { viewport, keyboard } = watched()
    viewport.offsetTop = 120
    viewport.fire('scroll')
    expect(keyboard.offset).toBe(120)
  })

  it('goes back to the full height as the keyboard closes', () => {
    const { viewport, keyboard } = watched()
    viewport.height = FULL - KEYBOARD
    viewport.fire('resize')
    viewport.height = FULL
    viewport.fire('resize')
    expect(shown(keyboard)).toEqual({ height: FULL, offset: 0, covered: false, open: false })
  })

  it('follows a turn of the screen', () => {
    const { screen, viewport, keyboard } = watched()
    screen.innerWidth = FULL
    screen.innerHeight = 400
    viewport.height = 400
    screen.fire('resize')
    expect(shown(keyboard)).toEqual({ height: 400, offset: 0, covered: false, open: false })
  })

  it('takes the full height without a visual viewport', () => {
    const { screen, keyboard } = watched(new FakeScreen(null))
    screen.innerHeight = 700
    screen.fire('resize')
    expect(shown(keyboard)).toEqual({ height: 700, offset: 0, covered: false, open: false })
  })

  it('stops listening once it is unmounted', () => {
    const { screen, viewport, stop } = watched()
    stop()
    expect([screen.listening, viewport.listening]).toEqual([0, 0])
  })

  it('stays where it was after it is unmounted', () => {
    const { viewport, keyboard, stop } = watched()
    stop()
    viewport.height = FULL - KEYBOARD
    viewport.fire('resize')
    expect(keyboard.height).toBe(FULL)
  })
})

describe('Keyboard where the page shrinks with it, as on Android', () => {
  const shrunk = ({ screen, viewport }: ReturnType<typeof watched>, height: number, width = WIDTH) => {
    screen.innerWidth = width
    screen.innerHeight = height
    viewport.height = height
    screen.fire('resize')
    viewport.fire('resize')
  }

  it('calls the keyboard open as the page shrinks above it', () => {
    const watching = watched()
    shrunk(watching, FULL - KEYBOARD)
    expect(shown(watching.keyboard)).toEqual({ height: FULL - KEYBOARD, offset: 0, covered: true, open: true })
  })

  it('calls the keyboard closed as the page takes the full height again', () => {
    const watching = watched()
    shrunk(watching, FULL - KEYBOARD)
    shrunk(watching, FULL)
    expect(shown(watching.keyboard)).toEqual({ height: FULL, offset: 0, covered: false, open: false })
  })

  it('starts again from the height after a turn of the screen', () => {
    const watching = watched()
    shrunk(watching, 400, FULL)
    expect(shown(watching.keyboard)).toEqual({ height: 400, offset: 0, covered: false, open: false })
  })

  it('calls the keyboard open after a turn of the screen', () => {
    const watching = watched()
    shrunk(watching, 400, FULL)
    shrunk(watching, 400 - KEYBOARD / 2, FULL)
    expect(watching.keyboard.open).toBe(true)
  })

  it('reads a page that shrinks with no field focused as a smaller screen, as a split screen does', () => {
    const watching = watched()
    watching.field.focused = false
    shrunk(watching, FULL - KEYBOARD)
    expect(shown(watching.keyboard)).toEqual({ height: FULL - KEYBOARD, offset: 0, covered: false, open: false })
  })

  it('calls the keyboard closed once the field loses the focus, though the page stays short', () => {
    const watching = watched()
    shrunk(watching, FULL - KEYBOARD)
    watching.field.focused = false
    shrunk(watching, FULL - KEYBOARD)
    expect(watching.keyboard.open).toBe(false)
  })

  it('drops the size asked for while the keyboard is open', () => {
    const watching = watched()
    const then = vi.fn()
    const fitted = whileClosed(watching.keyboard, then)
    shrunk(watching, FULL - KEYBOARD)
    fitted(31)
    shrunk(watching, FULL)
    fitted(50)
    expect(then.mock.calls).toEqual([[50]])
  })
})

describe('seen', () => {
  const screen = (height: number): Screen => {
    const viewport = new FakeViewport()
    viewport.height = height
    return new FakeScreen(viewport)
  }

  it.each([
    ['open once the visible height is short of the screen by more than the gap', FULL - GAP - 1, true],
    ['closed while the visible height is short of the screen by the gap', FULL - GAP, false],
  ])('calls the keyboard %s', (_, height, open) => {
    expect(seen(screen(height)).open).toBe(open)
  })

  it.each([
    ['covered by a bar shorter than the gap, as a hardware keyboard shows', FULL - GAP, true],
    ['covered by the keyboard', FULL - GAP - 1, true],
    ['uncovered at the full height', FULL, false],
  ])('calls the screen %s', (_, height, covered) => {
    expect(seen(screen(height)).covered).toBe(covered)
  })

  it('keeps the tallest page seen at the same width', () => {
    const shrunk = screen(FULL - KEYBOARD)
    shrunk.innerHeight = FULL - KEYBOARD
    expect(seen(shrunk, { width: WIDTH, height: FULL })).toMatchObject({
      open: true,
      tallest: { width: WIDTH, height: FULL },
    })
  })

  it('forgets the tallest page once the width changes', () => {
    expect(seen(screen(FULL), { width: FULL, height: 2 * FULL })).toMatchObject({
      open: false,
      tallest: { width: WIDTH, height: FULL },
    })
  })

  it('takes a taller page as the new tallest', () => {
    expect(seen(screen(FULL), { width: WIDTH, height: FULL - KEYBOARD }).tallest).toEqual({ width: WIDTH, height: FULL })
  })
})

describe('isField', () => {
  const element = (field: boolean) => ({ matches: (selector: string) => field && selector === 'textarea, input, [contenteditable]' })

  it.each([
    ['a text field', element(true), true],
    ['a button', element(false), false],
    ['no target', null, false],
    ['a target that is no element', {}, false],
  ])('is %s: %s', (_, target, field) => {
    expect(isField(target as unknown as EventTarget)).toBe(field)
  })
})

describe('whileClosed', () => {
  it.each([
    ['passes a value on while the keyboard is closed', false, [[7]]],
    ['drops a value while the keyboard is open', true, []],
  ])('%s', (_, open, calls) => {
    const then = vi.fn()
    whileClosed({ open }, then)(7)
    expect(then.mock.calls).toEqual(calls)
  })
})
