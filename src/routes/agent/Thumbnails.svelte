<script lang="ts">
  import type { Chip } from '../../lib/attach.svelte'
  import Icon from '../../lib/ui/Icon.svelte'

  let { chips, onremove }: { chips: Chip[]; onremove: (id: number) => void } = $props()

  const named = (chip: Chip) => `${chip.name}, ${chip.size}${chip.pasted ? ', on the machine' : ''}`
</script>

<ul class="thumbnails" aria-label="Attached images">
  {#each chips as chip (chip.id)}
    <li class="thumbnail" class:pasted={chip.pasted}>
      {#if chip.thumbnail === null}
        <span class="picture" role="img" aria-label={named(chip)}></span>
      {:else}
        <img class="picture" src={chip.thumbnail} alt={named(chip)} />
      {/if}
      {#if chip.pasted}
        <span class="mark" aria-hidden="true">Pasted</span>
      {/if}
      <button
        class="remove"
        type="button"
        aria-label="Remove {chip.name}"
        onclick={() => onremove(chip.id)}
        ontouchstart={() => {}}
      >
        <span class="disc"><Icon name="x" size={14} /></span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .thumbnails {
    display: flex;
    flex: none;
    gap: var(--gap);
    margin: 0;
    padding: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    list-style: none;
    scrollbar-width: none;
  }

  .thumbnail {
    position: relative;
    flex: none;
    width: 56px;
    height: 56px;
  }

  .picture {
    display: block;
    box-sizing: border-box;
    width: 56px;
    height: 56px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--hover);
    object-fit: cover;
  }

  .pasted .picture {
    opacity: 0.6;
  }

  .mark {
    position: absolute;
    bottom: 4px;
    left: 4px;
    padding: 0 4px;
    border-radius: var(--radius-chip);
    background: var(--raised);
    color: var(--soft);
    font-size: 10px;
    line-height: 14px;
  }

  .remove {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    box-sizing: border-box;
    width: 44px;
    height: 44px;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--text);
  }

  .disc {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 1px solid var(--edge);
    border-radius: 50%;
    background: var(--raised);
  }

  .remove:active .disc {
    background: var(--hover);
  }

  :global(html.pointing) .remove:hover .disc {
    background: var(--hover);
  }
</style>
