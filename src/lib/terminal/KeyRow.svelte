<script lang="ts">
  import Icon from '../ui/Icon.svelte'
  import { ROW, type InputEvent, type RowKey, type StickyCtrl } from './keys'
  import { byKeyboard, press } from './row'

  let {
    ctrl,
    send,
    onfailed,
    disabled = false,
  }: {
    ctrl: StickyCtrl
    send: (events: InputEvent[]) => void
    onfailed: (error: unknown) => void
    disabled?: boolean
  } = $props()

  const pressed = (key: RowKey) => {
    press(key, { ctrl, disabled, send, failed: onfailed, clipboard: navigator.clipboard })
  }
</script>

<div class="keys" role="toolbar" aria-label="Terminal keys">
  {#each ROW as key (key.label)}
    <button
      class="key"
      class:armed={key.kind === 'ctrl' && ctrl.armed}
      type="button"
      aria-pressed={key.kind === 'ctrl' ? ctrl.armed : undefined}
      aria-label={key.icon === undefined ? undefined : key.label}
      {disabled}
      onpointerup={() => pressed(key)}
      onclick={(event) => byKeyboard(event) && pressed(key)}
      ontouchstart={() => {}}
      ontouchend={(event) => event.preventDefault()}
      >{#if key.icon === undefined}{key.label}{:else}<Icon name={key.icon} size={20} />{/if}</button
    >
  {/each}
</div>

<style>
  .keys {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(52px, 1fr));
    gap: 4px;
    padding: 4px;
    border-top: 1px solid var(--border);
    background: var(--panel);
  }

  .key {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--hover);
    color: var(--soft);
    font-family: var(--font-mono);
    font-size: 15px;
    white-space: nowrap;
  }

  .key:active {
    background: var(--selected);
    color: var(--text);
  }

  :global(html.pointing) .key:not(:disabled):hover {
    background: var(--selected);
  }

  .armed {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .key:disabled {
    opacity: 0.4;
  }
</style>
