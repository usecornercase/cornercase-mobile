<script lang="ts">
  import * as haptics from '@tauri-apps/plugin-haptics'
  import { flip } from 'svelte/animate'
  import { listening } from '../../lib/backSwipe'
  import type { AgentRow_Serialize as Agent, ConnectionView_Serialize } from '../../lib/bindings'
  import { items, label } from '../../lib/board'
  import { boardSearch } from '../../lib/boardSearch.svelte'
  import type { CloseAgent } from '../../lib/closeAgent.svelte'
  import { folds } from '../../lib/folds.svelte'
  import { tap } from '../../lib/haptics'
  import { platform } from '../../lib/platform'
  import { rowGesture } from '../../lib/rowSwipe'
  import Button from '../../lib/ui/Button.svelte'
  import CloseConfirm from '../../lib/ui/CloseConfirm.svelte'
  import Mark from '../../lib/ui/Mark.svelte'
  import SearchField from '../../lib/ui/SearchField.svelte'
  import { ENTER_MS, prefersReducedMotion } from '../../lib/ui/motion'
  import AgentRow from './AgentRow.svelte'

  const TICK_MS = 30_000

  let {
    machine,
    agents,
    connection,
    closer,
    selected = null,
    below = 0,
    onopen,
    onstart,
  }: {
    machine: number | null
    agents: Agent[] | null
    connection: ConnectionView_Serialize
    closer: CloseAgent | null
    selected?: number | null
    below?: number
    onopen: (pane: number) => void
    onstart: () => void
  } = $props()

  let now = $state(Date.now())

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), TICK_MS)
    return () => clearInterval(timer)
  })

  const boot = $derived(agents?.[0]?.boot ?? '')

  const opened = $derived(machine === null ? undefined : folds.expanded(machine, boot))

  const fold = (pane: number) => {
    if (machine !== null) {
      folds.toggle(machine, boot, pane)
    }
  }

  const query = $derived(machine === null ? '' : boardSearch.query(machine))

  const search = (text: string) => {
    if (machine !== null) {
      boardSearch.write(machine, text)
    }
  }

  const shown = $derived(agents === null ? [] : items(agents, opened, query))

  const moving = { duration: prefersReducedMotion() ? 0 : ENTER_MS }

  const gesture = rowGesture(platform)

  let swiped = $state<{ pane: number; at: number } | null>(null)
  let anchor = $state<HTMLElement | null>(null)

  const placeOf = (pane: number) => shown.findIndex((item) => item.kind === 'row' && item.row.pane === pane)

  const swipe = (pane: number, open: boolean) => {
    swiped = open ? { pane, at: placeOf(pane) } : null
  }

  const shut = () => (swiped = null)

  const outside = (event: Event) => {
    if (!(event.target instanceof Element && event.target.closest('[data-open]') !== null)) {
      shut()
    }
  }

  $effect(() => {
    if (swiped !== null && placeOf(swiped.pane) !== swiped.at) {
      shut()
    }
  })

  $effect(() => {
    if (swiped !== null && connection.state !== 'connected') {
      shut()
    }
  })

  $effect(() => {
    if (swiped !== null) {
      return listening(document, [
        ['touchstart', outside, { capture: true, passive: true }],
        ['scroll', shut, { capture: true, passive: true }],
      ])
    }
  })

  const closes = (row: Agent) => closer !== null && row.boot !== '' && connection.state === 'connected'

  const gestureOf = (row: Agent) => (closes(row) ? gesture : null)

  const opens = (row: Agent) => swiped?.pane === row.pane && closes(row) && closer?.offered(row) === true

  const ask = (row: Agent, from: HTMLElement | null) => {
    if (closer === null || !closes(row) || !closer.offered(row)) {
      return
    }
    if (gesture === 'hold') {
      void tap(haptics)
    }
    shut()
    anchor = from
    void closer.ask(row, 'board')
  }

  const asking = $derived.by(() => {
    for (const row of agents ?? []) {
      const state = closer?.confirmingFor(row.pane, 'board') ?? null
      if (state !== null) {
        return { row, state }
      }
    }
    return null
  })
</script>

<section class="board" style:--below="{below}px">
  <div class="heading">
    <h1 class="title">Agents</h1>
    <Button compact resting={connection.state !== 'connected'} onclick={onstart}>Start</Button>
  </div>
  {#if agents === null}
    <div class="waiting">
      <Mark unit={5} pulsing={connection.state === 'connecting'} />
    </div>
  {:else if agents.length === 0}
    <p class="empty">No agents running.</p>
  {:else}
    <div class="find">
      <SearchField
        label="Search agents"
        value={query}
        oninput={(event) => search(event.currentTarget.value)}
        oncancel={() => search('')}
      />
    </div>
    {#if shown.length === 0}
      <p class="empty">No agent matches the search</p>
    {:else}
      <ul class="items">
        {#each shown as item (item.key)}
          <li class="item" animate:flip={moving}>
            {#if item.kind === 'header'}
              <h2 class="section">{item.section}</h2>
            {:else}
              <AgentRow
                {item}
                {agents}
                {now}
                current={selected === item.row.pane}
                gesture={gestureOf(item.row)}
                closable={closer?.offered(item.row) ?? false}
                open={opens(item.row)}
                progress={closer?.progress(item.row.pane) ?? null}
                {onopen}
                onfold={fold}
                onswipe={swipe}
                onclose={ask}
              />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if asking !== null}
    {@const pane = asking.row.pane}
    <CloseConfirm
      plan={asking.state.plan}
      label={label(asking.row, agents ?? [])}
      rechecking={asking.state.kind === 'rechecking'}
      {anchor}
      oncancel={() => closer?.cancel(pane)}
      onconfirm={() => void closer?.confirm(pane)}
    />
  {/if}
</section>

<style>
  .board {
    padding: calc(var(--below) + var(--inset)) var(--inset-wide) var(--inset-wide);
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
    margin-bottom: var(--inset);
  }

  .title {
    margin: 0;
    overflow: hidden;
    color: var(--text);
    font-size: 20px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .find {
    margin-bottom: var(--inset);
  }

  .waiting {
    display: flex;
    justify-content: center;
    padding-top: 28px;
  }

  .empty {
    margin: 40px 0 0;
    color: var(--muted);
    text-align: center;
  }

  .items {
    margin: 0 calc(-1 * var(--inset));
    padding: 0;
    list-style: none;
  }

  .section {
    margin: var(--inset) var(--inset) var(--gap);
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .item:first-child .section {
    margin-top: 0;
  }
</style>
