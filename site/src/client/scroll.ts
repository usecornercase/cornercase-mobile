import { all } from './paint'
import { damp, span } from '../lib/math'
import { NARROW_QUERY } from '../lib/track'
import type { View } from '../lib/track'

export class Scroll {
  now = 0
  height = 1
  width = 1
  wide = true
  private readonly tops = new Map<string, [number, number]>()
  private readonly rate: number

  constructor() {
    this.rate = matchMedia('(pointer: coarse)').matches ? 16 : 9
    this.now = window.scrollY
  }

  measure(): void {
    this.width = document.documentElement.clientWidth
    this.height = window.innerHeight
    this.wide = !matchMedia(NARROW_QUERY).matches
    for (const section of all('[data-section]')) {
      const box = section.getBoundingClientRect()
      const top = box.top + window.scrollY
      this.tops.set(section.dataset.section ?? '', [top, Math.max(1, box.height - this.height)])
    }
  }

  tick(dt: number): void {
    const target = window.scrollY
    this.now = Math.abs(target - this.now) < 0.05 ? target : damp(this.now, target, this.rate, dt)
  }

  view(): View {
    return { width: this.width, height: this.height, wide: this.wide }
  }

  at(id: string, progress: number): number {
    const place = this.tops.get(id)
    if (!place) throw new Error(`no section ${id}`)
    return place[0] + place[1] * progress
  }

  progress(id: string): number {
    const place = this.tops.get(id)
    if (!place) return 0
    return span(this.now, place[0], place[0] + place[1])
  }
}
