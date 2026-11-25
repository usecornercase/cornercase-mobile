import { all, one, paint } from './paint'
import type { Scroll } from './scroll'
import { easeOut, mix, span } from '../lib/math'

interface Caption {
  id: string
  cap: HTMLElement
  title: HTMLElement
  side: number
}

export class Captions {
  private readonly captions: Caption[]

  constructor(private readonly scroll: Scroll) {
    this.captions = all('.ch').map((section) => ({
      id: section.dataset.section ?? '',
      cap: one('[data-cap]', section),
      title: one('[data-title]', section),
      side: section.classList.contains('ch--right') ? 1 : -1,
    }))
  }

  update(time: number): void {
    for (const caption of this.captions) this.place(caption, time)
  }

  private place({ id, cap, title, side }: Caption, time: number): void {
    const p = this.scroll.progress(id)
    if (p <= 0 || p >= 1) {
      paint(cap, 'opacity', '0')
      return
    }
    const enter = easeOut(span(p, 0.03, 0.14))
    const leave = span(p, 0.9, 0.99)
    const opacity = enter * (1 - leave)
    const y = (1 - enter) * 44 - leave * 34 + Math.sin(time * 0.8) * 3 * opacity
    const x = (1 - enter) * 26 * side
    const wide = this.scroll.wide
    paint(cap, 'opacity', opacity.toFixed(3))
    paint(title, 'font-stretch', `${mix(72, 118, easeOut(span(p, 0.02, 0.17))).toFixed(1)}%`)
    paint(
      cap,
      'transform',
      wide ? `translate3d(${x.toFixed(1)}px,calc(-50% + ${y.toFixed(1)}px),0)` : `translate3d(0,${y.toFixed(1)}px,0)`,
    )
  }
}
