<script lang="ts">
  import type { Tab } from '../../lib/bindings'

  let {
    tabs,
    open,
    ontab,
  }: {
    tabs: Tab[]
    open: number | null
    ontab: (index: number) => void
  } = $props()

  const TICK = '\u2714\uFE0E'

  const tappable = $derived(open !== null && tabs.length > 1)
</script>

{#snippet chip(tab: Tab)}
  {#if tab.answered}<span class="tick" role="img" aria-label="answered">{TICK}</span>{/if}{tab.label}
{/snippet}

<div class="tabs" role="group" aria-label="Questions">
  {#each tabs as tab, index (index)}
    {#if tappable && index !== open}
      <button class="chip" type="button" onclick={() => ontab(index)} ontouchstart={() => {}}
        >{@render chip(tab)}</button
      >
    {:else}
      <span class="chip" class:open={index === open} aria-current={index === open ? 'true' : undefined}
        >{@render chip(tab)}</span
      >
    {/if}
  {/each}
</div>

<style>
  .tabs {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: calc(-1 * var(--gap));
    padding-bottom: var(--gap);
    border-bottom: 1px solid var(--border);
    background: var(--glass);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-chip);
    background: none;
    color: var(--soft);
    font: inherit;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  button.chip:active {
    background: var(--selected);
  }

  :global(html.pointing) button.chip:hover:not(:active) {
    background: var(--hover);
  }

  .open {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .tick {
    color: var(--done);
  }
</style>
