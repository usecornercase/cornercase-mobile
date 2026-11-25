export type Box = Pick<DOMRect, 'left' | 'top' | 'bottom'>

export type Size = { width: number; height: number }

export type Spot = { left: number; top: number }

export const MARGIN = 12

const within = (value: number, size: number, room: number, margin: number) =>
  Math.max(margin, Math.min(value, room - size - margin))

export const placed = (anchor: Box, size: Size, viewport: Size, margin = MARGIN): Spot => {
  const fitsBelow = anchor.bottom + size.height + margin <= viewport.height
  const top = fitsBelow ? anchor.bottom : anchor.top - size.height
  return {
    left: within(anchor.left, size.width, viewport.width, margin),
    top: within(top, size.height, viewport.height, margin),
  }
}
