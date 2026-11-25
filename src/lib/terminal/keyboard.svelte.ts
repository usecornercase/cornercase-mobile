import { untrack } from 'svelte'

export const GAP = 100

type Listened = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export type Viewport = Listened & Pick<VisualViewport, 'height' | 'offsetTop'>

export type Screen = Listened & { innerWidth: number; innerHeight: number; visualViewport?: Viewport | null }

export type Tallest = { width: number; height: number }

export type Seen = { height: number; offset: number; covered: boolean; open: boolean; tallest: Tallest }

const tallestAt = ({ innerWidth, innerHeight }: Screen, before?: Tallest): Tallest =>
  before?.width === innerWidth && before.height > innerHeight ? before : { width: innerWidth, height: innerHeight }

export const seen = (screen: Screen, before?: Tallest): Seen => {
  const tallest = tallestAt(screen, before)
  const { innerHeight, visualViewport } = screen
  if (!visualViewport) return { height: innerHeight, offset: 0, covered: false, open: false, tallest }
  const { height, offsetTop } = visualViewport
  const hidden = tallest.height - height
  return { height, offset: offsetTop, covered: hidden > 0, open: hidden > GAP, tallest }
}

const FIELDS = 'textarea, input, [contenteditable]'

const CONTROLS = 'button, a, select, summary, [role="button"]'

const matching = (target: EventTarget | null, selector: string) =>
  (target as Partial<Element> | null)?.matches?.(selector) ?? false

const isField = (target: EventTarget | null) => matching(target, FIELDS)

export type Page = { body: unknown; documentElement: unknown }

export const strays = (
  { target, defaultPrevented }: Pick<Event, 'target' | 'defaultPrevented'>,
  screen: Pick<Node, 'contains'> | null,
  page: Page | undefined = globalThis.document,
) => {
  if (defaultPrevented || matching(target, `${FIELDS}, ${CONTROLS}`)) return false
  if (target === page?.body || target === page?.documentElement) return true
  return screen?.contains(target as Node | null) ?? false
}

const editingNow = () => isField(globalThis.document?.activeElement ?? null)

const listened = (target: Listened, names: string[], listener: () => void) => {
  for (const name of names) target.addEventListener(name, listener)
  return () => {
    for (const name of names) target.removeEventListener(name, listener)
  }
}

export class Keyboard {
  readonly #screen: Screen
  readonly #editing: () => boolean
  #seen: Seen = $state.raw({ height: 0, offset: 0, covered: false, open: false, tallest: { width: 0, height: 0 } })

  constructor(screen: Screen, editing: () => boolean = editingNow) {
    this.#screen = screen
    this.#editing = editing
  }

  get height() {
    return this.#seen.height
  }

  get offset() {
    return this.#seen.offset
  }

  get covered() {
    return this.#seen.covered
  }

  get open() {
    return this.#seen.open
  }

  watch() {
    const read = () => {
      this.#seen = seen(this.#screen, this.#editing() ? this.#seen.tallest : undefined)
    }
    read()
    const viewport = this.#screen.visualViewport
    const stops = [listened(this.#screen, ['resize'], read)]
    if (viewport) stops.push(listened(viewport, ['resize', 'scroll'], read))
    return () => {
      for (const stop of stops) stop()
    }
  }
}

export const whileClosed =
  <T>(keyboard: Pick<Keyboard, 'open'>, then: (value: T) => void) =>
  (value: T) => {
    if (!untrack(() => keyboard.open)) then(value)
  }
