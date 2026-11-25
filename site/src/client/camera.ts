import type { Free, Key, Shot } from '../lib/track'
import type { Scroll } from './scroll'

interface Chapter {
  id: string
  free: Free
  focus: [number, number]
}

export const CHAPTERS: Chapter[] = [
  { id: 'board', free: 'right', focus: [0.2, 0.3] },
  { id: 'chat', free: 'left', focus: [0.5, 0.72] },
  { id: 'terminal', free: 'right', focus: [0.2, 0.4] },
  { id: 'changes', free: 'left', focus: [0.15, 0.3] },
  { id: 'start', free: 'right', focus: [0.3, 0.6] },
  { id: 'files', free: 'left', focus: [0.2, 0.4] },
]

const ENTER = 0.06
const LEAVE = 0.94
const PUSH_FROM = 0.97
const PUSH_TO = 0.05
const GONE_AFTER = 0.45

interface Shots {
  peek: Shot
  front: Shot
  gone: Shot
  enter: (chapter: Chapter) => Shot
  leave: (chapter: Chapter) => Shot
}

function turnOf(chapter: Chapter): number {
  return chapter.free === 'right' ? -1 : 1
}

function wide(): Shots {
  return {
    peek: { free: 'screen', rx: 38, dy: 0.62, zoom: 1.05 },
    front: { free: 'screen' },
    gone: { free: 'screen', zoom: 1.25, rx: 48, dy: 1.2, fade: 0 },
    enter: (chapter) => ({ free: chapter.free, ry: 8 * turnOf(chapter), rx: 2 }),
    leave: (chapter) => ({ free: chapter.free, ry: 3 * turnOf(chapter) }),
  }
}

function narrow(): Shots {
  return {
    peek: { free: 'screen', rx: 30, dy: 0.6 },
    front: { free: 'screen' },
    gone: { free: 'screen', zoom: 1.25, rx: 48, dy: 1.2, fade: 0 },
    enter: (chapter) => ({ free: chapter.free, focus: chapter.focus[0], ry: 4 * turnOf(chapter), rx: 2 }),
    leave: (chapter) => ({ free: chapter.free, focus: chapter.focus[1], ry: 2 * turnOf(chapter) }),
  }
}

export function cameraKeys(scroll: Scroll): Key[] {
  const shots = scroll.wide ? wide() : narrow()
  const key = (id: string, progress: number, shot: Shot): Key => ({ at: scroll.at(id, progress), shot })
  const last = CHAPTERS[CHAPTERS.length - 1] as Chapter
  return [
    key('hero', 0, shots.peek),
    key('hero', 1, shots.front),
    ...CHAPTERS.flatMap((chapter) => [
      key(chapter.id, ENTER, shots.enter(chapter)),
      key(chapter.id, LEAVE, shots.leave(chapter)),
    ]),
    { at: scroll.at(last.id, 1) + scroll.height * GONE_AFTER, shot: shots.gone },
  ]
}

export function screenMarks(scroll: Scroll): [number, number][] {
  return CHAPTERS.slice(1).map((chapter, i) => [
    scroll.at((CHAPTERS[i] as Chapter).id, PUSH_FROM),
    scroll.at(chapter.id, PUSH_TO),
  ])
}
