<script lang="ts">
  import type { AgentRow_Serialize as Agent } from '../../lib/bindings'
  import { disclosureName, elapsed, label, place, statusName, type Row } from '../../lib/board'
  import type { Progress } from '../../lib/closeAgent.svelte'
  import { OPEN_WIDTH, watchLongPress, watchRowSwipe, type RowGesture } from '../../lib/rowSwipe'
  import Hidden from '../../lib/ui/Hidden.svelte'
  import { icons } from '../../lib/ui/icons/shapes'
  import { ENTER_MS, prefersReducedMotion } from '../../lib/ui/motion'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import StatusDot from '../../lib/ui/StatusDot.svelte'

  let {
    item,
    agents,
    now,
    current = false,
    gesture,
    closable,
    open,
    progress,
    onopen,
    onfold,
    onswipe,
    onclose,
  }: {
    item: Row
    agents: Agent[]
    now: number
    current?: boolean
    gesture: RowGesture | null
    closable: boolean
    open: boolean
    progress: Progress
    onopen: (pane: number) => void
    onfold: (pane: number) => void
    onswipe: (pane: number, open: boolean) => void
    onclose: (row: Agent) => void
  } = $props()

  const row = $derived(item.row)
  const time = $derived(elapsed(row.since, now))

  const turn = prefersReducedMotion() ? 0 : ENTER_MS
  const [chevron] = icons['chevron-right']

  let dragged = $state<number | null>(null)

  const offset = $derived(dragged ?? (open ? -OPEN_WIDTH : 0))

  const touches = (node: HTMLElement) => {
    if (gesture === 'swipe') {
      return watchRowSwipe(node, {
        open: () => open,
        ondrag: (next) => (dragged = closable ? next : null),
        onsettle: (next) => onswipe(row.pane, closable && next),
      })
    }
    if (gesture === 'hold') {
      return watchLongPress(node, () => onclose(row))
    }
  }
</script>

<div class="agent" style:--depth={item.depth} data-open={open ? '' : undefined}>
  {#if gesture === 'swipe' && closable}
    <button
      class="close"
      class:eased={dragged === null}
      style:width="{OPEN_WIDTH}px"
      style:--reveal="{-offset}px"
      type="button"
      tabindex={open ? undefined : -1}
      aria-hidden={open ? undefined : 'true'}
      onclick={() => onclose(row)}
      ontouchstart={() => {}}
    >
      Close
    </button>
  {/if}
  <div
    class="layer"
    class:eased={dragged === null}
    style:transform={offset < 0 ? `translateX(${offset}px)` : undefined}
    {@attach touches}
  >
    {#if item.hasChildren}
      <button
        class="fold"
        type="button"
        aria-label={disclosureName(item.total, item.folded)}
        aria-expanded={!item.folded}
        onclick={() => onfold(row.pane)}
        ontouchstart={() => {}}
      >
        <span class="face" aria-hidden="true"><StatusDot status={row.status} /></span>
        <svg
          class="turn"
          class:open={!item.folded}
          style:--turn="{turn}ms"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d={chevron.d} />
        </svg>
      </button>
    {/if}
    <button
      class="row"
      type="button"
      aria-current={current ? 'true' : undefined}
      aria-busy={progress === null ? undefined : 'true'}
      onclick={() => onopen(row.pane)}
      ontouchstart={() => {}}
    >
      <span class="mark">
        {#if item.hasChildren}
          <span class="spoken">{statusName(row.status)}</span>
        {:else}
          <StatusDot status={row.status} />
        {/if}
      </span>
      <span class="lines">
        <span class="title">{label(row, agents)}</span>
        <span class="place">{place(row, agents)}</span>
      </span>
      <Hidden hidden={item.hidden} attention={item.attention} />
      {#if progress === 'checking'}
        <Spinner />
      {:else if progress === 'closing'}
        <span class="closing">Closing…</span>
      {:else if time !== ''}
        <span class="time">{time}</span>
      {/if}
    </button>
  </div>
</div>

<style>
  .agent {
    position: relative;
    overflow: clip;
  }

  .layer {
    position: relative;
    display: flex;
    align-items: center;
    padding-left: calc(var(--depth) * var(--inset-wide));
  }

  .layer.eased {
    transition: transform var(--leave) ease-out;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: var(--failed);
    color: var(--glass);
    font: inherit;
    font-weight: 600;
    clip-path: inset(0 0 0 calc(100% - var(--reveal)));
  }

  .close.eased {
    transition: clip-path var(--leave) ease-out;
  }

  .row,
  .fold {
    box-sizing: border-box;
    min-height: 44px;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
  }

  .row:active,
  .fold:active {
    background: var(--hover);
  }

  .row[aria-current='true'] {
    background: var(--selected);
  }

  .row {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--inset);
    min-width: 0;
    padding: var(--gap) var(--inset);
    text-align: left;
  }

  .fold {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--depth) * var(--inset-wide) + var(--inset) - 15px);
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    width: 44px;
    padding: 0;
    color: var(--soft);
  }

  .face {
    display: flex;
  }

  .mark {
    display: flex;
    flex: none;
    justify-content: center;
    width: 14px;
    margin-right: calc(var(--inset-wide) - var(--inset));
  }

  .turn {
    position: relative;
    left: calc((7px + var(--inset-wide)) / 2);
  }

  .turn path {
    transform-box: view-box;
    transform-origin: center;
    transition: transform var(--turn);
  }

  .turn.open path {
    transform: rotate(90deg);
  }

  .lines {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .title,
  .place {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .place {
    color: var(--muted);
    font-size: 13px;
  }

  .closing {
    flex: none;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .time {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .layer.eased,
    .close.eased {
      transition: none;
    }
  }
</style>
