<script lang="ts">
  import type { Snippet } from 'svelte'
  import Spinner from './Spinner.svelte'

  let {
    tone = 'primary',
    type = 'button',
    quiet = false,
    resting = false,
    busy = false,
    compact = false,
    current = false,
    label,
    expanded,
    onclick,
    children,
  }: {
    tone?: 'primary' | 'plain' | 'danger' | 'link'
    type?: 'button' | 'submit'
    quiet?: boolean
    resting?: boolean
    busy?: boolean
    compact?: boolean
    current?: boolean
    label?: string
    expanded?: boolean
    onclick?: (event: MouseEvent) => void
    children: Snippet
  } = $props()
</script>

<button
  class="button {tone}"
  class:quiet
  class:compact
  class:current
  class:resting
  class:busy
  {type}
  disabled={resting || busy}
  aria-disabled={resting ? 'true' : undefined}
  aria-busy={busy ? 'true' : undefined}
  aria-label={label}
  aria-expanded={expanded}
  aria-current={current ? 'true' : undefined}
  {onclick}
  ontouchstart={() => {}}
>
  {#if busy}
    <Spinner />
  {/if}
  {@render children()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 var(--inset-wide);
    border-radius: var(--radius-control);
    font: inherit;
    font-size: 16px;
    white-space: nowrap;
  }

  .compact {
    min-width: 44px;
    padding: 0 var(--inset);
  }

  .primary {
    border: 1px solid rgb(43 123 255 / 0.7);
    background: linear-gradient(180deg, var(--brand), var(--brand-hover));
    box-shadow: 0 0 10px rgb(0 95 255 / 0.28);
    color: var(--on-brand);
    font-weight: 500;
  }

  .plain {
    border: 1px solid var(--border);
    background: var(--hover);
    color: var(--soft);
  }

  .danger {
    border: 1px solid color-mix(in srgb, var(--failed) 35%, transparent);
    background: color-mix(in srgb, var(--failed) 10%, transparent);
    color: var(--failed);
  }

  .link {
    padding: 0 6px;
    border: 1px solid transparent;
    background: none;
    color: var(--accent);
    font-size: inherit;
  }

  .primary:not(.resting):active {
    background: var(--brand-hover);
  }

  .plain.current {
    border-color: var(--edge);
    background: var(--selected);
    color: var(--text);
  }

  .plain:not(.resting):active {
    border-color: var(--edge);
    background: var(--selected);
  }

  .danger:not(.resting):active {
    border-color: color-mix(in srgb, var(--failed) 70%, transparent);
    background: color-mix(in srgb, var(--failed) 18%, transparent);
  }

  .link:not(.resting):active {
    opacity: 0.7;
  }

  :global(html.pointing) .primary:not(.resting):hover:not(:active),
  :global(html.pointing) .danger:not(.resting):hover:not(:active) {
    filter: brightness(1.1);
  }

  :global(html.pointing) .plain:not(.resting):hover:not(:active) {
    background: var(--selected);
  }

  :global(html.pointing) .link:not(.resting):hover:not(:active) {
    opacity: 0.85;
  }

  .quiet {
    margin-left: calc(-1 * var(--inset));
    padding: 0 var(--inset);
    border-color: transparent;
    background: none;
  }

  .quiet:not(.resting):active {
    border-color: transparent;
  }

  :global(html.pointing) .quiet:not(.resting):hover:not(:active) {
    background: var(--hover);
  }

  .resting {
    opacity: 0.4;
    pointer-events: none;
  }

  .busy {
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .button {
      transition: transform var(--pop) cubic-bezier(0.23, 1, 0.32, 1);
    }

    .button:not(.resting):active {
      transform: scale(0.97);
    }
  }
</style>
