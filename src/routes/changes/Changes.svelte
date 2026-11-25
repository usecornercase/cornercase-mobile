<script lang="ts">
  import type { Mode } from '../../lib/bindings'
  import { CLOSED, type ChangesState } from '../../lib/changes.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import FileRow from './FileRow.svelte'

  const MODES: [Mode, string][] = [
    ['uncommitted', 'Uncommitted'],
    ['commits', 'Commits'],
    ['all', 'All'],
  ]

  let {
    title,
    changes,
    backTo,
    onback,
    onopen,
  }: {
    title: string
    changes: ChangesState
    backTo: string | null
    onback: () => void
    onopen: (path: string) => void
  } = $props()

  const summary = $derived(changes.summary)
  const listed = $derived(changes.listed)
  const files = $derived(changes.files)

  const empty = (mode: Mode, base: string | null) => {
    if (mode === 'uncommitted') {
      return 'No uncommitted changes'
    }
    if (base === null) {
      return 'No changes'
    }
    return mode === 'commits' ? `No commits ahead of ${base}` : `Nothing changed since ${base}`
  }

  const viewed = (path: string, seen: boolean) => void changes.mark(path, seen)
</script>

<section class="screen">
  <NavBar {backTo} {title} {onback} topmost measure="column">
    {#snippet right()}
      {#if listed !== null}
        <p class="totals"><span class="plus">+{listed.added}</span> <span class="minus">−{listed.removed}</span></p>
      {/if}
    {/snippet}
  </NavBar>
  {#if changes.gone}
    <p class="note">{CLOSED}.</p>
  {:else}
    <div class="modes" role="group" aria-label="Mode">
      {#each MODES as [mode, name] (mode)}
        <button
          class="mode"
          type="button"
          aria-pressed={changes.mode === mode}
          onclick={() => void changes.show(mode)}
          ontouchstart={() => {}}
        >
          {name}
        </button>
      {/each}
    </div>
    {#if summary?.state === 'failed'}
      <p class="note">{summary.error ?? 'Could not read the changes.'}</p>
    {:else if files.length > 0}
      <ul class="files">
        {#each files as file (file.path)}
          <li><FileRow {file} {onopen} onviewed={viewed} /></li>
        {/each}
      </ul>
    {:else if summary === null || summary.state === 'loading'}
      <p class="note"><Spinner />Reading the changes…</p>
    {:else}
      <p class="note">{empty(changes.mode, listed?.base ?? null)}</p>
    {/if}
  {/if}
</section>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    padding: var(--gap) var(--gutter) 40px;
  }

  .totals {
    margin: 0;
    padding-right: var(--inset);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .plus {
    color: var(--done);
  }

  .minus {
    color: var(--failed);
  }

  .modes {
    display: flex;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--field);
  }

  .mode {
    flex: 1;
    min-height: 44px;
    padding: 0 var(--gap);
    border: 0;
    border-radius: calc(var(--radius-control) - 2px);
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 15px;
  }

  .mode:active {
    background: var(--hover);
  }

  :global(html.pointing) .mode:not([aria-pressed='true']):hover {
    background: var(--hover);
  }

  .mode[aria-pressed='true'] {
    background: var(--selected);
    color: var(--text);
  }

  .files {
    margin: 0 calc(-1 * var(--inset));
    padding: 0;
    list-style: none;
  }

  .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
  }
</style>
