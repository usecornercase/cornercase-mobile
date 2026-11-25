import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BackSwipe,
  backSwipes,
  CLAIM,
  EDGE,
  FLING,
  HOLD,
  RESTING,
  SHARE,
  translated,
  watchBackSwipe,
  type Watching,
} from './backSwipe'
import { edge } from './edge.svelte'
import { Target } from './touchFakes'
import type { Route } from './router.svelte'
import type { Point } from './terminal/pinch'
import { LEAVE_MS } from './ui/motion'

const WIDTH = 400

const FAR = WIDTH * SHARE

const X = 5

const Y = 300

const pressed = (x = X) => {
  const swipe = new BackSwipe()
  swipe.press(1, [x, Y], 0)
  return swipe
}

const claimed = () => {
  const swipe = pressed()
  swipe.move(1, [X + CLAIM, Y], 20)
  return swipe
}

const moved = (dx: number, dy = 0, at = 20) => pressed().move(1, [X + dx, Y + dy], at)

const flung = (dx: number, liftAt: number) => {
  const swipe = claimed()
  swipe.move(1, [X + CLAIM + dx, Y], 40)
  return swipe.lift(1, liftAt, WIDTH)
}

const STILL = { state: 'cancelled', shift: 0 }

describe('BackSwipe', () => {
  describe('the edge', () => {
    it.each([
      ['at the left side', 0, 'pending'],
      ['at the edge', EDGE, 'pending'],
      ['one pixel past the edge', EDGE + 1, 'cancelled'],
    ])('takes a touch %s', (_, x, state) => {
      expect(new BackSwipe().press(1, [x, Y], 0)).toBe(state)
    })

    it('never claims a touch away from the edge', () => {
      const swipe = pressed(EDGE + 1)
      expect([swipe.move(1, [EDGE + 200, Y], 20), swipe.lift(1, 40, WIDTH)]).toEqual([STILL, 'none'])
    })
  })

  describe('claiming', () => {
    it('waits while the finger moved less than the threshold', () => {
      expect(moved(CLAIM - 1)).toEqual({ state: 'pending', shift: 0 })
    })

    it('claims a finger that moved right as far as the threshold', () => {
      expect(moved(CLAIM)).toEqual({ state: 'claimed', shift: CLAIM })
    })

    it('claims a finger that moved more than twice as far right as down', () => {
      expect(moved(CLAIM, CLAIM / 2 - 1)).toEqual({ state: 'claimed', shift: CLAIM })
    })

    it('waits while the finger has not moved at all', () => {
      expect(moved(0)).toEqual({ state: 'pending', shift: 0 })
    })

    it.each([
      ['down', 0, CLAIM],
      ['up', 0, -CLAIM],
      ['left', -CLAIM, 0],
      ['as much down as right', CLAIM, CLAIM],
      ['more up than right', CLAIM - 1, -CLAIM],
      ['more right than down, but not twice as far', CLAIM, CLAIM - 1],
      ['a little, more right than down but not twice as far', 3, 2],
    ])('cancels a finger that moved %s', (_, dx, dy) => {
      expect(moved(dx, dy)).toEqual(STILL)
    })

    it('stays cancelled once a first move it did not hold goes on to the right', () => {
      const swipe = pressed()
      swipe.move(1, [X + 3, Y + 2], 10)
      expect(swipe.move(1, [X + 30, Y + 20], 20)).toEqual(STILL)
    })

    it('stays cancelled when the finger turns right', () => {
      const swipe = pressed()
      swipe.move(1, [X, Y + CLAIM], 20)
      expect(swipe.move(1, [X + 100, Y + CLAIM], 40)).toEqual(STILL)
    })
  })

  describe('the shift', () => {
    it('follows the finger once claimed', () => {
      expect(claimed().move(1, [X + 60, Y + 30], 40)).toEqual({ state: 'claimed', shift: 60 })
    })

    it('is never negative', () => {
      expect(claimed().move(1, [0, Y], 40)).toEqual({ state: 'claimed', shift: 0 })
    })
  })

  describe('holding the page', () => {
    const after = (...moves: Point[]) => {
      const swipe = pressed()
      moves.forEach((point, at) => swipe.move(1, point, 10 * (at + 1)))
      return swipe.holds
    }

    it.each([
      ['a touch that has not moved', false, []],
      ['a waiting finger that moved right', true, [[X + 1, Y]]],
      ['a waiting finger that moved more than twice as far right as down', true, [[X + 3, Y + 1]]],
      ['a waiting finger that moved twice as far right as up', false, [[X + 2, Y - 1]]],
      ['a waiting finger that moved more right than down, but not twice as far', false, [[X + 3, Y + 2]]],
      ['a waiting finger that moved down', false, [[X, Y + 1]]],
      ['a waiting finger that moved as much down as right', false, [[X + 1, Y + 1]]],
      ['a waiting finger that moved left', false, [[X - 1, Y]]],
      ['a claimed finger that turns down', true, [[X + CLAIM, Y], [X, Y + 100]]],
      ['a cancelled finger that turns right', false, [[X, Y + CLAIM], [X + 100, Y + CLAIM]]],
    ] as [string, boolean, Point[]][])('for %s is %s', (_, holds, moves) => {
      expect(after(...moves)).toBe(holds)
    })

    it('never holds for a touch away from the edge', () => {
      const swipe = pressed(EDGE + 1)
      swipe.move(1, [EDGE + 2, Y], 10)
      expect(swipe.holds).toBe(false)
    })

    it('lets go once the finger lifts', () => {
      const swipe = claimed()
      swipe.lift(1, 40, WIDTH)
      expect(swipe.holds).toBe(false)
    })

    it('starts again from the next touch', () => {
      const swipe = pressed()
      swipe.move(1, [X + 1, Y], 10)
      swipe.lift(1, 20, WIDTH)
      swipe.press(1, [X, Y], 30)
      expect(swipe.holds).toBe(false)
    })
  })

  describe('a finger that stays still', () => {
    it('can still claim at the end of the wait', () => {
      expect(moved(CLAIM, 0, HOLD).state).toBe('claimed')
    })

    it.each([
      ['claims at the end of a wait counted from the touch', HOLD, 'claimed'],
      ['cancels after a wait counted from the touch', HOLD + 1, 'cancelled'],
    ])('%s', (_, wait, state) => {
      const swipe = new BackSwipe()
      swipe.press(1, [X, Y], 1000)
      expect(swipe.move(1, [X + CLAIM, Y], 1000 + wait).state).toBe(state)
    })

    it('cancels after the wait', () => {
      expect(moved(CLAIM, 0, HOLD + 1)).toEqual(STILL)
    })

    it('is a tap when it lifts by the end of the wait', () => {
      expect(pressed().lift(1, HOLD, WIDTH)).toBe('tap')
    })

    it('is nothing when it lifts after the wait', () => {
      expect(pressed().lift(1, HOLD + 1, WIDTH)).toBe('none')
    })

    it('keeps the claim when it rests after claiming', () => {
      expect(claimed().move(1, [X + 30, Y], HOLD + 500)).toEqual({ state: 'claimed', shift: 30 })
    })
  })

  describe('lifting', () => {
    it('is a tap where the finger touched', () => {
      expect(pressed().lift(1, 50, WIDTH)).toBe('tap')
    })

    it('is a tap after a move below the threshold', () => {
      const swipe = pressed()
      swipe.move(1, [X + CLAIM - 1, Y], 20)
      expect(swipe.lift(1, 40, WIDTH)).toBe('tap')
    })

    it('goes back past the share of the width', () => {
      const swipe = claimed()
      swipe.move(1, [X + FAR, Y], 2000)
      expect(swipe.lift(1, 4000, WIDTH)).toBe('back')
    })

    it('settles short of the share of the width', () => {
      const swipe = claimed()
      swipe.move(1, [X + FAR - 1, Y], 2000)
      expect(swipe.lift(1, 4000, WIDTH)).toBe('settle')
    })

    it.each([
      ['goes back with a fling as fast as the limit', 20, 'back'],
      ['settles with a fling slower than the limit', 21, 'settle'],
    ])('%s', (_, pause, ending) => {
      expect(flung(FLING * 20, 20 + pause)).toBe(ending)
    })

    it('measures the fling from the move before the last', () => {
      const swipe = pressed()
      swipe.move(1, [X + CLAIM, Y], 200)
      swipe.move(1, [X + 2 * CLAIM, Y], 210)
      expect(swipe.lift(1, 200 + CLAIM / FLING, WIDTH)).toBe('back')
    })

    it.each([
      ['goes back', 0, 'back'],
      ['settles', 1, 'settle'],
    ])('measures the first move from the touch, so it %s', (_, late, ending) => {
      const swipe = new BackSwipe()
      swipe.press(1, [EDGE, Y], 100)
      swipe.move(1, [EDGE + CLAIM, Y], 110)
      expect(swipe.lift(1, 100 + CLAIM / FLING + late, WIDTH)).toBe(ending)
    })

    it('settles a fling to the left', () => {
      expect(flung(-CLAIM, 41)).toBe('settle')
    })

    it('is nothing for a finger it never saw', () => {
      expect(claimed().lift(9, 40, WIDTH)).toBe('none')
    })

    it('lets the next touch start again', () => {
      const swipe = claimed()
      swipe.lift(1, 40, WIDTH)
      swipe.press(2, [X, Y], 100)
      expect(swipe.move(2, [X + CLAIM, Y], 120)).toEqual({ state: 'claimed', shift: CLAIM })
    })
  })

  describe('a second finger', () => {
    it('cancels a waiting touch', () => {
      const swipe = pressed()
      expect([swipe.press(2, [X, Y], 10), swipe.move(1, [X + CLAIM, Y], 20)]).toEqual(['cancelled', STILL])
    })

    it('cancels a claimed touch', () => {
      const swipe = claimed()
      swipe.press(2, [200, Y], 30)
      expect(swipe.move(1, [X + 60, Y], 40)).toEqual(STILL)
    })

    it('leaves nothing to lift', () => {
      const swipe = claimed()
      swipe.press(2, [200, Y], 30)
      expect([swipe.lift(2, 40, WIDTH), swipe.lift(1, 50, WIDTH)]).toEqual(['none', 'none'])
    })

    it('lets a new touch start once both lift', () => {
      const swipe = pressed()
      swipe.press(2, [200, Y], 10)
      swipe.lift(2, 20, WIDTH)
      swipe.lift(1, 30, WIDTH)
      expect(swipe.press(3, [X, Y], 40)).toBe('pending')
    })
  })

  describe('cancel', () => {
    it('stops a claimed touch', () => {
      const swipe = claimed()
      swipe.cancel()
      expect([swipe.move(1, [X + 60, Y], 40), swipe.lift(1, 50, WIDTH)]).toEqual([STILL, 'none'])
    })

    it('forgets the fingers it had', () => {
      const swipe = claimed()
      swipe.cancel()
      expect(swipe.press(2, [X, Y], 40)).toBe('pending')
    })
  })

  it('ignores a finger it never saw', () => {
    const swipe = pressed()
    expect([swipe.move(9, [X + 100, Y], 20), swipe.move(1, [X + CLAIM, Y], 30)]).toEqual([
      { state: 'pending', shift: 0 },
      { state: 'claimed', shift: CLAIM },
    ])
  })
})

