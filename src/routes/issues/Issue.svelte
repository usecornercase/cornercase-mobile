<script lang="ts">
  import { elapsed } from '../../lib/board'
  import type { IssueState } from '../../lib/issues.svelte'
  import type { StartingIssue, Where } from '../../lib/router.svelte'
  import Button from '../../lib/ui/Button.svelte'
  import Markdown from '../../lib/ui/Markdown.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'

  let {
    issue,
    where,
    backTo,
    onback,
    onstart,
    now = Date.now(),
  }: {
    issue: IssueState
    where: Where
    backTo: string | null
    onback: () => void
    onstart: (starting: StartingIssue) => void
    now?: number
  } = $props()

  const reading = $derived(issue.reading)
  const read = $derived(reading.kind === 'read' ? reading.read : null)

  const byline = (author: string, at: string) => {
    const age = elapsed(at, now)
    return age === '' ? author : `${author} · ${age}`
  }

  const start = () => {
    if (read !== null) {
      const chosen = { ...read.issue, source: issue.source, key: issue.key }
      onstart({ ...where, issue: chosen, prompt: read.prompt })
    }
  }
</script>

<section class="screen">
  <NavBar {backTo} title={issue.key} {onback} topmost measure="column" />
  {#if reading.kind === 'failed'}
    <div class="failed">
      <p class="note reason">{reading.reason}</p>
      <Button tone="plain" onclick={() => void issue.retry()}>Try again</Button>
    </div>
  {:else if read === null}
    <p class="note"><Spinner />Reading the issue…</p>
  {:else}
    <header class="head">
      <p class="line">
        <span class="state" class:closed={read.issue.closed}>{read.issue.state}</span>
        <span class="key">{read.issue.key}</span>
        <span class="by">{byline(read.issue.author, read.issue.updated_at)}</span>
      </p>
      <h2 class="name">{read.issue.title}</h2>
      {#if read.issue.labels.length > 0}
        <p class="line">
          {#each read.issue.labels as tag, at (at)}
            <span class="tag">{tag}</span>
          {/each}
        </p>
      {/if}
      {#if read.issue.branch !== ''}
        <p class="line"><span class="branch">{read.issue.branch}</span></p>
      {/if}
      <div class="actions">
        <Button onclick={start}>Start</Button>
      </div>
    </header>
    {#if read.body.trim() === ''}
      <p class="note">No description</p>
    {:else}
      <Markdown text={read.body} />
    {/if}
    {#if read.comments.length > 0}
      <h3 class="comments">Comments</h3>
      <ul class="thread">
        {#each read.comments as comment, at (at)}
          <li class="comment">
            <span class="by">{byline(comment.author, comment.created_at)}</span>
            <Markdown text={comment.body} />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    padding: var(--gap) var(--gutter) 40px;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
    margin: 0;
    font-size: 13px;
  }

  .state {
    color: var(--done);
  }

  .closed,
  .key,
  .by {
    color: var(--muted);
  }

  .key,
  .branch {
    font-family: var(--font-mono);
  }

  .branch {
    color: var(--soft);
    overflow-wrap: anywhere;
  }

  .name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .tag {
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    color: var(--soft);
  }

  .actions {
    display: flex;
  }

  .comments {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .comment {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: var(--inset);
    border-top: 1px solid var(--border);
  }

  .comment .by {
    font-size: 13px;
  }

  .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
  }

  .failed {
    display: flex;
    align-items: center;
    gap: var(--gap);
  }

  .reason {
    flex: 1;
    min-width: 0;
    color: var(--failed);
    overflow-wrap: anywhere;
  }
</style>
