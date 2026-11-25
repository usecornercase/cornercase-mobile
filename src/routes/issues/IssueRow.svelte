<script lang="ts">
  import { elapsed } from '../../lib/board'
  import type { Found } from '../../lib/issueSweep'

  let {
    issue,
    where,
    now,
    onopen,
  }: {
    issue: Found
    where: string
    now: number
    onopen: (issue: Found) => void
  } = $props()

  const age = $derived(elapsed(issue.updated_at, now))
</script>

<button class="issue" type="button" onclick={() => onopen(issue)} ontouchstart={() => {}}>
  <span class="head">
    <span class="state" class:closed={issue.closed}>{issue.state}</span>
    <span class="key">{issue.key}</span>
    <span class="where">{where}</span>
  </span>
  <span class="title">{issue.title}</span>
  <span class="meta">
    <span class="by">{age === '' ? issue.author : `${issue.author} · ${age}`}</span>
    {#each issue.labels as label, at (at)}
      <span class="tag">{label}</span>
    {/each}
  </span>
</button>

<style>
  .issue {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  .issue:active {
    background: var(--hover);
  }

  :global(html.pointing) .issue:hover {
    background: var(--hover);
  }

  .head,
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
    font-size: 13px;
  }

  .state {
    color: var(--done);
  }

  .closed {
    color: var(--muted);
  }

  .key {
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .where {
    color: var(--soft);
  }

  .title {
    overflow-wrap: anywhere;
  }

  .by {
    color: var(--muted);
  }

  .tag {
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    color: var(--soft);
  }
</style>
