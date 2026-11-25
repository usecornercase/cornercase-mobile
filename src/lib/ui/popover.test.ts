import { describe, expect, it } from 'vitest'
import { cycled, MARGIN, placed } from './popover'

const VIEW = { width: 1024, height: 768 }

const CARD = { width: 360, height: 200 }

const at = (left: number, top: number, height = 44) => ({ left, top, bottom: top + height })

describe('placed', () => {
  it('sits under its anchor, left-aligned to it', () => {
    expect(placed(at(100, 300), CARD, VIEW)).toEqual({ left: 100, top: 344 })
  })

  it('sits under its anchor when it fits by the margin exactly', () => {
    const top = VIEW.height - MARGIN - CARD.height - 44
    expect(placed(at(100, top), CARD, VIEW)).toEqual({ left: 100, top: top + 44 })
  })

  it('goes above its anchor when there is no room below', () => {
    expect(placed(at(100, 600), CARD, VIEW)).toEqual({ left: 100, top: 400 })
  })

  it('stays inside the right edge by the margin', () => {
    expect(placed(at(900, 300), CARD, VIEW).left).toBe(VIEW.width - CARD.width - MARGIN)
  })

  it('stays inside the bottom and top edges by the margin', () => {
    expect(placed(at(100, 150, 600), CARD, VIEW).top).toBe(MARGIN)
  })

  it('keeps a card larger than the window at the margin', () => {
    expect(placed(at(100, 300), { width: 2000, height: 1000 }, VIEW)).toEqual({ left: MARGIN, top: MARGIN })
  })

  it('takes another margin', () => {
    expect(placed(at(0, 0), CARD, VIEW, 24)).toEqual({ left: 24, top: 44 })
  })
})

describe('cycled', () => {
  const BUTTONS = ['cancel', 'close']

  it.each([
    ['moves forward', 'cancel', false, 'close'],
    ['wraps forward past the last', 'close', false, 'cancel'],
    ['moves back', 'close', true, 'cancel'],
    ['wraps back past the first', 'cancel', true, 'close'],
    ['starts at the first from outside', null, false, 'cancel'],
    ['starts at the last from outside, going back', null, true, 'close'],
    ['starts at the first from an element it does not hold', 'dialog', false, 'cancel'],
  ])('%s', (_, current, back, next) => {
    expect(cycled(BUTTONS, current, back)).toBe(next)
  })

  it('gives nothing with nothing to focus', () => {
    expect(cycled([], null, false)).toBeUndefined()
  })
})
