import { cameraKeys, screenMarks } from './camera'
import { all, one, paint } from './paint'
import type { Scroll } from './scroll'
import { easeExpo } from '../lib/math'
import { placeKeys, poseAt, slide, transformOf, travel } from '../lib/track'
import type { Box, PlacedKey, Pose } from '../lib/track'

const ENTRANCE_DROP = 0.5

export class Stage {
  entrance = 1
  private readonly phone: HTMLElement
  private readonly glow: HTMLElement
  private readonly screens: HTMLImageElement[]
  private keys: PlacedKey[] = []
  private marks: [number, number][] = []
  private box: Box = { width: 1, height: 1 }

  constructor(private readonly scroll: Scroll) {
    const stage = one('[data-stage]')
    this.phone = one('[data-phone]', stage)
    this.glow = one('[data-stage-glow]', stage)
    this.screens = all<HTMLImageElement>('[data-screen]', stage)
    for (const screen of this.screens) {
      screen.loading = 'eager'
      void screen.decode().catch(() => undefined)
    }
  }

  measure(): void {
    this.box = { width: this.phone.offsetWidth, height: this.phone.offsetHeight }
    this.keys = placeKeys(cameraKeys(this.scroll), this.box, this.scroll.width, this.scroll.height)
    this.marks = screenMarks(this.scroll)
  }

  update(): void {
    const pose = poseAt(this.keys, this.scroll.now)
    if (this.entrance < 1) pose.cy += (1 - easeExpo(this.entrance)) * this.scroll.height * ENTRANCE_DROP
    this.paintPhone(pose)
    this.paintGlow(pose)
    this.paintScreens(travel(this.marks, this.scroll.now))
  }

  private paintPhone(pose: Pose): void {
    paint(this.phone, 'transform', transformOf(pose, this.box))
    paint(this.phone, 'opacity', pose.fade.toFixed(3))
    paint(this.phone, 'visibility', pose.fade <= 0 ? 'hidden' : 'visible')
  }

  private paintGlow(pose: Pose): void {
    const x = (pose.cx - this.glow.offsetWidth / 2).toFixed(1)
    const y = (pose.cy - this.glow.offsetHeight / 2).toFixed(1)
    paint(this.glow, 'transform', `translate3d(${x}px,${y}px,0) scale(${pose.scale.toFixed(4)})`)
    paint(this.glow, 'opacity', pose.fade.toFixed(3))
  }

  private paintScreens(travelled: number): void {
    this.screens.forEach((screen, index) => {
      const { shown, x, dim } = slide(index, travelled)
      paint(screen, 'visibility', shown ? 'visible' : 'hidden')
      paint(screen, 'transform', `translate3d(${x.toFixed(2)}%,0,0)`)
      paint(screen, 'opacity', (1 - dim).toFixed(3))
    })
  }
}
