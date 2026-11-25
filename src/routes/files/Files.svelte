<script lang="ts">
  import { CLOSED } from '../../lib/changes.svelte'
  import { ROOT, type FilesState, type Row } from '../../lib/files.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import SearchField from '../../lib/ui/SearchField.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import EntryRow from './EntryRow.svelte'
  import SearchResults from './SearchResults.svelte'

  let {
    title,
    files,
    backTo,
    onback,
    onopen,
  }: {
    title: string
    files: FilesState
    backTo: string | null
    onback: () => void
    onopen: (path: string) => void
  } = $props()

  const root = $derived(files.folder(ROOT)?.listed ?? null)
  const rows = $derived(files.rows)

  const keyOf = (row: Row) => (row.kind === 'entry' ? row.path : `${row.kind}:${row.folder}`)

  const toggle = (path: string) => void files.toggle(path)
</script>

<section class="screen">
  <NavBar {backTo} {title} {onback} topmost measure="column" />
  {#if files.gone}
    <p class="note">{CLOSED}.</p>
  {:else}
    <SearchField
      label="Search files"
      value={files.query}
      oninput={(event) => files.find(event.currentTarget.value)}
    />
    {#if files.results !== null}
      <SearchResults results={files.results} {onopen} />
    {:else if rows.length > 0}
      <ul class="entries">
        {#each rows as row (keyOf(row))}
          <li><EntryRow {row} ontoggle={toggle} {onopen} /></li>
        {/each}
      </ul>
    {:else if root === null}
      <p class="note"><Spinner />Reading the files…</p>
    {:else}
      <p class="note">No files</p>
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

  .entries {
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
