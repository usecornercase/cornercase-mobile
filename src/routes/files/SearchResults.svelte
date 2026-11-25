<script lang="ts">
  import { highlight, iconOf, type Results } from '../../lib/files.svelte'
  import Icon from '../../lib/ui/Icon.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'

  let {
    results,
    onopen,
  }: {
    results: Results
    onopen: (path: string) => void
  } = $props()

  const names = $derived(results.found?.names ?? [])
</script>

{#if results.error !== null}
  <p class="note">{results.error}</p>
{:else if results.loading}
  <p class="note"><Spinner />Searching…</p>
{:else if names.length === 0}
  <p class="note">Nothing found</p>
{/if}
{#if names.length > 0}
  <ul class="found">
    {#each names as name (name.path)}
      <li>
        <button class="result" type="button" onclick={() => onopen(name.path)} ontouchstart={() => {}}>
          <span class="icon"><Icon name={iconOf('file', name.path, false)} size={18} /></span>
          <span class="path">
            <span dir="ltr">
              {#each highlight(name.path, name.indices) as piece, at (at)}
                <span class:hit={piece.hit}>{piece.text}</span>
              {/each}
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
  {#if results.found?.capped}
    <p class="note">Only the best 200</p>
  {/if}
{/if}

<style>
  .found {
    margin: 0 calc(-1 * var(--inset));
    padding: 0;
    list-style: none;
  }

  .result {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--gap);
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: var(--gap) var(--inset);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  .result:active {
    background: var(--hover);
  }

  :global(html.pointing) .result:hover {
    background: var(--hover);
  }

  .icon {
    display: flex;
    flex: none;
    color: var(--muted);
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    direction: rtl;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hit {
    color: var(--accent);
    font-weight: 600;
  }

  .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
  }
</style>
