import type { Route } from './router.svelte'

export const WIDE = 720

export const twoPanes = (width: number) => width >= WIDE

export const splits = (wide: boolean, base: Route['name'], fullTerminal: boolean) =>
  wide && base === 'home' && !fullTerminal

export type Sized = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & { innerWidth?: number }

export class Layout {
  #wide = $state(false)
  #full = $state(false)

  get wide() {
    return this.#wide
  }

  get full() {
    return this.#full
  }

  toggleFull() {
    this.#full = !this.#full
  }

  watch(screen: Sized) {
    const read = () => {
      this.#wide = twoPanes(screen.innerWidth ?? 0)
    }
    read()
    screen.addEventListener('resize', read)
    return () => screen.removeEventListener('resize', read)
  }
}

export const layout = new Layout()
