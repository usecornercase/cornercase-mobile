import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import type { AgentRow_Serialize as AgentRow, Size_Deserialize } from '../../lib/bindings'
import { layout, WIDE } from '../../lib/layout.svelte'
import { Fit, type Page } from '../../lib/terminal/fit.svelte'
import { Keyboard, whileClosed } from '../../lib/terminal/keyboard.svelte'
import { Opening } from '../../lib/terminal/opening'
import { empty, type PaneState } from '../../lib/terminal/pane.svelte'
import { Sending, type Sent } from '../../lib/terminal/sending'
import Terminal from './Terminal.svelte'
import terminalSource from './Terminal.svelte?raw'

const ROW: AgentRow = {
  boot: 'b1',
  agent: 'claude',
  title: 'Fix the login flow',
  status: 'working',
  since: null,
  parent: null,
  depth: 0,
  role: null,
  rank_status: 'working',
  pane: 30,
  tab: 3,
  tab_name: 'fix login',
  workspace: 2,
  workspace_name: 'main',
  workspace_count: 2,
  project: 1,
  project_name: 'app',
}

const drawn = () =>
  render(Terminal, {
    props: { machine: 1, row: ROW, backTo: 'Fix the login flow', onback: () => {}, onfailed: () => {} },
  }).body.replaceAll('<!---->', '')

const body = drawn()

const quiet = { addEventListener: () => {}, removeEventListener: () => {} }

const drawnAt = (innerWidth: number) => {
  const stop = layout.watch({ ...quiet, innerWidth })
  const shown = drawn()
  stop()
  layout.watch(quiet)()
  return shown
}

const source = terminalSource.replace(/\s+/g, ' ')

describe('the terminal screen', () => {
  it('goes back to its agent from the start of a bar that is the fixed row of the screen', () => {
    expect(body).toMatch(
      /<div class="head svelte-[\w-]+"><div class="bar ios svelte-[\w-]+ edge" style="--below: 0px;"><div class="start svelte-[\w-]+">(<!--[^>]*-->)*<button class="back svelte-[\w-]+" type="button" aria-label="Back to Fix the login flow"><svg[^>]*>(<!--[^>]*-->)*<path d="m15 18-6-6 6-6">/,
    )
    expect(source).toContain('<div class="head" bind:clientHeight={height}> <NavBar {backTo} title={label(row)} {onback} fixed={false} edge>')
    expect(source).toContain('.head { flex: none; }')
    expect(source).toContain(
      '.screen { position: fixed; inset: 0 0 0 var(--pane-left); z-index: 1; box-sizing: border-box; display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) var(--pane-safe-left);',
    )
    expect(body).not.toContain('<header')
  })

  it('slides with the edge swipe back, resting when nothing shifts it', () => {
    expect(source).toContain('shift = RESTING,')
    expect(source).toContain(
      'class:sliding={shift.x > 0} class:settling={shift.eased} style:transform={translated(shift)}',
    )
  })

  it('names its agent as the title, with the tab and place under it, in the middle of the bar', () => {
    expect(body).toMatch(
      /<div class="center svelte-[\w-]+">(<!--[^>]*-->)*<h1 class="title svelte-[\w-]+">Fix the login flow<\/h1>(<!--[^>]*-->| )*<p class="where svelte-[\w-]+">fix login · app › main<\/p><\/div>/,
    )
    expect(source).toContain('.where { margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;')
  })

  it('draws the pane in the space left under its bar', () => {
    expect(body).toMatch(/<div class="view svelte-[\w-]+"><div class="terminal svelte-[\w-]+"/)
    expect(source).toContain('.view { flex: 1; min-height: 0; }')
  })

  it('says nothing about a closed tab before it closes', () => {
    expect(body).not.toContain('class="closed')
    expect(source).toContain(
      '{#if shown.current.closed} <p class="closed" role="status">This tab was closed on the machine</p> {/if}',
    )
  })

  it('takes only the changes of its machine and tab', () => {
    expect(source).toContain('if (shows(event.payload, machine, row.tab)) { shown.apply(event.payload)')
  })

  it('opens the pane of its agent and remembers the zoom on the boot of its server, apart for each mode', () => {
    expect(source).toContain(
      'const open = (size: Size_Deserialize, fitting: boolean) => commands.terminalOpen(row.tab, row.pane, { size, fit: fitting })',
    )
    expect(source).toContain('place={{ machine, boot: row.boot, tab: row.tab, fitted: fit.on }}')
  })

  it('leaves the order of opening and closing to an Opening that waits for it to listen', () => {
    expect(source).toContain('const close = () => commands.terminalClose(row.tab)')
    expect(source).toContain('new Opening(unlisten, { open, close, failed: onfailed })')
    expect(source).toContain('if (wanted !== null && opening !== null) { fit.ask(opening, wanted) }')
    expect(source).toContain('opening?.leave()')
  })
})

