<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons/shapes'

  let {
    label,
    icon,
    size = 24,
    disabled = false,
    onclick,
  }: {
    label: string
    icon: IconName
    size?: number
    disabled?: boolean
    onclick: () => void
  } = $props()
</script>

<button class="tool" type="button" aria-label={label} {disabled} {onclick} ontouchstart={() => {}}>
  <Icon name={icon} {size} />
</button>

<style>
  .tool {
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
    color: var(--accent);
  }

  .tool:active {
    background: var(--hover);
  }

  :global(html.pointing) .tool:not(:disabled):hover {
    background: var(--hover);
  }

  .tool:disabled {
    color: var(--faint);
    background: none;
  }
</style>
