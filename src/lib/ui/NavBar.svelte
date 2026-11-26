<script lang="ts">
  import type { Snippet } from 'svelte'
  import { backLabel, fitsLabel } from '../navigation'
  import { platform, type Platform } from '../platform'
  import Icon from './Icon.svelte'

  const TAP = 44

  let {
    backTo,
    title,
    center,
    right,
    onback,
    below = 0,
    fixed = true,
    topmost = false,
    rooted = false,
    measure = 'full',
    edge = false,
    variant = platform,
    bar = $bindable(null),
  }: {
    backTo: string | null
    title?: string
    center?: Snippet
    right?: Snippet
    onback: () => void
    below?: number
    fixed?: boolean
    topmost?: boolean
    rooted?: boolean
    measure?: 'full' | 'column' | 'form'
    edge?: boolean
    variant?: Platform
    bar?: HTMLElement | null
  } = $props()

  let room = $state(0)
  let labelWidth = $state(0)

  const ios = $derived(variant === 'ios')
  const fits = $derived(fitsLabel(labelWidth, room - TAP))
</script>

<div
  bind:this={bar}
  class="bar {variant}"
  class:fixed
  class:topmost={fixed && topmost}
  class:column={measure === 'column'}
  class:form={measure === 'form'}
  class:edge
  style:--below="{below}px"
>
  <div class="start" bind:clientWidth={room}>
    {#if !rooted}
      <button class="back" type="button" aria-label={backLabel(backTo)} onclick={onback} ontouchstart={() => {}}>
        <Icon name={ios ? 'chevron-left' : 'arrow-left'} />
        {#if ios && backTo !== null}
          <span class="label" class:hidden={!fits} bind:clientWidth={labelWidth}>{backTo}</span>
        {/if}
      </button>
    {/if}
  </div>
  <div class="center">
    {#if title !== undefined}
      <h1 class="title">{title}</h1>
    {/if}
    {@render center?.()}
  </div>
  <div class="end">
    {@render right?.()}
  </div>
</div>

<style>
  .bar {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--gap);
    min-height: 44px;
    padding: 0 var(--gap);
    border-bottom: 1px solid transparent;
    background: var(--veil);
    -webkit-backdrop-filter: blur(24px);
    backdrop-filter: blur(24px);
  }

  .fixed {
    position: sticky;
    top: calc(env(safe-area-inset-top) + var(--below));
    z-index: 4;
    margin: calc(-1 * var(--gap)) calc(-1 * var(--inset-wide));
    padding: var(--gap) calc(var(--inset-wide) - var(--inset));
  }

  .fixed.topmost {
    top: 0;
    margin-top: calc(-1 * var(--gap) - env(safe-area-inset-top));
    padding-top: calc(var(--gap) + env(safe-area-inset-top));
  }

  .fixed.column {
    margin-right: calc(-1 * var(--gutter));
    margin-left: calc(-1 * var(--gutter));
  }

  .fixed.form {
    margin-right: calc(-1 * var(--gutter-form));
    margin-left: calc(-1 * var(--gutter-form));
  }

  .edge {
    border-bottom-color: var(--border);
  }

  .android {
    grid-template-columns: auto 1fr auto;
  }

  .start {
    display: flex;
    min-width: 44px;
    overflow: hidden;
  }

  .back {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    max-width: 100%;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--accent);
  }

  .back:active {
    background: var(--hover);
  }

  :global(html.pointing) .back:hover {
    background: var(--hover);
  }

  .label {
    font-size: 17px;
    white-space: nowrap;
  }

  .hidden {
    position: absolute;
    visibility: hidden;
  }

  .center {
    min-width: 0;
    overflow: hidden;
    text-align: center;
  }

  .android .center {
    text-align: left;
  }

  .title {
    margin: 0;
    overflow: hidden;
    color: var(--text);
    font-size: 17px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .end {
    display: flex;
    justify-content: flex-end;
  }
</style>