const watched = (options: Partial<Watching> = {}) => {
  const target = new Target()
  const seen: unknown[] = []
  let prevented = 0
  const stop = watchBackSwipe(target, {
    enabled: () => true,
    width: () => WIDTH,
    reduced: () => false,
    onshift: (shift) => seen.push(shift),
    onback: () => seen.push('back'),
    ...options,
  })
  const touch = (name: string, x: number, at: number, id = 1, y = Y) =>
    target.fire(name, {
      changedTouches: [{ identifier: id, clientX: x, clientY: y }],
      timeStamp: at,
      preventDefault: () => prevented++,
    })
  return { target, seen, stop, touch, prevented: () => prevented }
}

const dragged = (dx: number, options: Partial<Watching> = {}) => {
  const watch = watched(options)
  watch.touch('touchstart', X, 0)
  watch.touch('touchmove', X + CLAIM, 20)
  watch.touch('touchmove', X + dx, 2000)
  return watch
}

const lifted = (dx: number, options: Partial<Watching> = {}) => {
  const watch = dragged(dx, options)
  watch.seen.length = 0
  watch.touch('touchend', X + dx, 4000)
  return watch
}

const SETTLED = { x: 0, eased: true }

const LEFT = { x: WIDTH, eased: true }

describe('watchBackSwipe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    edge.state = 'idle'
  })

  describe('listening', () => {
    it('listens to the touches in capture, holding the moves as not passive', () => {
      const { target } = watched()
      expect(target.options()).toEqual({
        touchstart: { capture: true },
        touchmove: { capture: true, passive: false },
        touchend: { capture: true },
        touchcancel: { capture: true },
        pointercancel: { capture: true },
      })
    })

    it('stops listening when stopped', () => {
      const { target, stop } = watched()
      stop()
      expect(target.listeners.size).toBe(0)
    })
  })

  describe('the shared edge', () => {
    it.each([
      ['waits on a touch at the edge', EDGE, 'pending'],
      ['stays idle on a touch past the edge', EDGE + 1, 'idle'],
    ])('%s', (_, x, state) => {
      watched().touch('touchstart', x, 0)
      expect(edge.state).toBe(state)
    })

    it('is claimed once the finger moves right far enough', () => {
      dragged(CLAIM)
      expect(edge.state).toBe('claimed')
    })

    it('goes back to idle when a still touch lifts as a tap, moving nothing', () => {
      const { touch, seen } = watched()
      touch('touchstart', X, 0)
      touch('touchend', X, 50)
      expect([edge.state, seen]).toEqual(['idle', []])
    })

    it('stays idle while it is not enabled, moving nothing', () => {
      const { touch, seen, prevented } = dragged(60, { enabled: () => false })
      touch('touchend', X + 60, 4000)
      expect([edge.state, seen, prevented()]).toEqual(['idle', [], 0])
    })
  })

  describe('the page', () => {
    it('stops scrolling from the first move right, before the claim', () => {
      const { touch, prevented } = watched()
      touch('touchstart', X, 0)
      touch('touchmove', X + 1, 10)
      const waiting = prevented()
      touch('touchmove', X + CLAIM, 20)
      expect([waiting, prevented()]).toEqual([1, 2])
    })

    it('lets the page scroll for a finger at the edge that moves down', () => {
      const { touch, prevented } = watched()
      touch('touchstart', X, 0)
      touch('touchmove', X, 10, 1, Y + 1)
      touch('touchmove', X, 20, 1, Y + CLAIM)
      expect([prevented(), edge.state]).toEqual([0, 'idle'])
    })

    it('never stops scrolling for a touch past the edge', () => {
      const { touch, prevented } = watched()
      touch('touchstart', EDGE + 1, 0)
      touch('touchmove', EDGE + 100, 20)
      expect(prevented()).toBe(0)
    })

    it('follows the claimed finger without easing', () => {
      expect(dragged(60).seen).toEqual([
        { x: CLAIM, eased: false },
        { x: 60, eased: false },
      ])
    })
  })

  describe('lifting', () => {
    it('finishes leaving with the motion and then goes back once', () => {
      const { seen } = lifted(FAR)
      const leaving = [...seen]
      vi.advanceTimersByTime(LEAVE_MS)
      vi.runAllTimers()
      expect([leaving, seen, edge.state]).toEqual([[LEFT], [LEFT, RESTING, 'back'], 'idle'])
    })

    it('waits for the motion before going back', () => {
      const { seen } = lifted(FAR)
      vi.advanceTimersByTime(LEAVE_MS - 1)
      expect(seen).toEqual([LEFT])
    })

    it('settles back with the motion short of the threshold', () => {
      const { seen } = lifted(FAR - 1)
      vi.runAllTimers()
      expect([seen, edge.state]).toEqual([[SETTLED], 'idle'])
    })

    it('takes no new touch while it leaves', () => {
      const { touch } = lifted(FAR)
      touch('touchstart', X, 4010, 2)
      expect(edge.state).toBe('idle')
    })

    it.each(['touchmove', 'touchend', 'touchcancel', 'pointercancel'])(
      'never brings the screen back on a %s while it leaves',
      (name) => {
        const { touch, seen } = lifted(FAR)
        touch(name, X + 10, 4010, 2)
        vi.runAllTimers()
        expect([seen, edge.state]).toEqual([[LEFT, RESTING, 'back'], 'idle'])
      },
    )

    it('takes touches again once it went back', () => {
      const { touch } = lifted(FAR)
      vi.runAllTimers()
      touch('touchstart', X, 5000, 2)
      expect(edge.state).toBe('pending')
    })
  })

  describe('with Reduce Motion', () => {
    const reduced = { reduced: () => true }

    it('moves nothing while the finger drags', () => {
      expect(dragged(60, reduced).seen).toEqual([])
    })

    it('goes back at once past the threshold', () => {
      expect(lifted(FAR, reduced).seen).toEqual(['back'])
    })

    it('does nothing short of the threshold', () => {
      const { seen } = lifted(FAR - 1, reduced)
      vi.runAllTimers()
      expect(seen).toEqual([])
    })
  })

  describe('cancelling', () => {
    it.each(['touchcancel', 'pointercancel'])('settles back at once on a %s, following and going back never', (name) => {
      const { touch, seen } = dragged(60)
      seen.length = 0
      touch(name, X + 60, 2010)
      const settled = [[...seen], edge.state]
      touch('touchmove', X + FAR, 2015)
      touch('touchend', X + FAR, 2020)
      vi.runAllTimers()
      expect([settled, seen, edge.state]).toEqual([[[SETTLED], 'idle'], [SETTLED], 'idle'])
    })

    it('settles back when a second finger comes', () => {
      const { touch, seen } = dragged(60)
      seen.length = 0
      touch('touchstart', 200, 2010, 2)
      expect([seen, edge.state]).toEqual([[SETTLED], 'idle'])
    })

    it('puts the page back at once when stopped mid-drag', () => {
      const { stop, seen } = dragged(60)
      seen.length = 0
      stop()
      expect([seen, edge.state]).toEqual([[RESTING], 'idle'])
    })

    it('never goes back when stopped while leaving', () => {
      const { stop, seen } = lifted(FAR)
      stop()
      vi.runAllTimers()
      expect(seen).toEqual([LEFT, RESTING])
    })
  })
})

describe('backSwipes', () => {
  const below: Route = { name: 'home' }

  it.each([
    ['on iOS over another screen', 'ios', below, false, true],
    ['on iOS on the first screen', 'ios', null, false, false],
    ['on Android', 'android', below, false, false],
    ['on iOS in two panes, whose detail does not start at the edge', 'ios', below, true, false],
  ] as const)('%s', (_, on, under, split, swipes) => {
    expect(backSwipes(on, under, split)).toBe(swipes)
  })
})

describe('translated', () => {
  it.each([
    ['moves a shifted page right', { x: 12, eased: false }, 'translateX(12px)'],
    ['leaves a page at rest alone', RESTING, undefined],
  ])('%s', (_, shift, transform) => {
    expect(translated(shift)).toBe(transform)
  })
})
