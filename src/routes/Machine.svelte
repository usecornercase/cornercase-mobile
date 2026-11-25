<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { commands, events, type ConnectionView_Serialize, type MachineView_Serialize } from '../lib/bindings'
  import { routeAddress } from '../lib/connection'
  import { EditMachine } from '../lib/editMachine.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Field from '../lib/ui/Field.svelte'
  import Glass from '../lib/ui/Glass.svelte'
  import NavBar from '../lib/ui/NavBar.svelte'
  import ToolButton from '../lib/ui/ToolButton.svelte'
  import UrlField from '../lib/ui/UrlField.svelte'

  let {
    machine,
    taken,
    connection,
    backTo,
    onback,
    onchanged,
    onremoved,
    adding = false,
    edit = new EditMachine(
      commands,
      () => machine,
      () => onchanged(),
      () => onremoved(),
      (toast) => void events.toast.emit(toast),
    ),
  }: {
    machine: MachineView_Serialize
    taken: string[]
    connection: ConnectionView_Serialize | null
    backTo: string | null
    onback: () => void
    onchanged: () => Promise<unknown>
    onremoved: () => Promise<unknown>
    adding?: boolean
    edit?: EditMachine
  } = $props()

  onMount(() => {
    void onchanged()
    return () => void edit.leave()
  })

  untrack(() => {
    if (adding) {
      edit.open()
    }
  })

  const connected = $derived(connection?.state === 'connected' ? connection.route : null)

  const rename = (event: SubmitEvent) => {
    event.preventDefault()
    void edit.rename(taken)
  }

  const addRoute = (event: SubmitEvent) => {
    event.preventDefault()
    void edit.addRoute()
  }
</script>

<section class="screen">
  <NavBar {backTo} title={machine.name} {onback} topmost measure="form" />
  {#if !machine.demo}
    <Glass>
      <form class="form" onsubmit={rename}>
        <Field label="Name" bind:value={edit.name} error={edit.nameError} disabled={edit.busy} />
        <div class="buttons">
          <Button type="submit" resting={edit.unchanged} busy={edit.busy}>Rename</Button>
        </div>
      </form>
    </Glass>
    <h2 class="heading">Routes</h2>
    <Glass>
      <ul class="routes">
        {#each machine.routes as route (route.url)}
          <li class="route">
            <span class="about">
              <span class="address">{routeAddress(route.url)}</span>
              {#if route.url === connected}
                <span class="mark done">Connected</span>
              {/if}
              {#if !route.has_token}
                <span class="mark failed">No secret</span>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </Glass>
    <details class="edit">
      <summary class="summary">Edit routes</summary>
      <div class="editing">
        <Glass>
          <ul class="routes">
            {#each machine.routes as route, index (route.url)}
              <li class="change">
                <span class="address">{routeAddress(route.url)}</span>
                <ToolButton
                  label="Move up"
                  icon="chevron-up"
                  size={20}
                  disabled={edit.busy || index === 0}
                  onclick={() => void edit.move(route.url, 'up')}
                />
                <ToolButton
                  label="Move down"
                  icon="chevron-down"
                  size={20}
                  disabled={edit.busy || index === machine.routes.length - 1}
                  onclick={() => void edit.move(route.url, 'down')}
                />
                <ToolButton
                  label="Remove route"
                  icon="trash-2"
                  size={20}
                  disabled={edit.busy || machine.routes.length === 1}
                  onclick={() => void edit.remove(route.url)}
                />
              </li>
            {/each}
          </ul>
        </Glass>
        {#if !edit.adding && !edit.deleting}
          <div class="actions">
            <Button tone="plain" resting={edit.busy} onclick={() => edit.open()}>Add route</Button>
          </div>
        {/if}
      </div>
    </details>
  {/if}
  {#if edit.formError !== null}
    <p class="problem" role="alert">{edit.formError}</p>
  {/if}
  {#if edit.deleting}
    <Glass>
      <div class="form">
        <h2 class="heading">Delete {machine.name}?</h2>
        {#if machine.demo}
          <p class="lost">The demo ends, and nothing of it stays on this phone.</p>
        {:else}
          <p class="lost">Its routes and their secrets are removed from this phone. The machine still lets it in until you forget it in cornercase › Settings › Remote › Phone app.</p>
        {/if}
        <div class="buttons">
          <Button tone="plain" resting={edit.busy} onclick={() => edit.keep()}>Cancel</Button>
          <Button tone="danger" busy={edit.busy} onclick={() => void edit.deleteMachine()}>Delete</Button>
        </div>
      </div>
    </Glass>
  {:else if edit.adding}
    <Glass>
      <form class="form" onsubmit={addRoute}>
        <h2 class="heading">Scan or paste its code</h2>
        <UrlField
          bind:value={edit.url}
          error={edit.urlError}
          disabled={edit.busy}
          onscanned={(url) => void edit.fill(url)}
        />
        <div class="buttons">
          <Button tone="plain" resting={edit.busy} onclick={() => edit.close()}>Cancel</Button>
          <Button type="submit" busy={edit.busy}>{edit.busy ? 'Adding…' : 'Add'}</Button>
        </div>
      </form>
    </Glass>
  {:else}
    <div class="actions">
      <Button tone="danger" resting={edit.busy} onclick={() => edit.askToDelete()}>Delete machine</Button>
    </div>
  {/if}
</section>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    padding: var(--gap) var(--gutter-form) 40px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    padding: var(--inset-card);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap);
  }

  .heading {
    margin: 0;
    padding: 0 var(--inset);
    color: var(--soft);
    font-size: 13px;
    font-weight: 600;
  }

  .form .heading {
    padding: 0;
  }

  .routes {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .route,
  .change {
    display: flex;
    align-items: center;
    gap: 2px;
    border-top: 1px solid var(--border);
  }

  .route {
    min-height: 44px;
    padding: var(--gap) var(--inset-wide);
  }

  .change {
    padding: var(--gap) var(--inset) var(--gap) var(--inset-wide);
  }

  .route:first-child,
  .change:first-child {
    border-top: 0;
  }

  .summary {
    min-height: 44px;
    padding: 0 var(--inset);
    color: var(--accent);
    font-size: 14px;
    line-height: 44px;
  }

  .change .address {
    flex: 1;
    min-width: 0;
  }

  .editing {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .about {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .address {
    overflow: hidden;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 14px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .mark {
    font-size: 12px;
  }

  .done {
    color: var(--done);
  }

  .failed {
    color: var(--failed);
  }

  .problem {
    margin: 0;
    padding: 0 var(--inset);
    color: var(--failed);
    font-size: 13px;
  }

  .lost {
    margin: 0;
    color: var(--soft);
    font-size: 14px;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: var(--gap);
  }
</style>
