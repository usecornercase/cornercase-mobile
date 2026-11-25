<script lang="ts">
  import type { AgentRow_Serialize as AgentRow } from '../../lib/bindings'
  import { label, place, type Row } from '../../lib/board'
  import Hidden from '../../lib/ui/Hidden.svelte'
  import StatusDot from '../../lib/ui/StatusDot.svelte'

  let {
    children,
    agents,
    onopen,
  }: { children: Row[]; agents: AgentRow[]; onopen: (pane: number) => void } = $props()
</script>

<ul class="children" aria-label="Subagents">
  {#each children as child (child.key)}
    <li>
      <button class="child" type="button" onclick={() => onopen(child.row.pane)} ontouchstart={() => {}}>
        <StatusDot status={child.row.status} />
        <span class="names">
          <span class="name">{label(child.row, agents)}</span>
          <span class="where">{place(child.row, agents)}</span>
        </span>
        <Hidden hidden={child.hidden} attention={child.attention} />
      </button>
    </li>
  {/each}
</ul>

<style>
  .children {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .child {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--inset);
    width: 100%;
    min-height: 44px;
    padding: var(--gap) var(--inset);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  .child:active {
    background: var(--hover);
  }

  :global(html.pointing) .child:hover {
    background: var(--hover);
  }

  .names {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .name,
  .where {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .where {
    color: var(--muted);
    font-size: 13px;
  }
</style>
