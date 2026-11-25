<script lang="ts">
  import { statusLetter } from '../../lib/diff'
  import { iconOf, type Row } from '../../lib/files.svelte'
  import Icon from '../../lib/ui/Icon.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'

  let {
    row,
    ontoggle,
    onopen,
  }: {
    row: Row
    ontoggle: (path: string) => void
    onopen: (path: string) => void
  } = $props()
</script>

{#if row.kind === 'more'}
  <p class="notice" style:--depth={row.depth}>Only the first 10,000 entries</p>
{:else if row.kind === 'error'}
  <p class="notice failed" style:--depth={row.depth}>{row.error}</p>
{:else}
  {@const entry = row.entry}
  {#snippet inside()}
    <span class="chevron">
      {#if entry.kind === 'folder'}
        <Icon name={row.open ? 'chevron-down' : 'chevron-right'} size={16} />
      {/if}
    </span>
    <span class="icon"><Icon name={iconOf(entry.kind, entry.name, row.open)} size={18} /></span>
    <span class="name">{entry.name}</span>
    {#if entry.link}
      <span class="tag">link</span>
    {/if}
    {#if row.loading}
      <Spinner />
    {/if}
    {#if entry.status !== null}
      <span class="letter {entry.status}">{statusLetter(entry.status)}</span>
    {/if}
  {/snippet}
  {#if entry.kind === 'folder'}
    <button
      class="entry"
      class:hidden={entry.hidden}
      type="button"
      aria-expanded={row.open}
      style:--depth={row.depth}
      onclick={() => ontoggle(row.path)}
      ontouchstart={() => {}}
    >
      {@render inside()}
    </button>
  {:else if entry.kind === 'file'}
    <button
      class="entry"
      class:hidden={entry.hidden}
      type="button"
      style:--depth={row.depth}
      onclick={() => onopen(row.path)}
      ontouchstart={() => {}}
    >
      {@render inside()}
    </button>
  {:else}
    <div class="entry other" class:hidden={entry.hidden} style:--depth={row.depth}>
      {@render inside()}
    </div>
  {/if}
{/if}

<style>
  .entry,
  .notice {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--gap);
    width: 100%;
    min-width: 0;
    min-height: 44px;
    margin: 0;
    padding: var(--gap) var(--inset) var(--gap) calc(var(--inset) + var(--depth) * 16px);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  .entry:active {
    background: var(--hover);
  }

  .other:active {
    background: none;
  }

  :global(html.pointing) .entry:not(.other):hover {
    background: var(--hover);
  }

  .hidden,
  .other {
    color: var(--muted);
  }

  .notice {
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
  }

  .failed {
    color: var(--failed);
    font-style: normal;
  }

  .chevron {
    display: flex;
    flex: none;
    width: 16px;
    color: var(--soft);
  }

  .icon {
    display: flex;
    flex: none;
    color: var(--muted);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag {
    flex: none;
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
  }

  .letter {
    flex: none;
    width: 1ch;
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .modified {
    color: var(--working);
  }

  .added,
  .untracked {
    color: var(--done);
  }

  .deleted {
    color: var(--failed);
  }

  .renamed {
    color: var(--accent);
  }
</style>
