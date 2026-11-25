<script lang="ts">
  import type { AgentRow_Serialize as AgentRow } from '../../lib/bindings'
  import { subagents } from '../../lib/board'
  import Icon from '../../lib/ui/Icon.svelte'
  import Children from './Children.svelte'

  let { row, agents, onopen }: { row: AgentRow; agents: AgentRow[]; onopen: (pane: number) => void } = $props()

  let open = $state(false)

  const summary = $derived(subagents(agents, row.pane))
</script>

{#if summary !== null}
  <div class="subagents">
    <button
      class="line"
      type="button"
      aria-expanded={open}
      onclick={() => (open = !open)}
      ontouchstart={() => {}}
    >
      <span class="count">{summary.line}</span>
      <span class="arrow"><Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} /></span>
    </button>
    {#if open}
      <Children children={summary.children} {agents} {onopen} />
    {/if}
  </div>
{/if}

<style>
  .line {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--gap);
    width: 100%;
    min-height: 44px;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--muted);
    font: inherit;
    text-align: left;
  }

  .line:active {
    background: var(--hover);
  }

  :global(html.pointing) .line:hover {
    background: var(--hover);
  }

  .count {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    color: var(--soft);
  }
</style>
