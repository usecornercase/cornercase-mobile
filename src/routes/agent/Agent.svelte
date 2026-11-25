<script lang="ts">
  import { untrack } from 'svelte'
  import type { AgentRow_Serialize as AgentRow, ConnectionView_Serialize, Toast } from '../../lib/bindings'
  import { label } from '../../lib/board'
  import { whileShown, type Chat } from '../../lib/chat.svelte'
  import type { CloseAgent } from '../../lib/closeAgent.svelte'
  import { dropped, followKeys, KeyboardTop } from '../../lib/keyboardTop.svelte'
  import { Keyboard } from '../../lib/terminal/keyboard.svelte'
  import CloseConfirm from '../../lib/ui/CloseConfirm.svelte'
  import Mark from '../../lib/ui/Mark.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import ChatHeader from './ChatHeader.svelte'
  import Composer from './Composer.svelte'
  import Subagents from './Subagents.svelte'
  import Thread from './Thread.svelte'

  const TICK_MS = 15_000

  let {
    chat,
    agents,
    connection,
    closer,
    backTo,
    below = 0,
    topmost = false,
    rooted = false,
    starting = null,
    onback,
    onopen,
    onfailed,
    ontoast,
    onterminal,
    onchanges,
    onfiles,
    onstart,
  }: {
    chat: Chat
    agents: AgentRow[] | null
    connection: ConnectionView_Serialize
    closer: CloseAgent | null
    backTo: string | null
    below?: number
    topmost?: boolean
    rooted?: boolean
    starting?: string | null
    onback: () => void
    onopen: (pane: number) => void
    onfailed: (reason: string) => void
    ontoast: (toast: Toast) => void
    onterminal: (row: AgentRow) => void
    onchanges: (workspace: number, title: string) => void
    onfiles: (workspace: number, title: string) => void
    onstart: (workspace: number) => void
  } = $props()

  let now = $state(untrack(() => chat.now()))

  const keyboard = new Keyboard(globalThis)
  const keys = new KeyboardTop()
  const seen = $derived(keyboard.covered ? keyboard.height : null)
  const drop = $derived(seen === null ? 0 : dropped(seen, keys.top))

  $effect(() => keyboard.watch())
  $effect(() => keys.watch(globalThis))
  $effect(() => followKeys(document.documentElement))

  $effect(() => {
    const told = chat
    const timer = setInterval(() => (now = told.now()), TICK_MS)
    return () => clearInterval(timer)
  })

  $effect(() => {
    const followed = chat
    return untrack(() => whileShown(document, () => followed.follow()))
  })

  $effect(() => {
    const asked = chat
    return untrack(() => whileShown(document, () => asked.watchQuestion()))
  })

  const row = $derived(chat.row)

  const asking = $derived(row === null ? null : (closer?.confirmingFor(row.pane, 'agent') ?? null))

  const closable = $derived(row !== null && connection.state === 'connected' && closer?.offered(row) === true)

  let anchor = $state<HTMLElement | null>(null)

  const ask = (from: HTMLElement | null) => {
    if (row !== null && closable) {
      anchor = from
      void closer?.ask(row, 'agent')
    }
  }
</script>

<section
  class="agent"
  class:keyboard={seen !== null}
  class:topmost
  style:--below="{below}px"
  style:top={seen === null ? undefined : `${keyboard.offset}px`}
  style:height={seen === null ? undefined : `${seen}px`}
>
  {#if chat.gone}
    <NavBar {backTo} {onback} {below} {topmost} {rooted} measure="column" />
    <p class="gone">This agent is no longer running.</p>
  {:else if row === null}
    <NavBar {backTo} {onback} {below} {topmost} {rooted} measure="column" />
    {#if starting !== null}
      <p class="starting"><Spinner />Starting {starting}…</p>
    {:else}
      <div class="waiting">
        <Mark unit={5} pulsing={connection.state === 'connecting'} />
      </div>
    {/if}
  {:else}
    <ChatHeader
      {row}
      agents={agents ?? []}
      {backTo}
      {below}
      {topmost}
      {rooted}
      boxed={seen !== null}
      sendable={connection.state === 'connected'}
      {closable}
      progress={closer?.progress(row.pane) ?? null}
      {onback}
      {onterminal}
      {onchanges}
      {onfiles}
      {onstart}
      onclose={ask}
    />
    {#key row.pane}
      <Subagents {row} agents={agents ?? []} {onopen} />
    {/key}
    <Thread {chat} {now} boxed={seen !== null} {drop} />
    <Composer {chat} agent={row.agent} {below} {seen} {drop} {onfailed} {ontoast} />
    {#if seen !== null}
      <div class="floor" style:transform={drop > 0 ? `translateY(${drop}px)` : undefined}></div>
    {/if}
    {#if asking !== null}
      {@const pane = row.pane}
      <CloseConfirm
        plan={asking.plan}
        label={label(row, agents ?? [])}
        rechecking={asking.kind === 'rechecking'}
        {anchor}
        oncancel={() => closer?.cancel(pane)}
        onconfirm={() => void closer?.confirm(pane)}
      />
    {/if}
  {/if}
</section>

<style>
  .agent {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    min-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    padding: calc(var(--below) + var(--inset)) var(--gutter) var(--inset-wide);
  }

  .keyboard {
    position: fixed;
    right: 0;
    left: var(--pane-left);
    min-height: 0;
    padding-top: calc(env(safe-area-inset-top) + var(--below) + var(--inset));
    padding-right: calc(env(safe-area-inset-right) + var(--gutter));
    padding-left: calc(var(--pane-safe-left) + var(--gutter));
  }

  .topmost {
    padding-top: var(--gap);
  }

  .keyboard.topmost {
    padding-top: calc(env(safe-area-inset-top) + var(--gap));
  }

  .floor {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    height: 100vh;
    background: var(--glass);
    pointer-events: none;
    will-change: transform;
  }

  .waiting {
    display: flex;
    justify-content: center;
    padding-top: 28px;
  }

  .gone {
    margin: 0;
    color: var(--muted);
  }

  .starting {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
  }
</style>
