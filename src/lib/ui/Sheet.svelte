<script lang="ts">
  import type { Snippet } from 'svelte'
  import { layout } from '../layout.svelte'
  import Glass from './Glass.svelte'
  import { fadeOut, riseIn, sheetIn, sheetOut, veilIn, veilOut } from './motion'
  import { overPage } from './overPage'
  import { placed, type Spot } from './popover'

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

  const focused = (node: HTMLElement) => node.focus({ preventScroll: true })

  const entering = (node: Element) => (floating ? riseIn(node) : sheetIn(node))

  const leaving = (node: Element) => (floating ? fadeOut(node) : sheetOut(node))

  const escaped = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      oncancel()
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
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
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
    onkeydown={escaped}
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
