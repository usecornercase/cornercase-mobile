import { listening, type Listened } from './backSwipe'

export type Pointed = { type: string; pointerType: string }

const FINE = new Set(['mouse', 'pen'])

const MARKING = new Set(['pointermove', 'pointerdown'])

export const points = (before: boolean, { type, pointerType }: Pointed) => {
  if (FINE.has(pointerType) && MARKING.has(type)) return true
  if (pointerType === 'touch' && type === 'pointerdown') return false
  return before
}

export const watchPointer = (target: Listened, mark: (on: boolean) => void) => {
  let on = false
  const heard = (event: Event) => {
    const next = points(on, event as PointerEvent)
    if (next !== on) {
      on = next
      mark(on)
    }
  }
  const options = { capture: true, passive: true }
  return listening(target, [
    ['pointermove', heard, options],
    ['pointerdown', heard, options],
  ])
}
