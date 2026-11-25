<script lang="ts">
  import type { Snippet } from 'svelte'
  import { layout } from '../layout.svelte'
  import Glass from './Glass.svelte'
  import { fadeOut, riseIn, sheetIn, sheetOut, veilIn, veilOut } from './motion'
  import { overPage } from './overPage'
  import { cycled, placed, type Spot } from './popover'

  let {
    label,
    anchor = null,
    oncancel,
    children,
  }: { label: string; anchor?: HTMLElement | null; oncancel: () => void; children: Snippet } = $props()

  let width = $state(0)
  let height = $state(0)
  let spot = $state<Spot | null>(null)

  const floating = $derived(layout.wide)

  const FOCUSABLE = 'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

  const focused = (node: HTMLElement) => {
    const before = document.activeElement
    node.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus({ preventScroll: true })
      }
    }
  }

  const trapped = (event: KeyboardEvent, dialog: HTMLElement) => {
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const now = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const next = cycled(items, now, event.shiftKey)
    if (next !== undefined) {
      event.preventDefault()
      next.focus()
    }
  }

  const entering = (node: Element) => (floating ? riseIn(node) : sheetIn(node))

  const leaving = (node: Element) => (floating ? fadeOut(node) : sheetOut(node))

  const keyed = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      oncancel()
    }
    if (event.key === 'Tab') {
      trapped(event, event.currentTarget)
    }
  }

  $effect(() => {
    const from = floating ? anchor : null
    const size = { width, height }
    if (from === null) {
      spot = null
      return
    }
    const place = () => (spot = placed(from.getBoundingClientRect(), size, { width: innerWidth, height: innerHeight }))
    const scrolling = { capture: true, passive: true }
    place()
    addEventListener('resize', place)
    addEventListener('scroll', place, scrolling)
    return () => {
      removeEventListener('resize', place)
      removeEventListener('scroll', place, scrolling)
    }
  })
</script>

<div class="layer" class:floating {@attach overPage}>
  <button
    class="scrim"
    class:clear={floating}
    type="button"
    tabindex="-1"
    aria-hidden="true"
    onclick={oncancel}
    in:veilIn
    out:veilOut
  ></button>
  <div
    class="sheet"
    class:floating
    class:anchored={spot !== null}
    style:left={spot === null ? undefined : `${spot.left}px`}
    style:top={spot === null ? undefined : `${spot.top}px`}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
    bind:clientWidth={width}
    bind:clientHeight={height}
    onkeydown={keyed}
    {@attach focused}
    in:entering
    out:leaving
  >
    <Glass sheet={!floating}>
      <div class="body">
        {@render children()}
      </div>
    </Glass>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 8;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .layer.floating {
    align-items: center;
    justify-content: center;
  }

  .scrim {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: var(--veil);
    touch-action: none;
  }

  .clear {
    background: transparent;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    outline: none;
  }

  .sheet.floating {
    width: min(360px, calc(100vw - 24px));
    max-width: none;
    margin: 0;
  }

  .anchored {
    position: fixed;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    padding: var(--inset-wide) var(--inset-wide) calc(env(safe-area-inset-bottom) + var(--inset-wide));
  }

  .floating .body {
    padding: var(--inset-wide);
  }
</style>
