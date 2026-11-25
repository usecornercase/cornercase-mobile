import type { IconName } from './ui/icons/shapes'

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type KeyName = 'esc' | 'tab' | 'up' | 'down' | 'left' | 'right' | 'enter' | 'ctrl+c' | Digit

export type KeyButton = { label: string; name: string; key: KeyName; icon?: IconName }

export const ROW: readonly KeyButton[] = [
  { label: 'Esc', name: 'Escape', key: 'esc' },
  { label: 'Tab', name: 'Tab', key: 'tab' },
  { label: '↑', name: 'Up', key: 'up', icon: 'arrow-up' },
  { label: '↓', name: 'Down', key: 'down', icon: 'arrow-down' },
  { label: '←', name: 'Left', key: 'left', icon: 'arrow-left' },
  { label: '→', name: 'Right', key: 'right', icon: 'arrow-right' },
  { label: 'Enter', name: 'Enter', key: 'enter' },
  { label: 'Ctrl-C', name: 'Ctrl-C', key: 'ctrl+c' },
]

const DIGITS: readonly Digit[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export const DIGIT_ROW: readonly KeyButton[] = DIGITS.map((digit) => ({ label: digit, name: digit, key: digit }))

export const digitOf = (number: number): Digit | null => DIGITS.find((digit) => digit === String(number)) ?? null

type Pressing = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'isComposing'>

export const sendsOn = (event: Pressing) => event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing

type Sendable = { readonly canSend: boolean; send: () => Promise<unknown> }

export const sendOnKey = (event: Pressing & Pick<Event, 'preventDefault'>, chat: Sendable) => {
  if (!sendsOn(event)) {
    return
  }
  event.preventDefault()
  if (chat.canSend) {
    void chat.send()
  }
}
