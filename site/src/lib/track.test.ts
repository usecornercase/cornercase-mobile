import { describe, expect, it } from 'vitest'
import { freeArea, placeKeys, pose, poseAt, slide, transformOf, travel } from './track'
import type { Key, Pose, Rect } from './track'

const box = { width: 400, height: 839 }

function edges(p: Pose) {
  const halfWidth = (box.width * p.scale) / 2
  const halfHeight = (box.height * p.scale) / 2
  return { left: p.cx - halfWidth, right: p.cx + halfWidth, top: p.cy - halfHeight, bottom: p.cy + halfHeight }
}

function inside(p: Pose, [x, y, w, h]: Rect) {
  const e = edges(p)
  return e.left >= x - 0.01 && e.right <= x + w + 0.01 && e.top >= y - 0.01 && e.bottom <= y + h + 0.01
}

describe('a wide screen', () => {
  it('puts a phone that goes right whole inside its area, right of the caption', () => {
    const area = freeArea('right', 1440, 900)
    const right = pose({ free: 'right' }, box, 1440, 900)
    expect(inside(right, area)).toBe(true)
    expect(edges(right).left).toBeGreaterThanOrEqual(Math.max(380, 1440 * 0.36))
  })

  it('mirrors it for a phone that goes left', () => {
    const left = pose({ free: 'left' }, box, 1440, 900)
    const right = pose({ free: 'right' }, box, 1440, 900)
    expect(inside(left, freeArea('left', 1440, 900))).toBe(true)
    expect(edges(left).right).toBeLessThanOrEqual(1440 - Math.max(380, 1440 * 0.36))
    expect(left.scale).toBeCloseTo(right.scale)
  })

  it('puts a phone that has the screen in its middle', () => {
    const p = pose({ free: 'screen' }, box, 1440, 900)
    expect(p.cx).toBe(720)
    expect(inside(p, freeArea('screen', 1440, 900))).toBe(true)
  })
})

describe('a narrow screen', () => {
  const area = freeArea('left', 390, 844)

  it('gives both sides the same area, above the caption sheet', () => {
    expect(freeArea('right', 390, 844)).toEqual(area)
    expect(area[1] + area[3]).toBeLessThanOrEqual(844 - Math.min(844 * 0.42, 320))
  })

  it('makes the phone wider than most of the area, so its text reads', () => {
    const p = pose({ free: 'left' }, box, 390, 844)
    expect(box.width * p.scale).toBeGreaterThan(area[2] * 0.78)
  })

  it('puts the top of the phone at the top of the area at focus 0, and moves it up as the focus grows', () => {
    const top = (focus: number) => edges(pose({ free: 'left', focus }, box, 390, 844)).top
    expect(top(0)).toBeCloseTo(area[1])
    expect(top(0.5)).toBeLessThan(top(0))
    expect(top(0.9)).toBeLessThan(top(0.5))
  })

  it('centres a phone shorter than its area', () => {
    const tall = 4000
    const p = pose({ free: 'right', focus: 0 }, box, 390, tall)
    const [, y, , h] = freeArea('right', 390, tall)
    expect(p.cy).toBeCloseTo(y + h / 2)
  })
})

describe('pose', () => {
  it.each([
    [900, 120],
    [1440, 60],
    [390, 90],
  ])('keeps the scale above 0 at %d × %d', (width, height) => {
    for (const free of ['screen', 'left', 'right'] as const) {
      expect(pose({ free }, box, width, height).scale).toBeGreaterThan(0)
    }
  })

  it('moves by fractions of the viewport and keeps the turn and the fade', () => {
    const still = pose({ free: 'screen' }, box, 1000, 800)
    const moved = pose({ free: 'screen', dx: 0.1, dy: 0.5, rx: 30, fade: 0 }, box, 1000, 800)
    expect(moved.cx - still.cx).toBeCloseTo(100)
    expect(moved.cy - still.cy).toBeCloseTo(400)
    expect(moved.rx).toBe(30)
    expect(moved.fade).toBe(0)
    expect(still.fade).toBe(1)
  })
})

describe('poseAt', () => {
  const keys: Key[] = [
    { at: 200, shot: { free: 'screen', rx: 20 } },
    { at: 0, shot: { free: 'screen', rx: 40 } },
    { at: 100, shot: { free: 'screen', rx: 0 } },
  ]
  const placed = placeKeys(keys, box, 1440, 900)

  it('holds the first and the last poses beyond the ends', () => {
    expect(poseAt(placed, -50).rx).toBe(40)
    expect(poseAt(placed, 500).rx).toBe(20)
  })

  it('passes through every key, whatever their order', () => {
    expect(poseAt(placed, 0).rx).toBe(40)
    expect(poseAt(placed, 100).rx).toBe(0)
    expect(poseAt(placed, 200).rx).toBe(20)
  })

  it('blends between two keys', () => {
    expect(poseAt(placed, 50).rx).toBeCloseTo(20)
  })

  it('needs keys', () => {
    expect(() => poseAt([], 0)).toThrow('a track needs keys')
  })
})

describe('transformOf', () => {
  it('writes no rotation for a pose that does not turn', () => {
    const p = { cx: 300, cy: 500, scale: 0.5, rx: 0, ry: 0, rz: 0, fade: 1 }
    expect(transformOf(p, box)).toBe('translate3d(100.00px,80.50px,0) scale(0.5000)')
  })

  it('turns a pose that does, about its centre', () => {
    const p = { cx: 200, cy: 419.5, scale: 1, rx: 10, ry: -3, rz: 0, fade: 1 }
    expect(transformOf(p, box)).toBe(
      'translate3d(0.00px,0.00px,0) scale(1.0000) rotateX(10.00deg) rotateY(-3.00deg) rotateZ(0.00deg)',
    )
  })
})

describe('travel', () => {
  const marks: [number, number][] = [
    [100, 200],
    [300, 400],
  ]

  it('counts the pushes done', () => {
    expect(travel(marks, 0)).toBe(0)
    expect(travel(marks, 250)).toBe(1)
    expect(travel(marks, 500)).toBe(2)
  })

  it('rises through a push', () => {
    expect(travel(marks, 150)).toBeCloseTo(0.5)
    expect(travel(marks, 120)).toBeLessThan(travel(marks, 180))
  })
})

describe('slide', () => {
  function expectSlide(index: number, travelled: number, shown: boolean, x: number, dim: number) {
    const s = slide(index, travelled)
    expect(s.shown).toBe(shown)
    expect(s.x).toBeCloseTo(x)
    expect(s.dim).toBeCloseTo(dim)
  }

  it('shows the current screen in place and undimmed, and hides the next one', () => {
    expectSlide(0, 0, true, 0, 0)
    expectSlide(1, 0, false, 0, 0)
  })

  it('slides the next one in over the last, which moves left and dims', () => {
    expectSlide(1, 0.5, true, 50, 0)
    expectSlide(0, 0.5, true, -15, 0.25)
  })

  it('hides a screen two away', () => {
    expectSlide(0, 2, false, 0, 0)
    expectSlide(3, 1, false, 0, 0)
  })
})
