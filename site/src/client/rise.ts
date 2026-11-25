import { all, paint } from './paint'
import type { Scroll } from './scroll'
import { easeOut, mix, span } from '../lib/math'

const SHIFT = 36

interface Part {
  el: HTMLElement
  top: number
  stretch: boolean
}

function topOf(el: HTMLElement): number {
  let top = 0
  for (let at: HTMLElement | null = el; at; at = at.offsetParent as HTMLElement | null) top += at.offsetTop
  return top
}

export class Rise {
  private readonly parts: Part[]

  constructor(private readonly scroll: Scroll) {
    this.parts = all('[data-rise]').map((el) => ({ el, top: 0, stretch: el.hasAttribute('data-stretch') }))
  }

  measure(): void {
    for (const part of this.parts) part.top = topOf(part.el)
  }

  update(): void {
    const bottom = this.scroll.now + this.scroll.height
    for (const { el, top, stretch } of this.parts) {
      const p = span(bottom, top + 40, top + 40 + this.scroll.height * 0.3)
      paint(el, 'opacity', p.toFixed(3))
      paint(el, 'transform', `translate3d(0,${((1 - easeOut(p)) * SHIFT).toFixed(1)}px,0)`)
      if (stretch) paint(el, 'font-stretch', `${mix(72, 122, p).toFixed(1)}%`)
    }
  }
}
