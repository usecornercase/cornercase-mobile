<script lang="ts">
  import type { FormEventHandler } from 'svelte/elements'
  import Icon from './Icon.svelte'

  let {
    label,
    value = $bindable(''),
    oninput,
    oncancel,
  }: {
    label: string
    value?: string
    oninput?: FormEventHandler<HTMLInputElement>
    oncancel?: () => void
  } = $props()

  let field: HTMLInputElement | undefined = $state()

  let focused = $state(false)

  const cancelling = $derived(oncancel !== undefined && (focused || value !== ''))

  const cancel = () => {
    value = ''
    field?.blur()
    oncancel?.()
  }

  const submit = (event: KeyboardEvent) => {
    if (oncancel !== undefined && event.key === 'Enter') {
      field?.blur()
    }
  }
</script>

<div class="bar">
  <label class="search">
    <Icon name="search" size={18} />
    <input
      class="query"
      type="search"
      aria-label={label}
      placeholder={label}
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="search"
      bind:this={field}
      bind:value
      {oninput}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      onkeydown={submit}
    />
  </label>
  {#if cancelling}
    <button
      class="cancel"
      type="button"
      onmousedown={(event) => event.preventDefault()}
      onclick={cancel}
      ontouchstart={() => {}}
    >
      Cancel
    </button>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--gap);
  }

  .search {
    box-sizing: border-box;
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--edge);
    border-radius: var(--radius-control);
    background: var(--field);
    color: var(--faint);
  }

  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 32%, transparent);
  }

  .query {
    flex: 1;
    min-width: 0;
    min-height: 42px;
    padding: 0;
    border: none;
    outline: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 16px;
    -webkit-user-select: text;
    user-select: text;
  }

  .query::placeholder {
    color: var(--muted);
  }

  .cancel {
    flex: none;
    min-height: 44px;
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 16px;
  }

  .cancel:active {
    opacity: 0.5;
  }

  :global(html.pointing) .cancel:hover:not(:active) {
    opacity: 0.85;
  }
</style>
