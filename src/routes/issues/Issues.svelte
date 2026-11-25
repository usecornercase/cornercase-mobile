<script lang="ts">
  import type { SourceInfo_Serialize as SourceInfo } from '../../lib/bindings'
  import type { Failure, Filters, IssuesState } from '../../lib/issues.svelte'
  import type { Found } from '../../lib/issueSweep'
  import Button from '../../lib/ui/Button.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import SearchField from '../../lib/ui/SearchField.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import Connect from './Connect.svelte'
  import IssueRow from './IssueRow.svelte'

  type Segment = { key: string; name: string; pressed: boolean; change: Partial<Filters> }

  let {
    issues,
    backTo,
    onback,
    onopen,
    now = Date.now(),
  }: {
    issues: IssuesState
    backTo: string | null
    onback: () => void
    onopen: (issue: Found) => void
    now?: number
  } = $props()

  const trackers = $derived(issues.trackers)
  const filters = $derived(issues.filters)
  const shown = $derived(issues.issues)

  const states = $derived<Segment[]>([
    { key: 'open', name: 'Open', pressed: !filters.closed, change: { closed: false } },
    { key: 'closed', name: 'Closed too', pressed: filters.closed, change: { closed: true } },
  ])

  const people = $derived<Segment[]>([
    { key: 'all', name: 'All', pressed: !filters.mine, change: { mine: false } },
    { key: 'mine', name: 'Mine', pressed: filters.mine, change: { mine: true } },
  ])

  const sources = $derived<Segment[]>([
    { key: '', name: 'All trackers', pressed: filters.source === null, change: { source: null } },
    ...issues.connected.map((tracker) => ({
      key: tracker.source,
      name: tracker.name,
      pressed: filters.source === tracker.source,
      change: { source: tracker.source },
    })),
  ])

  const failingOf = (known: SourceInfo[], listed: Failure[]): Failure[] =>
    known
      .filter((tracker) => tracker.state === 'failing' && !listed.some((failure) => failure.source === tracker.source))
      .map((tracker) => ({ source: tracker.source, name: tracker.name, error: tracker.reason ?? 'It is failing.' }))

  const broken = $derived([
    ...issues.failures,
    ...failingOf(trackers.kind === 'ready' ? trackers.sources : [], issues.failures),
  ])

  const empty = $derived.by(() => {
    if (issues.query.trim() !== '') {
      return 'No issue matches the search'
    }
    return filters.closed ? 'No issues' : 'No open issues'
  })

  const whereOf = (issue: Found) => {
    const tracker = issues.nameOf(issue.source)
    return issue.repository ? `${tracker} · ${issues.projectName(issue.project)}` : tracker
  }

  const retry = () => void issues.retry()
</script>

{#snippet group(label: string, segments: Segment[])}
  <div class="segments" role="group" aria-label={label}>
    {#each segments as segment (segment.key)}
      <button
        class="segment"
        type="button"
        aria-pressed={segment.pressed}
        onclick={() => void issues.filter(segment.change)}
        ontouchstart={() => {}}
      >
        {segment.name}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet failed(reason: string)}
  <div class="failed">
    <p class="note reason">{reason}</p>
    <Button tone="plain" onclick={retry}>Try again</Button>
  </div>
{/snippet}

<section class="screen">
  <NavBar {backTo} title="Issues" {onback} topmost measure="column">
    {#snippet right()}
      {#if issues.loading && issues.swept !== null}
        <span class="busy"><Spinner /></span>
      {/if}
    {/snippet}
  </NavBar>
  {#if trackers.kind === 'loading'}
    <p class="note"><Spinner />Reading the trackers…</p>
  {:else if trackers.kind === 'failed'}
    {@render failed(trackers.reason)}
  {:else if issues.connect}
    <Connect sources={trackers.sources} onretry={() => void issues.load()} />
  {:else}
    <SearchField label="Search issues" bind:value={issues.query} />
    <div class="filters">
      {@render group('State', states)}
      {@render group('People', people)}
    </div>
    {#if issues.choosable}
      {@render group('Tracker', sources)}
    {/if}
    {#each broken as failure (failure.source)}
      <p class="note failing">{failure.name}: {failure.error}</p>
    {/each}
    {#if issues.error !== null}
      {@render failed(issues.error)}
    {/if}
    {#if shown.length > 0}
      <ul class="issues">
        {#each shown as issue (`${issue.project}:${issue.source}:${issue.key}`)}
          <li><IssueRow {issue} where={whereOf(issue)} {now} {onopen} /></li>
        {/each}
      </ul>
    {:else if issues.swept === null}
      {#if issues.loading}
        <p class="note"><Spinner />Reading the issues…</p>
      {/if}
    {:else}
      <p class="note">{empty}</p>
    {/if}
    {#if issues.capped}
      <p class="note">A tracker has more issues than these. Narrow the filters to see the rest.</p>
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

  .busy {
    display: flex;
    padding-right: var(--inset);
  }

  .filters {
    display: flex;
    gap: var(--gap);
  }

  .segments {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--field);
  }

  .segment {
    flex: 1;
    min-height: 44px;
    padding: 0 var(--gap);
    border: 0;
    border-radius: calc(var(--radius-control) - 2px);
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 15px;
    white-space: nowrap;
  }

  .segment:active {
    background: var(--hover);
  }

  .segment[aria-pressed='true'] {
    background: var(--selected);
    color: var(--text);
  }

  .issues {
    margin: 0 calc(-1 * var(--inset));
    padding: 0;
    list-style: none;
  }

  .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
  }

  .failing,
  .reason {
    color: var(--failed);
    overflow-wrap: anywhere;
  }

  .failed {
    display: flex;
    align-items: center;
    gap: var(--gap);
  }

  .reason {
    flex: 1;
    min-width: 0;
  }
</style>
