import { describe, expect, it } from 'vitest'
import { Layout, splits, twoPanes, WIDE, type Sized } from './layout.svelte'

class FakeWindow implements Sized {
  innerWidth?: number
  #listeners = new Map<string, Set<() => void>>()

  constructor(width?: number) {
    this.innerWidth = width
  }

  addEventListener(name: string, listener: () => void) {
    this.#listeners.set(name, (this.#listeners.get(name) ?? new Set()).add(listener))
  }

  removeEventListener(name: string, listener: () => void) {
    this.#listeners.get(name)?.delete(listener)
  }

  resize(width: number) {
    this.innerWidth = width
    for (const listener of this.#listeners.get('resize') ?? []) listener()
  }

  get listening() {
    return [...this.#listeners.values()].reduce((count, listeners) => count + listeners.size, 0)
  }
}

describe('twoPanes', () => {
  it.each([
    [WIDE - 1, false],
    [WIDE, true],
    [1376, true],
    [390, false],
  ])('at %i px is %s', (width, wide) => {
    expect(twoPanes(width)).toBe(wide)
  })
})

describe('splits', () => {
  it.each([
    ['a wide window over the board', true, 'home', false, true],
    ['a narrow window', false, 'home', false, false],
    ['a window with no machine', true, 'no-machines', false, false],
    ['a full-width terminal', true, 'home', true, false],
  ] as const)('%s: %s', (_, wide, base, full, split) => {
    expect(splits(wide, base, full)).toBe(split)
  })
})

describe('Layout', () => {
  it('is narrow and not full until watched', () => {
    const layout = new Layout()
    expect([layout.wide, layout.full]).toEqual([false, false])
  })

  it('reads the width as soon as it watches', () => {
    const layout = new Layout()
    layout.watch(new FakeWindow(WIDE))
    expect(layout.wide).toBe(true)
  })

  it('follows the window as it resizes', () => {
    const layout = new Layout()
    const screen = new FakeWindow(WIDE)
    layout.watch(screen)
    screen.resize(WIDE - 1)
    expect(layout.wide).toBe(false)
  })

  it('stops following once stopped', () => {
    const layout = new Layout()
    const screen = new FakeWindow(WIDE - 1)
    const stop = layout.watch(screen)
    stop()
    screen.resize(WIDE)
    expect([layout.wide, screen.listening]).toEqual([false, 0])
  })

  it('is narrow without a width', () => {
    const layout = new Layout()
    layout.watch(new FakeWindow())
    expect(layout.wide).toBe(false)
  })

  it('toggles the full-width terminal', () => {
    const layout = new Layout()
    layout.toggleFull()
    const on = layout.full
    layout.toggleFull()
    expect([on, layout.full]).toEqual([true, false])
  })
})
