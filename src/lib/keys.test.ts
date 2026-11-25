import { describe, expect, it, vi } from 'vitest'
import coreKeys from '../../crates/core/src/cli/keys.rs?raw'
import { DIGIT_ROW, ROW, sendOnKey, sendsOn, type KeyButton } from './keys'

const KEY_NAMES = `enter, esc, tab, backspace, space, up, down, left, right, home, end, pageup,
pagedown, delete, insert, f1 to f12 or one character, each after any of ctrl+, alt+ and shift+`

const NAMED = KEY_NAMES.split(/,\s*/).slice(0, 15)

const FUNCTIONS = Array.from({ length: 12 }, (_, index) => `f${index + 1}`)

const MODIFIER = /^(?:ctrl|alt|shift)\+(?=.)/i

const unmodified = (name: string): string => (MODIFIER.test(name) ? unmodified(name.replace(MODIFIER, '')) : name)

const cornercaseKnows = (name: string): boolean => {
  const code = unmodified(name)
  return [...code].length === 1 || [...NAMED, ...FUNCTIONS].includes(code.toLowerCase())
}

const coreNames = (): string[] => {
  const list = coreKeys.match(/const NAMES: \[&str; \d+\] =\s*\[([^\]]*)\]/)?.[1] ?? ''
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

const every = [...ROW, ...DIGIT_ROW]

describe('ROW', () => {
  it.each<[string, KeyButton]>([
    ['Esc', { label: 'Esc', name: 'Escape', key: 'esc' }],
    ['Tab', { label: 'Tab', name: 'Tab', key: 'tab' }],
    ['Up', { label: '↑', name: 'Up', key: 'up', icon: 'arrow-up' }],
    ['Down', { label: '↓', name: 'Down', key: 'down', icon: 'arrow-down' }],
    ['Left', { label: '←', name: 'Left', key: 'left', icon: 'arrow-left' }],
    ['Right', { label: '→', name: 'Right', key: 'right', icon: 'arrow-right' }],
    ['Enter', { label: 'Enter', name: 'Enter', key: 'enter' }],
    ['Ctrl-C', { label: 'Ctrl-C', name: 'Ctrl-C', key: 'ctrl+c' }],
  ])('has %s with its label, accessible name and key', (_, button) => {
    expect(ROW.find(({ key }) => key === button.key)).toEqual(button)
  })

  it('keeps the order of the row', () => {
    expect(ROW.map(({ key }) => key)).toEqual(['esc', 'tab', 'up', 'down', 'left', 'right', 'enter', 'ctrl+c'])
  })
})

describe('DIGIT_ROW', () => {
  it('has the digits as on a keyboard, each named and sent as itself', () => {
    expect(DIGIT_ROW).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => ({ label: digit, name: digit, key: digit })),
    )
  })
})

describe('the keys', () => {
  it('are all names cornercase 0.13.19 takes', () => {
    expect(every.filter(({ key }) => !cornercaseKnows(key))).toEqual([])
  })

  it('are checked against a list that refuses what cornercase refuses', () => {
    expect(['backspaces', 'ctrl+', 'f13', ''].filter(cornercaseKnows)).toEqual([])
  })

  it('are exactly the ones the core lets through', () => {
    expect(every.map(({ key }) => key).sort()).toEqual(coreNames().sort())
  })

  it('are never the same twice', () => {
    expect(new Set(every.map(({ key }) => key)).size).toBe(every.length)
  })
})

const enter = (held: { metaKey?: boolean; ctrlKey?: boolean; isComposing?: boolean } = {}, key = 'Enter') => ({
  key,
  metaKey: false,
  ctrlKey: false,
  isComposing: false,
  preventDefault: vi.fn(),
  ...held,
})

describe('sendsOn', () => {
  it.each([
    ['Cmd+Return', enter({ metaKey: true }), true],
    ['Ctrl+Return', enter({ ctrlKey: true }), true],
    ['Return alone', enter(), false],
    ['Cmd+Return in a composition', enter({ metaKey: true, isComposing: true }), false],
    ['Cmd with another key', enter({ metaKey: true }, 'a'), false],
  ])('%s: %s', (_, event, sends) => {
    expect(sendsOn(event)).toBe(sends)
  })
})

describe('sendOnKey', () => {
  const chat = (canSend: boolean) => ({ canSend, send: vi.fn(() => Promise.resolve()) })

  it('sends on Cmd+Return when it can, holding the line break back', () => {
    const [event, sending] = [enter({ metaKey: true }), chat(true)]
    sendOnKey(event, sending)
    expect([sending.send.mock.calls.length, event.preventDefault.mock.calls.length]).toEqual([1, 1])
  })

  it('sends nothing on Cmd+Return when it cannot, and adds no line either', () => {
    const [event, sending] = [enter({ ctrlKey: true }), chat(false)]
    sendOnKey(event, sending)
    expect([sending.send.mock.calls.length, event.preventDefault.mock.calls.length]).toEqual([0, 1])
  })

  it('leaves Return alone to add a line', () => {
    const [event, sending] = [enter(), chat(true)]
    sendOnKey(event, sending)
    expect([sending.send.mock.calls.length, event.preventDefault.mock.calls.length]).toEqual([0, 0])
  })
})