describe('typing and the keys on the terminal screen', () => {
  it('mounts the hidden field and the row of keys on one Ctrl, both off on a closed tab', () => {
    expect(body).toMatch(/<section class="screen svelte-[\w-]+"><textarea class="typist svelte-[\w-]+"/)
    expect(body).toMatch(/<div class="keys svelte-[\w-]+" role="toolbar" aria-label="Terminal keys">/)
    expect(source).toContain('const ctrl = new ShownCtrl()')
    expect(source).toContain('<Typist bind:this={typist} {ctrl} {send} disabled={shown.current.closed} />')
    expect(source).toContain('<KeyRow {ctrl} {send} {onfailed} disabled={shown.current.closed} />')
  })

  it('focuses the field on a tap, and sends swipes and scrolls to the shown pane', () => {
    expect(source).toContain('ontap={() => typist?.focus()}')
    expect(source).toContain('onsend={send} onscroll={(rowsUp) => sending.scroll(rowsUp)}')
    expect(source).toContain('input: commands.terminalInput, scroll: commands.terminalScroll,')
  })

  it('follows whatever covers the screen while it watches, and asks for a size only with the keyboard closed', () => {
    expect(source).toContain('const unwatch = keyboard.watch()')
    expect(source).toContain('return () => { unwatch()')
    expect(source).toContain('class:keyboard={keyboard.covered}')
    expect(source).toContain('style:height={keyboard.covered ? `${keyboard.height}px` : undefined}')
    expect(source).toContain('style:top={keyboard.covered ? `${keyboard.offset}px` : undefined}')
    expect(source).toContain('const fitted = whileClosed(keyboard, (size: Size_Deserialize) => (wanted = size))')
    expect(source).toContain('onfit={fitted}')
    expect(source).toContain('.keyboard { padding-bottom: 0; }')
  })
})

const FULL = 900

const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a keyboard opening and closing', () => {
  const viewport = { height: FULL, offsetTop: 0, resized: () => {} }
  const screen = {
    innerWidth: 411,
    innerHeight: FULL,
    visualViewport: {
      get height() {
        return viewport.height
      },
      offsetTop: 0,
      addEventListener: (_: string, listener: () => void) => (viewport.resized = listener),
      removeEventListener: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }

  const resize = (height: number) => {
    viewport.height = height
    viewport.resized()
  }

  it('does not open the pane again with the size of the smaller screen', async () => {
    const keyboard = new Keyboard(screen)
    keyboard.watch()
    const open = vi.fn(() => Promise.resolve<Sent>({ status: 'ok' }))
    const opening = new Opening(Promise.resolve(), { open, close: () => Promise.resolve(), failed: () => {} })
    const fitted = whileClosed(keyboard, (size: Size_Deserialize) => opening.open(size, false))
    fitted({ cols: 40, rows: 50 })
    resize(FULL - 340)
    fitted({ cols: 40, rows: 31 })
    resize(FULL)
    fitted({ cols: 40, rows: 50 })
    await settled()
    expect(open.mock.calls).toEqual([[{ cols: 40, rows: 50 }, false]])
  })
})

