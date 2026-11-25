<script lang="ts">
  import { onMount } from 'svelte'
  import { RESTING, translated, type Shift } from '../../lib/backSwipe'
  import {
    commands,
    events,
    type AgentRow_Serialize as AgentRow,
    type InputEvent_Deserialize as InputEvent,
    type Size_Deserialize,
  } from '../../lib/bindings'
  import { label, place } from '../../lib/board'
  import { ShownCtrl } from '../../lib/terminal/ctrl.svelte'
  import { Fit } from '../../lib/terminal/fit.svelte'
  import { isField, Keyboard, whileClosed } from '../../lib/terminal/keyboard.svelte'
  import KeyRow from '../../lib/terminal/KeyRow.svelte'
  import { Opening } from '../../lib/terminal/opening'
  import { Pane, shows } from '../../lib/terminal/pane.svelte'
  import { Sending } from '../../lib/terminal/sending'
  import TerminalView from '../../lib/terminal/Terminal.svelte'
  import Typist from '../../lib/terminal/Typist.svelte'
  import { layout } from '../../lib/layout.svelte'
  import Icon from '../../lib/ui/Icon.svelte'
  import NavBar from '../../lib/ui/NavBar.svelte'

  let {
    machine,
    row,
    backTo,
    shift = RESTING,
    onback,
    onfailed,
    height = $bindable(0),
  }: {
    machine: number
    row: AgentRow
    backTo: string | null
    shift?: Shift
    onback: () => void
    onfailed: (error: unknown) => void
    height?: number
  } = $props()

  const shown = new Pane()
  const ctrl = new ShownCtrl()
  const keyboard = new Keyboard(globalThis)
  const fit = new Fit()
  const sending = new Sending(shown, {
    input: commands.terminalInput,
    scroll: commands.terminalScroll,
    failed: (error) => onfailed(error),
  })
  const send = (events: InputEvent[]) => sending.input(events)
  let wanted = $state.raw<Size_Deserialize | null>(null)
  let opening: Opening | null = null
  let typist: Typist | undefined
  const fitted = whileClosed(keyboard, (size: Size_Deserialize) => (wanted = size))

  const stray = (event: KeyboardEvent) => {
    if (!isField(event.target)) {
      typist?.take(event)
    }
  }

  onMount(() => {
    const unlisten = events.terminalChanged.listen((event) => {
      if (shows(event.payload, machine, row.tab)) {
        shown.apply(event.payload)
        if (event.payload.unfitted) {
          fit.unfitted()
        }
      }
    })
    const open = (size: Size_Deserialize, fitting: boolean) =>
      commands.terminalOpen(row.tab, row.pane, { size, fit: fitting })
    const close = () => commands.terminalClose(row.tab)
    opening = new Opening(unlisten, { open, close, failed: onfailed })
    const unwatch = keyboard.watch()
    const unwatchPage = fit.watch(document)
    return () => {
      unwatch()
      unwatchPage()
      unlisten.then((stop) => stop()).catch(onfailed)
      opening?.leave()
    }
  })

  $effect(() => {
    if (wanted !== null && opening !== null) {
      fit.ask(opening, wanted)
    }
  })
</script>

<svelte:document onkeydown={stray} />

<section
  class="screen"
  class:keyboard={keyboard.covered}
  class:sliding={shift.x > 0}
  class:settling={shift.eased}
  style:transform={translated(shift)}
  style:top={keyboard.covered ? `${keyboard.offset}px` : undefined}
  style:height={keyboard.covered ? `${keyboard.height}px` : undefined}
>
  <Typist bind:this={typist} {ctrl} {send} disabled={shown.current.closed} />
  <div class="head" bind:clientHeight={height}>
    <NavBar {backTo} title={label(row)} {onback} fixed={false} edge>
      {#snippet center()}
        <p class="where">{row.tab_name} · {place(row)}</p>
      {/snippet}
      {#snippet right()}
        {#if layout.wide}
          <button
            class="fit"
            type="button"
            aria-label="Full width"
            aria-pressed={layout.full}
            onclick={() => layout.toggleFull()}
          >
            <Icon name="maximize-2" />
          </button>
        {/if}
        <button
          class="fit"
          type="button"
          aria-label="Fit to this screen"
          aria-pressed={fit.on}
          onclick={() => fit.toggle()}
        >
          <Icon name="smartphone" />
        </button>
      {/snippet}
    </NavBar>
  </div>
  <div class="view">
    <TerminalView
      pane={shown.current}
      place={{ machine, boot: row.boot, tab: row.tab, fitted: fit.on }}
      onfit={fitted}
      ontap={() => typist?.focus()}
      onsend={send}
      onscroll={(rowsUp) => sending.scroll(rowsUp)}
    />
  </div>
  {#if shown.current.closed}
    <p class="closed" role="status">This tab was closed on the machine</p>
  {/if}
  <KeyRow {ctrl} {send} {onfailed} disabled={shown.current.closed} />
</section>

<style>
  .screen {
    position: fixed;
    inset: 0 0 0 var(--pane-left);
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      var(--pane-safe-left);
    background: var(--glass);
  }

  .keyboard {
    padding-bottom: 0;
  }

  .head {
    flex: none;
  }

  .fit {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--soft);
  }

  .fit:active {
    color: var(--text);
  }

  :global(html.pointing) .fit:hover {
    background: var(--hover);
  }

  .fit[aria-pressed='true'] {
    color: var(--accent);
  }

  .where {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--muted);
    font-size: 12px;
  }

  .view {
    flex: 1;
    min-height: 0;
  }

  .closed {
    flex: none;
    margin: 0;
    padding: var(--inset) var(--inset-wide);
    border-top: 1px solid var(--border);
    color: var(--failed);
    font-size: 14px;
  }
</style>
