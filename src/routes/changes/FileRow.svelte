<script lang="ts">
  import type { ChangedFile_Serialize as ChangedFile } from '../../lib/bindings'
  import { shownPath, statusLetter } from '../../lib/diff'
  import Viewed from './Viewed.svelte'

  const TAGS: Partial<Record<ChangedFile['fold'], string>> = {
    lockfile: 'lockfile',
    binary: 'binary',
    large: 'too large',
  }

  let {
    file,
    onopen,
    onviewed,
  }: {
    file: ChangedFile
    onopen: (path: string) => void
    onviewed: (path: string, viewed: boolean) => void
  } = $props()

  const tag = $derived(TAGS[file.fold])
</script>

<div class="row" class:viewed={file.viewed}>
  <button class="open" type="button" onclick={() => onopen(file.path)} ontouchstart={() => {}}>
    <span class="letter {file.status}">{statusLetter(file.status)}</span>
    <span class="path"><span dir="ltr">{shownPath(file)}</span></span>
    {#if tag !== undefined}
      <span class="tag">{tag}</span>
    {/if}
    {#if file.added > 0}
      <span class="plus">+{file.added}</span>
    {/if}
    {#if file.removed > 0}
      <span class="minus">−{file.removed}</span>
    {/if}
  </button>
  <Viewed viewed={file.viewed} onflip={() => onviewed(file.path, !file.viewed)} />
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
  }

  .open {
    box-sizing: border-box;
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--gap);
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

  .open:active {
    background: var(--hover);
  }

  :global(html.pointing) .open:hover {
    background: var(--hover);
  }

  .viewed .open {
    color: var(--muted);
  }

  .letter {
    flex: none;
    width: 1ch;
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .modified {
    color: var(--working);
  }

  .added,
  .untracked {
    color: var(--done);
  }

  .deleted {
    color: var(--failed);
  }

  .renamed {
    color: var(--accent);
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

  .tag {
    flex: none;
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
  }

  .plus,
  .minus {
    flex: none;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .plus {
    color: var(--done);
  }

  .minus {
    color: var(--failed);
  }

  .viewed .letter,
  .viewed .plus,
  .viewed .minus {
    color: var(--faint);
  }
</style>
