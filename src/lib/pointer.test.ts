import { describe, expect, it } from 'vitest'
import { points, watchPointer } from './pointer'
import { Target } from './touchFakes'

describe('points', () => {
  it.each([
    ['a mouse that moves', false, 'pointermove', 'mouse', true],
    ['a mouse that presses', false, 'pointerdown', 'mouse', true],
    ['a pen that moves', false, 'pointermove', 'pen', true],
    ['a finger that touches', true, 'pointerdown', 'touch', false],
    ['a finger that moves', true, 'pointermove', 'touch', true],
    ['a finger that moves with no pointer before', false, 'pointermove', 'touch', false],
    ['a mouse that lifts', false, 'pointerup', 'mouse', false],
    ['an unknown pointer', true, 'pointerdown', '', true],
  ])('after %s', (_, before, type, pointerType, after) => {
    expect(points(before, { type, pointerType })).toBe(after)
  })
})

describe('watchPointer', () => {
  const watched = () => {
    const target = new Target()
    const marks: boolean[] = []
    const stop = watchPointer(target, (on) => marks.push(on))
    const fire = (type: string, pointerType: string) => target.fire(type, { type, pointerType })
    return { target, marks, stop, fire }
  }

  it('listens to moves and presses in capture, passively', () => {
    expect(watched().target.options()).toEqual({
      pointermove: { capture: true, passive: true },
      pointerdown: { capture: true, passive: true },
    })
  })

  it('marks the pointer on, then off at the next finger, only on a change', () => {
    const { marks, fire } = watched()
    fire('pointermove', 'mouse')
    fire('pointermove', 'mouse')
    fire('pointermove', 'touch')
    fire('pointerdown', 'touch')
    fire('pointerdown', 'touch')
    expect(marks).toEqual([true, false])
  })

  it('stops listening when stopped', () => {
    const { target, stop } = watched()
    stop()
    expect(target.listeners.size).toBe(0)
  })
})