describe('fitting the pane to the phone', () => {
  const SIZE = { cols: 40, rows: 50 }

  let changed = () => {}
  const page: Page = {
    visibilityState: 'visible',
    addEventListener: (_: string, listener: EventListenerOrEventListenerObject | null) => {
      changed = () => (typeof listener === 'function' ? listener(new Event('visibilitychange')) : undefined)
    },
    removeEventListener: () => {},
  }

  const turn = (state: DocumentVisibilityState) => {
    Object.assign(page, { visibilityState: state })
    changed()
  }

  const fitting = () => {
    const open = vi.fn(() => Promise.resolve<Sent>({ status: 'ok' }))
    const close = vi.fn(() => Promise.resolve())
    const opening = new Opening(Promise.resolve(), { open, close, failed: () => {} })
    return { open, close, opening, fit: new Fit() }
  }

  it('shows a toggle at the end of the bar, on and named for what it does', () => {
    expect(body).toMatch(
      /<div class="end svelte-[\w-]+">(?:<!--[^>]*-->| )*<button class="fit svelte-[\w-]+" type="button" aria-label="Fit to this screen" aria-pressed="true"><svg/,
    )
    expect(source).toContain(
      '<button class="fit" type="button" aria-label="Fit to this screen" aria-pressed={fit.on} onclick={() => fit.toggle()} > <Icon name="smartphone" />',
    )
    expect(source).toContain('.fit { display: inline-flex;')
    expect(source).toContain("width: 44px; height: 44px;")
  })

  it('hands a key pressed off any field to the typist, so a hardware keyboard types without a tap', () => {
    expect(source).toContain('const stray = (event: KeyboardEvent) => { if (!isField(event.target)) { typist?.take(event) } }')
    expect(source).toContain('<svelte:document onkeydown={stray} />')
  })

  it('offers no Full width in a narrow window', () => {
    expect(drawnAt(WIDE - 1)).not.toContain('aria-label="Full width"')
  })

  it('offers Full width before the fit switch in a wide window, off until pressed', () => {
    const shown = drawnAt(WIDE)
    expect(shown).toMatch(
      /<div class="end svelte-[\w-]+">(<!--[^>]*-->)*<button class="fit svelte-[\w-]+" type="button" aria-label="Full width" aria-pressed="false">[^]*?<line x1="21" y1="3" x2="14" y2="10"><\/line>[^]*?<\/button>(?:<!--[^>]*-->| )*<button class="fit svelte-[\w-]+" type="button" aria-label="Fit to this screen"/,
    )
    expect(source).toContain(
      '{#snippet right()} {#if layout.wide} <button class="fit" type="button" aria-label="Full width" aria-pressed={layout.full} onclick={() => layout.toggleFull()} > <Icon name="maximize-2" /> </button> {/if}',
    )
  })

  it('opens the pane fitted at once, never as it is first', async () => {
    const { open, opening, fit } = fitting()
    fit.ask(opening, SIZE)
    await settled()
    expect(open.mock.calls).toEqual([[SIZE, true]])
    expect(source).toContain('const fit = new Fit()')
  })

  it('opens the pane as it is once the toggle is pressed, and fitted again on the next press', async () => {
    const { open, opening, fit } = fitting()
    fit.ask(opening, SIZE)
    await settled()
    fit.toggle()
    fit.ask(opening, SIZE)
    await settled()
    fit.toggle()
    fit.ask(opening, SIZE)
    await settled()
    expect(open.mock.calls).toEqual([
      [SIZE, true],
      [SIZE, false],
      [SIZE, true],
    ])
  })

  it('opens a new screen fitted even when the last one was turned off', async () => {
    fitting().fit.toggle()
    const { open, opening, fit } = fitting()
    fit.ask(opening, SIZE)
    await settled()
    expect(open.mock.calls).toEqual([[SIZE, true]])
  })

  it('turns the toggle off when the machine takes the tab back', () => {
    const { fit } = fitting()
    fit.unfitted()
    expect(fit.on).toBe(false)
    expect(source).toContain('shown.apply(event.payload) if (event.payload.unfitted) { fit.unfitted() }')
  })

  it('lets the tab go while the app is in the background, opening nothing, and claims it again on its return', async () => {
    const { open, close, opening, fit } = fitting()
    fit.watch(page)
    fit.ask(opening, SIZE)
    await settled()
    turn('hidden')
    fit.ask(opening, SIZE)
    await settled()
    expect([open.mock.calls, close.mock.calls.length]).toEqual([[[SIZE, true]], 1])
    turn('visible')
    fit.ask(opening, SIZE)
    await settled()
    expect(open.mock.calls).toEqual([
      [SIZE, true],
      [SIZE, true],
    ])
    expect(source).toContain('const unwatchPage = fit.watch(document)')
    expect(source).toContain('unwatch() unwatchPage()')
  })
})

