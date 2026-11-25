import { all, one, paint } from './paint'
import { backOut, clamp, damp, easeExpo, mix, span } from '../lib/math'

const NARROWEST = 62
const REST = 112
const NEAR = 125
const ENTERED = 1.6
const REACH = 150

interface Letter {
  el: HTMLElement
  x: number
  y: number
  bump: number
}

interface Moment {
  since: number
  squeeze: number
  time: number
  dt: number
  count: number
}

function split(line: HTMLElement): HTMLElement[] {
  const words = (line.textContent ?? '').trim().split(/\s+/)
  line.textContent = ''
  line.setAttribute('aria-hidden', 'true')
  return words.flatMap((word) => {
    const holder = line.appendChild(document.createElement('span'))
    holder.className = 'hero__word'
    return [...word].map((character) => {
      const letter = holder.appendChild(document.createElement('span'))
      letter.className = 'hero__ch'
      letter.textContent = character
      return letter
    })
  })
}

export class Hero {
  private readonly letters: Letter[]
  private readonly rises: HTMLElement[]
  private shownAt = -1
  private pointerX = -9999
  private pointerY = -9999

  constructor() {
    const title = one('[data-hero-title]')
    title.setAttribute('aria-label', (title.textContent ?? '').replace(/\s+/g, ' ').trim())
    this.letters = all('.hero__line', title)
      .flatMap(split)
      .map((el) => ({ el, x: 0, y: 0, bump: 0 }))
    this.rises = all('[data-hero-rise]')
  }

  measure(): void {
    for (const letter of this.letters) {
      const box = letter.el.getBoundingClientRect()
      letter.x = box.left + box.width / 2
      letter.y = box.top + box.height / 2
    }
  }

  pointer(x: number, y: number): void {
    this.pointerX = x
    this.pointerY = y
  }

  show(time: number): void {
    this.shownAt = time
    document.documentElement.classList.remove('intro')
    this.measure()
  }

  update(time: number, dt: number, progress: number): void {
    if (this.shownAt < 0) return
    const since = time - this.shownAt
    this.fadeRest(progress, since)
    if (progress >= 1) return
    const moment = { since, squeeze: span(progress, 0.02, 0.62), time, dt, count: this.letters.length }
    this.letters.forEach((letter, i) => this.letter(letter, i, moment))
  }

  private bumpOf(letter: Letter, dt: number): number {
    const dx = letter.x - this.pointerX
    const dy = letter.y - this.pointerY
    const close = Math.exp(-(dx * dx + dy * dy) / (2 * REACH * REACH))
    letter.bump = damp(letter.bump, close, 10, dt)
    return letter.bump
  }

  private letter(letter: Letter, i: number, { since, squeeze, time, dt, count }: Moment): void {
    const local = clamp((since - i * 0.024) / 1.05)
    const bump = this.bumpOf(letter, dt)
    const wave = Math.sin(time * 0.9 - i * 0.34) * 2.6
    const stretch = mix(NARROWEST, REST + wave + (NEAR - REST) * bump, backOut(local))
    const squeezed = mix(stretch, NARROWEST, squeeze)
    const y = (1 - easeExpo(local)) * 62 - squeeze * 80 * (1 + (i % 3) * 0.14)
    const spread = (i - count / 2) * squeeze * 6
    const opacity = clamp(local * 2.4) * (1 - span(squeeze, 0.45, 0.98))
    paint(letter.el, 'font-stretch', `${clamp(squeezed, NARROWEST, NEAR).toFixed(1)}%`)
    paint(letter.el, 'font-weight', (800 + 100 * bump).toFixed(0))
    paint(letter.el, 'transform', `translate3d(${spread.toFixed(1)}px,${y.toFixed(1)}%,0)`)
    paint(letter.el, 'opacity', opacity.toFixed(3))
  }

  private fadeRest(progress: number, since: number): void {
    const out = span(progress, 0, 0.3)
    for (const rise of this.rises) {
      if (since > ENTERED) paint(rise, 'transition', 'none')
      paint(rise, 'opacity', (1 - out).toFixed(3))
      paint(rise, 'translate', `0 ${(-out * 46).toFixed(1)}px`)
    }
  }
}
