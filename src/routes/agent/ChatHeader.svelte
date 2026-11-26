<script lang="ts">
  import type { AgentRow_Serialize as AgentRow } from '../../lib/bindings'
  import { label, place, statusName } from '../../lib/board'
  import type { Progress } from '../../lib/closeAgent.svelte'
  import { compactHeader } from '../../lib/thread'
  import Button from '../../lib/ui/Button.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import StatusDot from '../../lib/ui/StatusDot.svelte'
  import ToolButton from '../../lib/ui/ToolButton.svelte'

  let {
    row,
    backTo,
    agents,
    below = 0,
    topmost = false,
    rooted = false,
    boxed = false,
    sendable,
    closable,
    progress,
    onback,
    onterminal,
    onchanges,
    onfiles,
    onstart,
    onclose,
    bar = $bindable(null),
  }: {
    row: AgentRow
    backTo: string | null
    agents: AgentRow[]
    below?: number
    topmost?: boolean
    rooted?: boolean
    boxed?: boolean
    sendable: boolean
    closable: boolean
    progress: Progress
    onback: () => void
    onterminal: (row: AgentRow) => void
    onchanges: (workspace: number, title: string) => void
    onfiles: (workspace: number, title: string) => void
    onstart: (workspace: number) => void
    onclose: (from: HTMLElement | null) => void
    bar?: HTMLElement | null
  } = $props()

  let scrolled = $state(0)
  let tall = $state(0)
  let closing = $state<HTMLElement | null>(null)

  const compact = $derived(boxed || compactHeader(scrolled, tall))

  $effect(() => {
    const seen = () => (scrolled = window.scrollY)
    seen()
    window.addEventListener('scroll', seen, { passive: true })
    return () => window.removeEventListener('scroll', seen)
  })
</script>

<NavBar bind:bar {backTo} {onback} {below} {topmost} {rooted} measure="column" edge={compact}>
  {#snippet center()}
    <div class="short" class:compact aria-hidden="true">
      <StatusDot status={row.status} />
      <span class="called">{label(row, agents)}</span>
    </div>
  {/snippet}
  {#snippet right()}
    <ToolButton label="Terminal" icon="square-terminal" onclick={() => onterminal(row)} />
    <ToolButton label="Changes" icon="git-compare" onclick={() => onchanges(row.workspace, row.workspace_name)} />
    <ToolButton label="Files" icon="folder" onclick={() => onfiles(row.workspace, row.workspace_name)} />
    <ToolButton label="New agent" icon="plus" disabled={!sendable} onclick={() => onstart(row.workspace)} />
  {/snippet}
</NavBar>
<header class="head" class:spoken={boxed} bind:clientHeight={tall}>
  <StatusDot status={row.status} size={20} />
  <div class="lines">
    <h1 class="title">{label(row, agents)}</h1>
    <p class="place"><span class="status">{statusName(row.status)}</span> · {place(row)} › {row.tab_name}</p>
  </div>
</header>
<div class="close" class:spoken={boxed} bind:this={closing}>
  {#if progress === 'closing'}
    <Button tone="danger" quiet resting>Closing…</Button>
  {:else}
    <Button tone="danger" quiet resting={!closable && progress === null} busy={progress === 'checking'} onclick={() => onclose(closing)}>
      Close agent
    </Button>
  {/if}
</div>

<style>
  .short {
    display: inline-flex;
    align-items: center;
    max-width: 0;
    overflow: hidden;
    vertical-align: middle;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    visibility: hidden;
    opacity: 0;
    transition:
      opacity 150ms ease-out,
      visibility 150ms,
      max-width 0s 150ms;
  }

  .short.compact {
    max-width: 100%;
    visibility: visible;
    opacity: 1;
    transition-delay: 0s;
  }

  .called {
    overflow: hidden;
    color: var(--text);
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--inset);
  }

  .lines {
    min-width: 0;
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

  .place {
    margin: 0;
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    color: var(--soft);
  }

  .close {
    display: flex;
  }

  @media (prefers-reduced-motion: reduce) {
    .short {
      transition: none;
    }
  }
</style>
