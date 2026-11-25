import { Captions } from './client/captions'
import { Hero } from './client/hero'
import { all } from './client/paint'
import { Rise } from './client/rise'
import { Scroll } from './client/scroll'
import { Stage } from './client/stage'
import { clamp } from './lib/math'
import { SHORTEST_SCREEN } from './lib/track'

const INTRO_ABOVE = 60
const LONG_AGO = -10
const ENTRANCE = 1.15
const LONGEST_FRAME = 0.05
const root = document.documentElement

class Page {
  stopped = false
  private readonly scroll = new Scroll()
  private readonly hero = new Hero()
  private readonly stage = new Stage(this.scroll)
  private readonly captions = new Captions(this.scroll)
  private readonly rise = new Rise(this.scroll)
  private started = -1
  private last = 0
  private shownAt = Number.NEGATIVE_INFINITY

  start(): void {
    this.size()
    if (this.scroll.now >= INTRO_ABOVE) this.hero.show(LONG_AGO)
    addEventListener(
      'resize',
      this.guard(() => this.size()),
    )
    addEventListener('pointermove', (event) => this.hero.pointer(event.clientX, event.clientY), { passive: true })
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
      if (event.matches) fallback()
    })
    void document.fonts.ready.then(this.guard(() => this.size()))
    requestAnimationFrame(this.guard((now: number) => this.frame(now)))
  }

  private guard<T extends unknown[]>(work: (...args: T) => void): (...args: T) => void {
    return (...args) => {
      if (this.stopped) return
      try {
        work(...args)
      } catch {
        fallback()
      }
    }
  }

  private size(): void {
    if (window.innerHeight < SHORTEST_SCREEN) {
      fallback()
      return
    }
    this.scroll.measure()
    this.stage.measure()
    this.hero.measure()
    this.rise.measure()
  }

  private frame(now: number): void {
    if (this.started < 0) {
      this.started = now
      this.last = now
    }
    const dt = Math.min(LONGEST_FRAME, Math.max(0.001, (now - this.last) / 1000))
    const time = (now - this.started) / 1000
    this.last = now
    if (root.classList.contains('intro')) this.intro(time)
    this.scroll.tick(dt)
    this.hero.update(time, dt, this.scroll.progress('hero'))
    this.stage.entrance = clamp((time - this.shownAt) / ENTRANCE)
    this.stage.update()
    this.captions.update(time)
    this.rise.update()
    requestAnimationFrame(this.guard((later: number) => this.frame(later)))
  }

  private intro(time: number): void {
    this.shownAt = time
    this.hero.show(time)
  }
}

let page: Page | undefined

function fallback(): void {
  if (page) page.stopped = true
  root.classList.remove('motion', 'intro')
  for (const el of all('.hero [style], .stage [style], .nav[style], .nav [style], main [style]')) {
    el.removeAttribute('style')
  }
}

root.dataset.alive = 'true'
if (root.classList.contains('motion')) {
  try {
    page = new Page()
    page.start()
  } catch {
    fallback()
  }
}
