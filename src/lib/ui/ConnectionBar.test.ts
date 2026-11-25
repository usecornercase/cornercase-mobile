import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { ConnectionView_Serialize } from '../bindings'
import type { Tone } from '../connection'
import clockSource from '../retryClock.svelte.ts?raw'
import ConnectionBar from './ConnectionBar.svelte'
import barSource from './ConnectionBar.svelte?raw'
import tagSource from './DemoTag.svelte?raw'
import dotSource from './ToneDot.svelte?raw'

const RETRYING: ConnectionView_Serialize = {
  state: 'retrying',
  in_ms: 2000,
  error: { code: 'timeout', message: 'timed out' },
}
const MISSING: ConnectionView_Serialize = {
  state: 'missing',
  missing: [{ name: 'watch', kind: 'stream', reason: null, since: null }],
}

const bar = (connection: ConnectionView_Serialize) =>
  render(ConnectionBar, { props: { connection, machineName: 'MacBook', demo: false, onmachines: () => {}, onleave: () => {} } })
    .body

const demoBar = (connection: ConnectionView_Serialize) =>
  render(ConnectionBar, { props: { connection, machineName: 'Demo machine', demo: true, onmachines: () => {}, onleave: () => {} } })
    .body

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('ConnectionBar', () => {
  it.each<[string, ConnectionView_Serialize, string, Tone]>([
    ['connecting', { state: 'connecting' }, 'Connecting…', 'working'],
    ['connected', { state: 'connected', route: 'ws://192.168.1.20:7000/' }, 'MacBook · via 192.168.1.20:7000', 'done'],
    ['retrying', RETRYING, 'Retrying in 2 s', 'failed'],
    ['missing', MISSING, 'Update cornercase on the machine', 'failed'],
    ['not_paired', { state: 'not_paired' }, 'This machine no longer recognizes this phone', 'failed'],
  ])('shows %s with its text and the dot in its tone', (_, connection, text, tone) => {
    const body = bar(connection)
    expect(body).toMatch(new RegExp(`<span class="dot ${tone} svelte-[\\w-]+( pulsing)?"></span>`))
    expect(body.match(/<span class="line text svelte-[\w-]+"(?: aria-hidden="true")?>([^<]*)<\/span>/)?.[1]).toBe(text)
  })

  it('pulses the dot only while connecting', () => {
    expect(bar({ state: 'connecting' })).toMatch(/<span class="dot working svelte-[\w-]+ pulsing"><\/span>/)
    for (const connection of [RETRYING, MISSING, { state: 'connected', route: 'ws://h:1' } as const]) {
      expect(bar(connection)).not.toContain('pulsing')
    }
  })

  it('gives the reason of a retry its own line', () => {
    expect(bar(RETRYING)).toMatch(/<span class="line detail svelte-[\w-]+">timed out<\/span>/)
    expect(bar({ state: 'connecting' })).not.toContain('detail')
  })

  it('stays on top of what the phone keyboard leaves visible, as iOS lifts the page over it', () => {
    const source = flat(barSource)
    expect(source).toContain('const keyboard = new Keyboard(globalThis)')
    expect(source).toContain('$effect(() => keyboard.watch())')
    expect(source).toContain('<div class="connection" role="status" style:top={keyboard.covered ? `${keyboard.offset}px` : undefined}>')
    expect(bar({ state: 'connecting' })).not.toContain('style=')
  })

  it('announces itself as a status', () => {
    expect(bar({ state: 'connecting' })).toMatch(/^<!--\[--><div class="connection svelte-[\w-]+" role="status">/)
  })

  it('keeps the countdown out of what readers announce, which says only that it retries and why', () => {
    expect(bar(RETRYING)).toMatch(
      /<span class="line text svelte-[\w-]+" aria-hidden="true">Retrying in 2 s<\/span> <!--\[0--><span class="spoken">Retrying<\/span>/,
    )
    expect(bar(RETRYING)).toMatch(/<span class="line detail svelte-[\w-]+">timed out<\/span>/)
  })

  it.each<ConnectionView_Serialize>([{ state: 'connecting' }, MISSING, { state: 'not_paired' }])(
    'reads its text aloud as shown when $state',
    (connection) => {
      const body = bar(connection)
      expect(body).not.toMatch(/class="line text[^>]*aria-hidden|class="spoken/)
    },
  )

  it('counts down every second only while retrying, and stops when it leaves', () => {
    const clock = flat(clockSource)
    expect(clock).toContain('const TICK_MS = 1000')
    expect(clock).toContain(
      "$effect(() => { elapsed = 0 if (connection().state !== 'retrying') { return } const since = Date.now() const timer = setInterval(() => (elapsed = Date.now() - since), TICK_MS) return () => clearInterval(timer) })",
    )
    expect(flat(barSource)).toContain(
      'const clock = retryClock(() => connection) const shown = $derived(status(connection, machineName, clock.elapsed))',
    )
  })

  it('ends with a button to the machines, with the server icon and its name for readers', () => {
    expect(bar({ state: 'connecting' })).toMatch(
      /<button class="machines svelte-[\w-]+" type="button" aria-label="Machines"><svg[^>]*width="20"[^]*?<rect x="2" y="2" width="20" height="8" rx="2"><\/rect>[^]*?<\/svg><!----><\/button><\/div><\/div>/,
    )
    expect(flat(barSource)).toContain('onclick={onmachines}')
  })

  it('tells its height below the safe area, for the toasts', () => {
    expect(barSource).toContain('<div class="row" bind:clientHeight={height}>')
  })

  it.each([
    'position: fixed; top: 0; left: 0; right: 0;',
    'padding-top: env(safe-area-inset-top);',
    ':global(html.split) .connection { right: auto; box-sizing: border-box; width: var(--side); padding-left: env(safe-area-inset-left); }',
    'min-height: 44px;',
    'width: 44px; height: 44px;',
    'overflow: hidden; white-space: nowrap; text-overflow: ellipsis;',
  ])('holds %s', (text) => {
    expect(flat(barSource)).toContain(text)
  })

  it.each([
    'width: 8px; height: 8px; border-radius: 999px;',
    '.working { background: var(--working); }',
    '.done { background: var(--done); }',
    '.failed { background: var(--failed); }',
  ])('draws its dot with %s', (text) => {
    expect(flat(dotSource)).toContain(text)
  })

  describe('in the demo', () => {
    const DEMO_STATES: ConnectionView_Serialize[] = [{ state: 'connecting' }, { state: 'connected', route: '' }]

    it.each(DEMO_STATES)('tags itself Demo, in capitals, beside its dot when $state', (connection) => {
      expect(demoBar(connection)).toMatch(
        /<span class="dot \w+ svelte-[\w-]+( pulsing)?"><\/span><!----> <!--\[0?--><span class="tag svelte-[\w-]+">Demo<\/span>/,
      )
      expect(flat(tagSource)).toContain('text-transform: uppercase;')
    })

    it('shows the demo by its name alone, with no address, and never a lost network or a retry', () => {
      for (const connection of DEMO_STATES) {
        const body = demoBar(connection)
        expect(body).not.toMatch(/No network|Retrying|via |:\d+/)
      }
      expect(demoBar({ state: 'connected', route: '' })).toMatch(
        /<span class="line text svelte-[\w-]+">Demo machine<\/span>/,
      )
    })

    it('offers Leave demo before the machines, which asks to leave', () => {
      expect(demoBar({ state: 'connected', route: '' })).toMatch(
        /<button class="leave svelte-[\w-]+" type="button">Leave demo<\/button><!--\]--> <button class="machines/,
      )
      expect(flat(barSource)).toContain(
        '{#if demo} <button class="leave" type="button" onclick={onleave} ontouchstart={() => {}}>Leave demo</button> {/if}',
      )
    })

    it('neither tags nor offers leaving a machine that is not the demo', () => {
      const body = bar({ state: 'connected', route: 'ws://192.168.1.20:7000/' })
      expect(body).not.toContain('class="tag')
      expect(body).not.toContain('Leave demo')
    })

    it.each([
      '.leave { flex: none; min-height: 44px;',
      'color: var(--accent);',
      '.leave:active { background: var(--hover); }',
    ])('draws Leave demo with %s', (text) => {
      expect(flat(barSource)).toContain(text)
    })

    it.each([
      'border-radius: var(--radius-chip);',
      'background: var(--accent-soft); color: var(--accent);',
      'font-size: 11px; font-weight: 600;',
    ])('draws the tag with %s', (text) => {
      expect(flat(tagSource)).toContain(text)
    })
  })
})
