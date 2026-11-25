import { describe, expect, it } from 'vitest'
import { backOut, clamp, damp, easeExpo, easeInOut, easeOut, mix, span } from './math'

describe('clamp', () => {
  it.each([
    [-1, 0],
    [0.4, 0.4],
    [2, 1],
  ])('keeps %d between 0 and 1 as %d', (value, expected) => {
    expect(clamp(value)).toBe(expected)
  })

  it('takes its own bounds', () => {
    expect(clamp(5, 10, 20)).toBe(10)
    expect(clamp(25, 10, 20)).toBe(20)
  })
})

describe('mix', () => {
  it('goes from one value to the other', () => {
    expect(mix(10, 20, 0)).toBe(10)
    expect(mix(10, 20, 0.25)).toBe(12.5)
    expect(mix(10, 20, 1)).toBe(20)
  })
})

describe('span', () => {
  it('gives the progress through a span, held at its ends', () => {
    expect(span(5, 10, 20)).toBe(0)
    expect(span(15, 10, 20)).toBe(0.5)
    expect(span(25, 10, 20)).toBe(1)
  })

  it('steps at a span of no length', () => {
    expect(span(9, 10, 10)).toBe(0)
    expect(span(10, 10, 10)).toBe(1)
  })
})

describe('the easings', () => {
  it.each([
    ['easeOut', easeOut, 0.875],
    ['easeExpo', easeExpo, 1 - 2 ** -5],
    ['easeInOut', easeInOut, 0.5],
    ['backOut', backOut, 1 - 2.2 / 8 + 1.2 / 4],
  ])('%s starts at 0, ends at 1 and passes the middle at the right height', (_, ease, middle) => {
    expect(ease(0)).toBeCloseTo(0)
    expect(ease(0.5)).toBeCloseTo(middle)
    expect(ease(1)).toBe(1)
  })

  it('clamps what is out of range', () => {
    expect(easeOut(-1)).toBe(0)
    expect(easeInOut(2)).toBe(1)
  })
})

describe('damp', () => {
  it('moves towards its target and reaches it in time', () => {
    const step = damp(0, 10, 9, 0.016)
    expect(step).toBeGreaterThan(0)
    expect(step).toBeLessThan(10)
    let value = 0
    for (let frame = 0; frame < 300; frame += 1) value = damp(value, 10, 9, 0.016)
    expect(value).toBeCloseTo(10)
  })
})
