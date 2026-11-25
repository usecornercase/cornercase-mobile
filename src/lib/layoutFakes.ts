import { layout } from './layout.svelte'

const quiet = { addEventListener: () => {}, removeEventListener: () => {} }

export const atWidth = <T>(innerWidth: number, draw: () => T) => {
  const stop = layout.watch({ ...quiet, innerWidth })
  try {
    return draw()
  } finally {
    stop()
    layout.watch(quiet)()
  }
}
