<script lang="ts">
  import Icon from '../../lib/ui/Icon.svelte'

  let {
    viewed,
    onflip,
  }: {
    viewed: boolean
    onflip: () => void
  } = $props()
</script>

<button class="check" type="button" aria-label="Viewed" aria-pressed={viewed} onclick={onflip} ontouchstart={() => {}}>
  <Icon name={viewed ? 'square-check' : 'square'} size={22} />
</button>

<style>
  .check {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--muted);
  }

  .check:active {
    background: var(--hover);
  }

  :global(html.pointing) .check:hover {
    background: var(--hover);
  }

  .check[aria-pressed='true'] {
    color: var(--accent);
  }
</style>