describe('sending from the terminal screen', () => {
  const OK: Sent = { status: 'ok' }

  const sends = (answer: () => Promise<Sent> = () => Promise.resolve(OK)) => ({
    input: vi.fn(answer),
    scroll: vi.fn(answer),
    failed: vi.fn(),
  })

  const showing = (shown: Partial<PaneState>) => ({ current: { ...empty, ...shown } })

  it('sends what is typed to the pane the screen shows', () => {
    const calls = sends()
    new Sending(showing({ pane: 30 }), calls).input([{ text: 'ls' }])
    expect(calls.input.mock.calls).toEqual([[30, [{ text: 'ls' }]]])
  })

  it('sends a swipe through the history to the pane the screen shows', () => {
    const calls = sends()
    new Sending(showing({ pane: 30 }), calls).scroll(-3)
    expect(calls.scroll.mock.calls).toEqual([[30, -3]])
  })

  it('follows the pane the screen shows as it changes', () => {
    const calls = sends()
    const shown = showing({ pane: 30 })
    const sending = new Sending(shown, calls)
    shown.current = { ...shown.current, pane: 31 }
    sending.input([{ text: 'a' }])
    expect(calls.input.mock.calls).toEqual([[31, [{ text: 'a' }]]])
  })

  it.each([
    ['a closed tab', { pane: 30, closed: true }],
    ['a pane not shown yet', { pane: null }],
  ])('sends nothing to %s', (_, shown) => {
    const calls = sends()
    const sending = new Sending(showing(shown), calls)
    sending.input([{ text: 'ls' }])
    sending.scroll(2)
    expect([calls.input, calls.scroll].map((call) => call.mock.calls.length)).toEqual([0, 0])
  })

  it('sends nothing when there is nothing to send', () => {
    const calls = sends()
    const sending = new Sending(showing({ pane: 30 }), calls)
    sending.input([])
    sending.scroll(0)
    expect([calls.input, calls.scroll].map((call) => call.mock.calls.length)).toEqual([0, 0])
  })

  it.each([
    ['a refused input', (sending: Sending) => sending.input([{ text: 'ls' }])],
    ['a refused scroll', (sending: Sending) => sending.scroll(1)],
  ])('turns %s into a toast', async (_, send) => {
    const error = { code: 'conflict', message: 'the tab is gone' }
    const calls = sends(() => Promise.resolve({ status: 'error', error }))
    send(new Sending(showing({ pane: 30 }), calls))
    await settled()
    expect(calls.failed.mock.calls).toEqual([[error]])
  })

  it('turns a call that fails into a toast', async () => {
    const error = new Error('the app is gone')
    const calls = sends(() => Promise.reject(error))
    new Sending(showing({ pane: 30 }), calls).input([{ text: 'ls' }])
    await settled()
    expect(calls.failed.mock.calls).toEqual([[error]])
  })

  it('says nothing when the pane takes it', async () => {
    const calls = sends()
    new Sending(showing({ pane: 30 }), calls).input([{ text: 'ls' }])
    await settled()
    expect(calls.failed).not.toHaveBeenCalled()
  })
})
