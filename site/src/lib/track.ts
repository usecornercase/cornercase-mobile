import { easeInOut, mix, span } from './math'

export const WIDE_SCREEN = 980
export const SHORTEST_SCREEN = 480

const TOP = 76
const LEAST_ROOM = 40
const LARGEST = 1.15
const NARROW_FILL = 0.86

export type Free = 'screen' | 'left' | 'right'
export type Rect = [number, number, number, number]

export interface Box {
  width: number
  height: number
}

export interface Shot {
  free: Free
  focus?: number
  zoom?: number
  rx?: number
  ry?: number
  rz?: number
  dx?: number
  dy?: number
  fade?: number
}

export interface Key {
  at: number
  shot: Shot
}

export interface Pose {
  cx: number
  cy: number
  scale: number
  rx: number
  ry: number
  rz: number
  fade: number
}

export interface PlacedKey {
  at: number
  pose: Pose
}

export interface Slide {
  shown: boolean
  x: number
  dim: number
}

function captionWidth(width: number): number {
  return Math.max(380, width * 0.36)
}

function sheetHeight(height: number): number {
  return Math.min(height * 0.42, 320)
}

export function freeArea(free: Free, width: number, height: number): Rect {
  const wide = width >= WIDE_SCREEN
  const margin = wide ? 24 : 16
  const tall = Math.max(LEAST_ROOM, height - TOP - margin)
  if (free === 'screen') return [margin, TOP, width - margin * 2, tall]
  if (!wide) return [margin, TOP, width - margin * 2, Math.max(LEAST_ROOM, tall - sheetHeight(height))]
  const caption = captionWidth(width)
  const across = width - caption - margin
  return free === 'right' ? [caption, TOP, across, tall] : [margin, TOP, across, tall]
}

function narrowCentre(area: Rect, tall: number, focus: number): number {
  const centred = area[1] + area[3] / 2
  if (tall <= area[3]) return centred
  return Math.min(centred + (0.5 - focus) * tall, area[1] + tall / 2)
}

function fitScale(area: Rect, box: Box, side: boolean): number {
  if (side) return Math.min((area[2] * NARROW_FILL) / box.width, LARGEST)
  return Math.min(area[3] / box.height, area[2] / box.width, LARGEST)
}

function turnOf(shot: Shot): Pick<Pose, 'rx' | 'ry' | 'rz' | 'fade'> {
  return { rx: shot.rx ?? 0, ry: shot.ry ?? 0, rz: shot.rz ?? 0, fade: shot.fade ?? 1 }
}

export function pose(shot: Shot, box: Box, width: number, height: number): Pose {
  const area = freeArea(shot.free, width, height)
  const side = width < WIDE_SCREEN && shot.free !== 'screen'
  const scale = fitScale(area, box, side) * (shot.zoom ?? 1)
  const cy = side ? narrowCentre(area, box.height * scale, shot.focus ?? 0.5) : area[1] + area[3] / 2
  return {
    cx: area[0] + area[2] / 2 + (shot.dx ?? 0) * width,
    cy: cy + (shot.dy ?? 0) * height,
    scale,
    ...turnOf(shot),
  }
}

export function blend(a: Pose, b: Pose, amount: number): Pose {
  return {
    cx: mix(a.cx, b.cx, amount),
    cy: mix(a.cy, b.cy, amount),
    scale: a.scale * (b.scale / a.scale) ** amount,
    rx: mix(a.rx, b.rx, amount),
    ry: mix(a.ry, b.ry, amount),
    rz: mix(a.rz, b.rz, amount),
    fade: mix(a.fade, b.fade, amount),
  }
}

export function placeKeys(keys: Key[], box: Box, width: number, height: number): PlacedKey[] {
  return [...keys].sort((a, b) => a.at - b.at).map((key) => ({ at: key.at, pose: pose(key.shot, box, width, height) }))
}

function around(keys: PlacedKey[], at: number): [PlacedKey, PlacedKey] {
  let low = 0
  let high = keys.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if ((keys[middle] as PlacedKey).at <= at) low = middle
    else high = middle
  }
  return [keys[low] as PlacedKey, keys[high] as PlacedKey]
}

export function poseAt(keys: PlacedKey[], at: number): Pose {
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) throw new Error('a track needs keys')
  if (at <= first.at) return { ...first.pose }
  if (at >= last.at) return { ...last.pose }
  const [a, b] = around(keys, at)
  return blend(a.pose, b.pose, easeInOut((at - a.at) / (b.at - a.at)))
}

function turn(p: Pose): string {
  if (p.rx === 0 && p.ry === 0 && p.rz === 0) return ''
  return ` rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg)`
}

export function transformOf(p: Pose, box: Box): string {
  const x = (p.cx - box.width / 2).toFixed(2)
  const y = (p.cy - box.height / 2).toFixed(2)
  return `translate3d(${x}px,${y}px,0) scale(${p.scale.toFixed(4)})${turn(p)}`
}

export function travel(marks: [number, number][], now: number): number {
  return marks.reduce((sum, [from, to]) => sum + easeInOut(span(now, from, to)), 0)
}

export function slide(index: number, travelled: number): Slide {
  const d = index - travelled
  if (d >= 1 || d <= -1) return { shown: false, x: 0, dim: 0 }
  if (d > 0) return { shown: true, x: d * 100, dim: 0 }
  return { shown: true, x: d * 30, dim: -d * 0.5 }
}
