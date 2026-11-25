import { edge, type Edge } from './edge.svelte'
import type { Platform } from './platform'
import type { Route } from './router.svelte'
import type { Point } from './terminal/pinch'
import { LEAVE_MS } from './ui/motion'

export const EDGE = 20

export const CLAIM = 10

export const SHARE = 0.35

export const FLING = 0.5

export const HOLD = 300

export const LEAN = 2

export type EdgeState = 'pending' | 'claimed' | 'cancelled'

export type Step = { state: EdgeState; shift: number }

export type Ending = 'back' | 'settle' | 'tap' | 'none'

type Sample = { x: number; at: number }

export const leans = ([dx, dy]: Point) => dx > LEAN * Math.abs(dy)

const still = ([dx, dy]: Point) => dx === 0 && dy === 0

export const decided = (moved: Point, leaning = leans): EdgeState => {
  if (still(moved)) return 'pending'
  if (!leaning(moved)) return 'cancelled'
  return Math.hypot(...moved) >= CLAIM ? 'claimed' : 'pending'
}

export class BackSwipe {
  #fingers = new Set<number>()
  #state: EdgeState = 'cancelled'
  #from: Point = [0, 0]
  #moved: Point = [0, 0]
  #pressed = 0
  #shift = 0
  #before: Sample = { x: 0, at: 0 }
  #last: Sample = { x: 0, at: 0 }

  press(id: number, point: Point, at: number) {
    this.#fingers.add(id)
    if (this.#fingers.size > 1) return this.#drop()
    this.#state = point[0] <= EDGE ? 'pending' : 'cancelled'
    this.#from = point
    this.#moved = [0, 0]
    this.#pressed = at
    this.#last = { x: point[0], at }
    return this.#state
  }

  move(id: number, [x, y]: Point, at: number): Step {
    if (!this.#fingers.has(id)) return this.#step()
    this.#expire(at)
    const moved: Point = [x - this.#from[0], y - this.#from[1]]
    this.#moved = moved
    if (this.#state === 'pending') this.#state = decided(moved)
    this.#before = this.#last
    this.#last = { x, at }
    this.#shift = this.#state === 'claimed' ? Math.max(0, moved[0]) : 0
    return this.#step()
  }

  lift(id: number, at: number, width: number): Ending {
    if (!this.#fingers.delete(id)) return 'none'
    this.#expire(at)
    const { state, shift } = this.#step()
    this.#drop()
    if (state === 'pending') return 'tap'
    if (state !== 'claimed') return 'none'
    return shift >= width * SHARE || this.#speed(at) >= FLING ? 'back' : 'settle'
  }

  get holds() {
    return this.#state === 'claimed' || (this.#state === 'pending' && leans(this.#moved))
  }

  cancel() {
    this.#fingers.clear()
    this.#drop()
  }

  #drop(): EdgeState {
    this.#state = 'cancelled'
    this.#shift = 0
    return this.#state
  }

  #expire(at: number) {
    if (this.#state === 'pending' && at - this.#pressed > HOLD) this.#drop()
  }

  #speed(at: number) {
    return (this.#last.x - this.#before.x) / (at - this.#before.at)
  }

  #step(): Step {
    return { state: this.#state, shift: this.#shift }
  }
}

export type Shift = { x: number; eased: boolean }

export const RESTING: Shift = { x: 0, eased: false }

export const translated = ({ x }: Shift) => (x > 0 ? `translateX(${x}px)` : undefined)

export const backSwipes = (on: Platform, below: Route | null, split: boolean) => on === 'ios' && below !== null && !split

type Touched = Pick<Touch, 'identifier' | 'clientX' | 'clientY'>

export type Touches = { changedTouches: ArrayLike<Touched>; timeStamp: number; preventDefault(): void }

export type Watching = {
  enabled: () => boolean
  width: () => number
  reduced: () => boolean
  onshift: (shift: Shift) => void
  onback: () => void
}

const EDGES: Record<EdgeState, Edge> = { pending: 'pending', claimed: 'claimed', cancelled: 'idle' }

export const touched = (event: Touches) => Array.from(event.changedTouches)

class Watch {
  #swipe = new BackSwipe()
  #watching: Watching
  #shown = 0
  #leaving: ReturnType<typeof setTimeout> | undefined

  constructor(watching: Watching) {
    this.#watching = watching
  }

  pressed(event: Touches) {
    if (this.#leaving !== undefined || !this.#watching.enabled()) return
    for (const { identifier, clientX, clientY } of touched(event))
      this.#follow({ state: this.#swipe.press(identifier, [clientX, clientY], event.timeStamp), shift: 0 })
  }

  moved(event: Touches) {
    for (const { identifier, clientX, clientY } of touched(event))
      this.#follow(this.#swipe.move(identifier, [clientX, clientY], event.timeStamp))
    if (this.#swipe.holds) event.preventDefault()
  }

  lifted(event: Touches) {
    for (const { identifier } of touched(event))
      this.#end(this.#swipe.lift(identifier, event.timeStamp, this.#watching.width()))
  }

  cancelled() {
    this.#swipe.cancel()
    this.#follow({ state: 'cancelled', shift: 0 })
  }

  stop() {
    clearTimeout(this.#leaving)
    edge.state = 'idle'
    this.#show(0, false)
  }

  #follow({ state, shift }: Step) {
    if (this.#leaving !== undefined) return
    edge.state = EDGES[state]
    if (state === 'cancelled') this.#show(0, true)
    else if (!this.#watching.reduced()) this.#show(shift, false)
  }

  #end(ending: Ending) {
    if (this.#leaving !== undefined) return
    edge.state = 'idle'
    if (ending !== 'back') return this.#show(0, true)
    if (this.#watching.reduced()) return this.#back()
    this.#show(this.#watching.width(), true)
    this.#leaving = setTimeout(() => this.#back(), LEAVE_MS)
  }

  #back() {
    this.#leaving = undefined
    this.#show(0, false)
    this.#watching.onback()
  }

  #show(x: number, eased: boolean) {
    if (x === this.#shown) return
    this.#shown = x
    this.#watching.onshift({ x, eased })
  }
}

export type Listened = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export type Listener = [string, EventListener, AddEventListenerOptions]

export const listening = (target: Listened, listeners: Listener[]) => {
  for (const [name, listener, options] of listeners) target.addEventListener(name, listener, options)
  return () => {
    for (const [name, listener, options] of listeners) target.removeEventListener(name, listener, options)
  }
}

export const watchBackSwipe = (target: Listened, watching: Watching) => {
  const watch = new Watch(watching)
  const stop = listening(target, [
    ['touchstart', (event) => watch.pressed(event as TouchEvent), { capture: true }],
    ['touchmove', (event) => watch.moved(event as TouchEvent), { capture: true, passive: false }],
    ['touchend', (event) => watch.lifted(event as TouchEvent), { capture: true }],
    ['touchcancel', () => watch.cancelled(), { capture: true }],
    ['pointercancel', () => watch.cancelled(), { capture: true }],
  ])
  return () => {
    stop()
    watch.stop()
  }
}
