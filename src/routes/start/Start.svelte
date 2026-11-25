<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { commands, type ConnectionView_Serialize, type Started_Serialize as Started } from '../../lib/bindings'
  import type { StartingIssue } from '../../lib/router.svelte'
  import { StartForm } from '../../lib/startForm.svelte'
  import Glass from '../../lib/ui/Glass.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'
  import AgentForm from './AgentForm.svelte'
  import IssueForm from './IssueForm.svelte'
  import Segmented from './Segmented.svelte'
  import ShowIssues from './ShowIssues.svelte'

  type Action = 'agent' | 'issue'

  let {
    connection,
    issue,
    workspace,
    backTo,
    onback,
    onstarted,
    onissues,
    form = new StartForm(commands, (started, agent) => onstarted(started, agent)),
  }: {
    connection: ConnectionView_Serialize
    issue?: StartingIssue
    workspace?: number
    backTo: string | null
    onback: () => void
    onstarted: (started: Started, agent: string) => void
    onissues: () => void
    form?: StartForm
  } = $props()

  const ACTIONS: [Action, string][] = [
    ['agent', 'Agent'],
    ['issue', 'Issue'],
  ]

  let action = $state<Action>('agent')

  untrack(() => {
    if (issue !== undefined) {
      form.forIssue(issue)
    }
    if (workspace !== undefined) {
      form.prefer(workspace)
    }
  })

  const sendable = $derived(connection.state === 'connected')

  onMount(() => {
    void form.load()
  })

  $effect(() => {
    const connected = sendable
    untrack(() => void form.see(connected))
  })
</script>

<section class="screen">
  <NavBar {backTo} title="Start" {onback} topmost measure="form" />
  {#if form.issue === null}
    <Segmented label="What to start" options={ACTIONS} bind:value={action} disabled={form.sending} />
  {/if}
  {#if !sendable}
    <p class="offline">Not connected to the machine. What you type stays here until it connects.</p>
  {/if}
  <Glass>
    {#if form.issue !== null}
      <IssueForm {form} {sendable} />
    {:else if action === 'agent'}
      <AgentForm {form} {sendable} />
    {:else}
      <ShowIssues {sendable} onshow={onissues} />
    {/if}
  </Glass>
</section>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    padding: var(--gap) var(--gutter-form) 40px;
  }

  .offline {
    margin: 0;
    padding: 0 var(--inset);
    color: var(--muted);
    font-size: 13px;
  }
</style>
