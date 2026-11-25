import { render } from 'svelte/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentClosing_Serialize as AgentClosing,
  AgentRow_Serialize as Agent,
  ConnectionView_Serialize,
} from '../../lib/bindings'
import { boardSearch } from '../../lib/boardSearch.svelte'
import type { Asker, CloseAgent, Closing } from '../../lib/closeAgent.svelte'
import { closerAt as closingAt } from '../../lib/closeFakes'
import { folds } from '../../lib/folds.svelte'
import hiddenSource from '../../lib/ui/Hidden.svelte?raw'
import Board from './Board.svelte'
import boardSource from './Board.svelte?raw'
import rowSource from './AgentRow.svelte?raw'
import searchSource from '../../lib/ui/SearchField.svelte?raw'

const NOW = Date.parse('2026-11-09T12:00:00.000Z')

const CONNECTED: ConnectionView_Serialize = { state: 'connected', route: 'ws://mac:7000' }

const BASE: Agent = {
  boot: 'b1',
  pane: 0,
  project: 1,
  workspace: 2,
  tab: 3,
  tab_name: 'tab',
  agent: 'codex',
  title: null,
  status: null,
  since: null,
  parent: null,
  depth: 0,
  role: null,
  rank_status: null,
  project_name: 'shop',
  workspace_name: 'main',
  workspace_count: 1,
}

const at = (pane: number, status: string | null, more: Partial<Agent> = {}): Agent => ({
  ...BASE,
  pane,
  status,
  rank_status: status,
  ...more,
})

const draw = (
  agents: Agent[] | null,
  connection: ConnectionView_Serialize = CONNECTED,
  below = 0,
  machine: number | null = 1,
  closer: CloseAgent | null = null,
  selected: number | null = null,
) => render(Board, { props: { machine, agents, connection, closer, selected, below, onopen: () => {}, onstart: () => {} } }).body

const BRANCH = [
  at(1, 'working', { title: 'Lead', rank_status: 'waiting' }),
  at(2, 'waiting', { title: 'Ask', parent: 1, depth: 1 }),
  at(3, 'working', { title: 'Dig', parent: 2, depth: 2 }),
]

const titles = (body: string) => [...body.matchAll(/<span class="title svelte-[\w-]+">([^<]+)<\/span>/g)].map((m) => m[1])

const unfolded = (machine: number, ...panes: number[]) => {
  panes.forEach((pane) => folds.toggle(machine, 'b1', pane))
  return machine
}

const START = /<button class="button primary svelte-[\w-]+ compact( resting)?" type="button"([^>]*)>(?:<!--[^>]*-->| )*Start</

const flat = (text: string) => text.replace(/\s+/g, ' ')

const FOLD = /<button class="fold svelte-[\w-]+" type="button" aria-label="([^"]+)" aria-expanded="(true|false)"><span class="face svelte-[\w-]+" aria-hidden="true">(?:<!--[^>]*-->)*<svg class="dot svelte-[\w-]+" role="img" aria-label="(\w+)"[^]*?<\/svg>(?:<!--[^>]*-->)*<\/span> <svg class="turn svelte-[\w-]+( open)?" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="--turn: (\d+)ms;"><path d="([^"]+)"/g

const disclosures = (body: string) => [...body.matchAll(FOLD)].map((m) => m.slice(1))

const CHEVRON = 'm9 18 6-6-6-6'

const sections = (body: string) => [...body.matchAll(/<h2 class="section svelte-[\w-]+">(\w+)<\/h2>/g)].map((m) => m[1])

describe('Board', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says so when no agent runs', () => {
    expect(draw([])).toMatch(/<p class="empty svelte-[\w-]+">No agents running\.<\/p>/)
    expect(draw([])).not.toContain('<ul')
  })

  it('pulses the mark while it connects, before the first list', () => {
    const body = draw(null, { state: 'connecting' })
    expect(body).toMatch(/<span class="cell cursor svelte-[\w-]+ pulsing"><\/span>/)
    expect(body).not.toContain('No agents running.')
  })

  it('keeps the mark still without a list once it stops connecting', () => {
    expect(draw(null, { state: 'not_paired' })).not.toContain('pulsing')
  })

  it('heads the sections in their order and leaves the empty ones out', () => {
    expect(sections(draw([at(1, 'working'), at(2, null), at(3, 'failed')]))).toEqual(['Waiting', 'Working', 'Idle'])
    expect(sections(draw([at(1, 'pending'), at(2, 'shell'), at(3, 'waiting'), at(4, 'idle')]))).toEqual([
      'Waiting',
      'Done',
      'Working',
      'Idle',
    ])
  })

  it('puts each row under its section', () => {
    const body = draw([at(1, 'working', { title: 'Build' }), at(2, 'waiting', { title: 'Ask' })])
    expect(body.indexOf('>Waiting<')).toBeLessThan(body.indexOf('>Ask<'))
    expect(body.indexOf('>Ask<')).toBeLessThan(body.indexOf('>Working<'))
    expect(body.indexOf('>Working<')).toBeLessThan(body.indexOf('>Build<'))
  })

  it('draws a row with its status, title, place and time in the state', () => {
    const since = new Date(NOW - 5 * 60_000).toISOString()
    const body = draw([at(7, 'waiting', { title: 'Fix login', workspace_count: 3, workspace_name: 'login', since })])
    expect(body).toContain('aria-label="Waiting"')
    expect(body).toMatch(/<span class="title svelte-[\w-]+">Fix login<\/span>/)
    expect(body).toMatch(/<span class="place svelte-[\w-]+">shop › login<\/span>/)
    expect(body).toMatch(/<span class="time svelte-[\w-]+">5 min<\/span>/)
  })

  it('names the agent and only the project when the row has no title and one workspace', () => {
    const body = draw([at(1, 'done')])
    expect(body).toMatch(/<span class="title svelte-[\w-]+">codex<\/span>/)
    expect(body).toMatch(/<span class="place svelte-[\w-]+">shop<\/span>/)
  })

  it('shows no time when it does not know since when', () => {
    expect(draw([at(1, 'working')])).not.toContain('class="time')
  })

  it('marks the row of the agent shown beside the board, and only it', () => {
    const body = draw([at(1, 'idle', { title: 'first' }), at(2, 'idle', { title: 'second' })], CONNECTED, 0, 1, null, 2)
    expect(body.match(/aria-current="true"/g)).toHaveLength(1)
    expect(body).toMatch(/<button class="row svelte-[\w-]+" type="button" aria-current="true">(?:(?!<\/button>)[^])*second/)
    expect(flat(rowSource)).toContain(".row[aria-current='true'] { background: var(--selected); }")
  })

  it('marks no row with nothing shown beside the board', () => {
    expect(draw([at(1, 'idle')])).not.toContain('aria-current')
  })

  it('makes each row a button of at least 44 px that reacts to a touch', () => {
    expect(draw([at(1, 'idle')])).toMatch(/<button class="row svelte-[\w-]+" type="button">/)
    expect(flat(rowSource)).toContain('min-height: 44px;')
    expect(flat(rowSource)).toContain(
      '<button class="row" type="button" aria-current={current ? \'true\' : undefined} aria-busy={progress === null ? undefined : \'true\'} onclick={() => onopen(row.pane)} ontouchstart={() => {}} >',
    )
  })

  it('keys every item by its section or pane and moves them with flip, still with reduced motion', () => {
    const source = flat(boardSource)
    expect(source).toContain(
      '{#each shown as item (item.key)} <li class="item" animate:flip={moving}>',
    )
    expect(source).toContain('const shown = $derived(agents === null ? [] : items(agents, opened, query))')
    expect(source).toContain('const moving = { duration: prefersReducedMotion() ? 0 : ENTER_MS }')
  })

  it('refreshes the time with one timer at least once a minute, cleared when it unmounts', () => {
    const source = flat(boardSource)
    expect(source).toContain('const TICK_MS = 30_000')
    expect(source).toContain(
      '$effect(() => { const timer = setInterval(() => (now = Date.now()), TICK_MS) return () => clearInterval(timer) })',
    )
    expect(source.match(/setInterval/g)).toHaveLength(1)
    expect(rowSource).not.toMatch(/setInterval|setTimeout/)
  })

  it.each([null, [], [at(1, 'waiting')]])('heads the screen with a visible h1 beside Start, for %o', (agents) => {
    const body = draw(agents)
    expect(body).toMatch(/<div class="heading svelte-[\w-]+"><h1 class="title svelte-[\w-]+">Agents<\/h1>/)
    expect(body.indexOf('>Agents</h1>')).toBeLessThan(body.indexOf('>Start<'))
  })

  it.each([[], null, [at(1, 'working')]])('offers starting new work once connected, for %o', (agents) => {
    const button = draw(agents).match(START)
    expect(button?.[1]).toBeUndefined()
    expect(button?.[2]).not.toContain('disabled')
    expect(flat(boardSource)).toContain(
      "<Button compact resting={connection.state !== 'connected'} onclick={onstart}>Start</Button>",
    )
  })

  it.each<ConnectionView_Serialize>([
    { state: 'connecting' },
    { state: 'none' },
    { state: 'not_paired' },
  ])('holds Start while the connection is $state', (connection) => {
    const button = draw([], connection).match(START)
    expect(button?.[1]).toBe(' resting')
    expect(button?.[2]).toContain('disabled=""')
  })

  it('starts below the connection bar', () => {
    expect(draw([], CONNECTED, 44)).toMatch(/<section class="board svelte-[\w-]+" style="--below: 44px;">/)
    expect(flat(boardSource)).toContain('padding: calc(var(--below) + var(--inset)) var(--inset-wide) var(--inset-wide);')
  })

  it('lines the list up with Issues and Files', () => {
    const source = flat(boardSource)
    expect(source).toContain('.items { margin: 0 calc(-1 * var(--inset)); padding: 0;')
    expect(source).toContain('.section { margin: var(--inset) var(--inset) var(--gap);')
  })

  it('folds a branch by default, with the attention and count of what it hides', () => {
    const body = draw(BRANCH)
    expect(titles(body)).toEqual(['Lead'])
    expect(body).toMatch(/<span class="hidden svelte-[\w-]+">\+2<\/span>/)
    expect(body).toMatch(/role="img" aria-label="2 subagents hidden, at least one waiting"><span class="marks svelte-[\w-]+" aria-hidden="true">/)
    expect(body).toMatch(/aria-label="Waiting" width="10" height="10"/)
    expect(disclosures(body)).toEqual([['Show 2 subagents', 'false', 'Working', undefined, '180', CHEVRON]])
  })

  it('unfolds the branches the board keeps for its machine and boot', () => {
    const machine = unfolded(20, 1)
    expect(titles(draw(BRANCH, CONNECTED, 0, machine))).toEqual(['Lead', 'Ask'])
    expect(disclosures(draw(BRANCH, CONNECTED, 0, machine))).toEqual([
      ['Hide 2 subagents', 'true', 'Working', ' open', '180', CHEVRON],
      ['Show 1 subagent', 'false', 'Waiting', undefined, '180', CHEVRON],
    ])
    expect(titles(draw(BRANCH, CONNECTED, 0, unfolded(21, 1, 2)))).toEqual(['Lead', 'Ask', 'Dig'])
    expect(titles(draw(BRANCH, CONNECTED, 0, 22))).toEqual(['Lead'])
    expect(titles(draw(BRANCH.map((agent) => ({ ...agent, boot: 'b2' })), CONNECTED, 0, machine))).toEqual(['Lead'])
  })

  it('folds and unfolds from its own button, before the row and never inside it', () => {
    const body = draw(BRANCH)
    const fold = body.indexOf('<button class="fold')
    expect(body.indexOf('<div class="agent')).toBeLessThan(fold)
    expect(body.indexOf('</button>', fold)).toBeLessThan(body.indexOf('<button class="row'))
    expect(body).not.toContain('class="lead')
    expect(flat(rowSource)).toContain('onclick={() => onfold(row.pane)} ontouchstart={() => {}} >')
    expect(rowSource).not.toMatch(/\.lead|<Icon/)
    expect(flat(boardSource)).toContain('{onopen} onfold={fold}')
    expect(flat(boardSource)).toContain('if (machine !== null) { folds.toggle(machine, boot, pane) }')
  })

  it('never opens the agent from the disclosure', () => {
    const fold = flat(rowSource).match(/<button class="fold"[^]*?<\/button>/)?.[0]
    expect(fold).toContain('onclick={() => onfold(row.pane)}')
    expect(fold).not.toContain('onopen')
  })

  it("turns Lucide's chevron a quarter in the time of ENTER_MS", () => {
    const source = flat(rowSource)
    expect(source).not.toContain('<Icon')
    expect(source.match(/<path /g)).toHaveLength(1)
    expect(source).toContain("const [chevron] = icons['chevron-right']")
    expect(source).toContain('<path d={chevron.d} />')
    expect(source).toContain('.turn { position: relative; left: calc((7px + var(--inset-wide)) / 2); }')
    expect(source).toContain('const turn = prefersReducedMotion() ? 0 : ENTER_MS')
    expect(source).toContain('.turn path { transform-box: view-box; transform-origin: center; transition: transform var(--turn); }')
    expect(source).toContain('.turn.open path { transform: rotate(90deg); }')
    expect(source).toContain('display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; width: 44px; padding: 0; color: var(--soft); }')
  })

  it('moves the chevron halfway from the dot to the title with the tokens', () => {
    const rule = flat(rowSource).match(/\.turn \{[^}]*\}/)?.[0]
    expect(rule).toContain('position: relative; left: calc((7px + var(--inset-wide)) / 2);')
    expect(rule).not.toMatch(/11\.5|11px|12px/)
    expect(flat(rowSource).match(/\.turn[^{]*\{[^}]*\}/g)?.join(' ')).not.toMatch(/translate/)
  })

  it('turns the drawing inside the chevron and never its frame, which would reach the title', () => {
    const source = flat(rowSource)
    expect(source).not.toMatch(/\.turn(\.open)? \{[^}]*transform/)
    expect(source).toMatch(/\.turn\.open path \{ transform: rotate\(90deg\); \}/)
  })

  it('draws a chevron only on the rows with children', () => {
    const tree = [at(1, 'working', { title: 'Lead' }), at(2, 'idle', { title: 'Kid', parent: 1, depth: 1 }), at(4, 'idle', { title: 'Alone' })]
    const body = draw(tree, CONNECTED, 0, unfolded(27, 1))
    expect(titles(body)).toEqual(['Lead', 'Kid', 'Alone'])
    expect(body.match(/<svg class="turn/g)).toHaveLength(1)
    expect(disclosures(body).map(([label]) => label)).toEqual(['Hide 1 subagent'])
  })

  it('moves the dot of a row with children into its fold, hidden from VoiceOver, and says its status in the row', () => {
    const body = draw(BRANCH)
    const fold = body.indexOf('<button class="fold')
    const row = body.indexOf('<button class="row')
    expect(body.slice(fold, row)).toMatch(/<span class="face svelte-[\w-]+" aria-hidden="true">(?:<!--[^>]*-->)*<svg class="dot/)
    expect(flat(rowSource)).toContain('.face { display: flex; }')
    expect(body.slice(row)).toMatch(/^<button class="row svelte-[\w-]+" type="button"><span class="mark svelte-[\w-]+"><!--\[0--><span class="spoken">Working<\/span>/)
    expect(body.indexOf('<svg class="dot', row)).toBeGreaterThan(body.indexOf('<span class="folded', row))
    expect(flat(rowSource)).toContain('<span class="spoken">{statusName(row.status)}</span>')
  })

  it('keeps the dot of a row without children inside the row, where a touch opens the agent', () => {
    const body = draw([at(4, 'done', { title: 'Alone' })])
    const row = body.indexOf('<button class="row')
    expect(body).not.toContain('class="fold')
    expect(body).not.toContain('<span class="spoken')
    expect(body.indexOf('<svg class="dot', row)).toBeGreaterThan(body.indexOf('<span class="mark', row))
    expect(body.indexOf('<svg class="dot', row)).toBeLessThan(body.indexOf('<span class="lines', row))
    expect(body).toMatch(/<span class="mark svelte-[\w-]+"><!--\[-1-->(?:<!--[^>]*-->)*<svg class="dot svelte-[\w-]+" role="img" aria-label="Done"/)
  })

  it('turns the chevron at once with reduced motion', () => {
    vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: query.includes('reduce') }) })
    try {
      expect(disclosures(draw(BRANCH)).map((m) => m[4])).toEqual(['0'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('opens each shown row, a child too, with its own pane', () => {
    const body = draw(BRANCH, CONNECTED, 0, unfolded(23, 1, 2))
    expect(body.match(/<button class="row svelte-[\w-]+"/g)).toHaveLength(3)
    expect(flat(rowSource)).toContain('const row = $derived(item.row)')
    expect(flat(rowSource)).toContain('onclick={() => onopen(row.pane)}')
  })

  it('indents a row by its depth, up to three levels', () => {
    const deep = [at(1, 'working'), at(2, 'working', { parent: 1, depth: 1 }), at(3, 'idle', { parent: 2, depth: 5 })]
    const body = draw(deep, CONNECTED, 0, unfolded(24, 1, 2))
    expect([...body.matchAll(/style="--depth: (\d);"/g)].map((m) => m[1])).toEqual(['0', '1', '3'])
    expect(flat(rowSource)).toContain('padding-left: calc(var(--depth) * var(--inset-wide));')
  })

  it('keeps the dots of siblings in a column, each in a mark that starts its row', () => {
    const tree = [at(1, 'working', { title: 'Lead' }), at(2, 'idle', { title: 'Kid', parent: 1, depth: 1 }), at(4, 'idle', { title: 'Alone' })]
    const body = draw(tree, CONNECTED, 0, unfolded(26, 1))
    expect(body.match(/<button class="fold svelte-[\w-]+"/g)).toHaveLength(1)
    expect(body.match(/<button class="row svelte-[\w-]+" type="button"><span class="mark svelte-[\w-]+">/g)).toHaveLength(3)
    expect(body).not.toContain('slot')
    expect(rowSource).not.toMatch(/slot|\.lead|60px/)
    expect(flat(rowSource)).toContain('.mark { display: flex; flex: none; justify-content: center; width: 14px;')
  })

  it('gives the fold a 44 pt target centred on the dot, clear of the title', () => {
    const source = flat(rowSource)
    expect(source).toContain('.agent { position: relative;')
    expect(source).toContain(
      '.fold { position: absolute; top: 0; bottom: 0; left: calc(var(--depth) * var(--inset-wide) + var(--inset) - 15px); z-index: 1;',
    )
    expect(source).toContain('width: 44px;')
    expect(source).toContain('.row, .fold { box-sizing: border-box; min-height: 44px;')
    expect(source).toContain('padding: var(--gap) var(--inset);')
    expect(source).toContain('width: 14px; margin-right: calc(var(--inset-wide) - var(--inset)); }')
    expect(source).toContain('.row { display: flex; flex: 1; align-items: center; gap: var(--inset);')
  })

  it('says what a folded row hides inside it, before the time', () => {
    const since = new Date(NOW - 5 * 60_000).toISOString()
    const body = draw(BRANCH.map((agent) => ({ ...agent, since })))
    const row = body.indexOf('<button class="row')
    const folded = body.indexOf('<span class="folded', row)
    expect(body.indexOf('<span class="lines', row)).toBeLessThan(folded)
    expect(folded).toBeLessThan(body.indexOf('<span class="time', row))
    expect(body.indexOf('<span class="time', row)).toBeLessThan(body.indexOf('</button>', row))
    expect(flat(rowSource)).toContain('<Hidden hidden={item.hidden} attention={item.attention} />')
    expect(flat(rowSource)).not.toContain('class="count"')
    expect(flat(hiddenSource)).toContain('.folded, .marks { display: flex; flex: none; align-items: center; }')
    expect(hiddenSource).not.toMatch(/gap\?:|style:gap/)
  })

  it('ends the row with the time, the only part that shrinks when the row runs out of room', () => {
    const row = flat(rowSource).match(/<button class="row"[^]*?<\/button>/)?.[0]
    expect(row).not.toMatch(/Icon|fold/)
    expect(row).toMatch(/<span class="time">\{time\}<\/span> \{\/if\} <\/button>$/)
    expect(flat(rowSource)).toContain('.time { flex: 0 1 auto; min-width: 0; overflow: hidden;')
    expect(flat(rowSource).match(/flex: 0 1 auto/g)).toHaveLength(1)
  })

  it('names the members of a flow by their role under its orchestrator', () => {
    const flow = [
      at(1, 'working', { title: 'Ship login', role: 'orchestrator' }),
      at(2, 'working', { title: 'Write the form', role: 'coder', parent: 1, depth: 1 }),
    ]
    const body = draw(flow, CONNECTED, 0, unfolded(25, 1))
    expect(titles(body)).toEqual(['Ship login', 'coder'])
    expect(body).toMatch(/<span class="place svelte-[\w-]+">shop · orchestrator<\/span>/)
    expect(body).toMatch(/<span class="place svelte-[\w-]+">Write the form<\/span>/)
  })

  it('keeps every branch folded without a machine', () => {
    expect(titles(draw(BRANCH, CONNECTED, 0, null))).toEqual(['Lead'])
  })
})

describe('Board search', () => {
  const searching = (machine: number, query: string) => {
    boardSearch.write(machine, query)
    return machine
  }

  const field = (body: string) => body.match(/<input class="query svelte-[\w-]+" type="search"[^>]*>/)?.[0] ?? null

  const CANCEL = /<button class="cancel svelte-[\w-]+" type="button">Cancel<\/button>/

  afterEach(() => {
    boardSearch.write(0, '')
  })

  it('draws a search field named Search agents between Start and the list, with the attributes of the other fields', () => {
    const body = draw(BRANCH)
    expect(field(body)).toMatch(
      /^<input class="query svelte-[\w-]+" type="search" aria-label="Search agents" placeholder="Search agents" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" value=""\/>$/,
    )
    expect(body.indexOf('>Start<')).toBeLessThan(body.indexOf('type="search"'))
    expect(body.indexOf('type="search"')).toBeLessThan(body.indexOf('<ul'))
    expect(flat(boardSource)).toContain('.find { margin-bottom: var(--inset); }')
    expect(boardSource).not.toContain('sticky')
  })

  it.each<[string, Agent[] | null]>([
    ['no agent runs', []],
    ['the list has not come', null],
  ])('draws no search field while %s, and keeps the query', (_, agents) => {
    const machine = searching(40, 'dig')
    expect(field(draw(agents, CONNECTED, 0, machine))).toBeNull()
    expect(boardSearch.query(machine)).toBe('dig')
  })

  it('shows what matches with its parents, unfolded and without a disclosure, and leaves the folds alone', () => {
    const machine = searching(41, 'dig')
    const body = draw(BRANCH, CONNECTED, 0, machine)
    expect(titles(body)).toEqual(['Lead', 'Ask', 'Dig'])
    expect(disclosures(body)).toEqual([])
    expect(body).not.toContain('class="folded')
    expect(field(body)).toContain('value="dig"')
    expect(folds.expanded(machine, 'b1').size).toBe(0)
  })

  it('keeps every dot inside its row while searching, with no chevron and no spoken status', () => {
    const body = draw(BRANCH, CONNECTED, 0, searching(49, 'dig'))
    expect(titles(body)).toEqual(['Lead', 'Ask', 'Dig'])
    expect(body).not.toContain('<svg class="turn')
    expect(body).not.toContain('<span class="spoken')
    expect(body.match(/<span class="mark svelte-[\w-]+"><!--\[-1-->(?:<!--[^>]*-->)*<svg class="dot/g)).toHaveLength(3)
  })

  it('says so when nothing matches, and keeps the field to fix the query', () => {
    const body = draw(BRANCH, CONNECTED, 0, searching(42, 'zebra'))
    expect(body).toMatch(/<p class="empty svelte-[\w-]+">No agent matches the search<\/p>/)
    expect(body).not.toContain('<ul')
    expect(field(body)).toContain('value="zebra"')
  })

  it('offers Cancel beside a field with text, and not beside an empty one', () => {
    expect(draw(BRANCH, CONNECTED, 0, searching(43, 'ask'))).toMatch(CANCEL)
    expect(draw(BRANCH, CONNECTED, 0, searching(44, ''))).not.toContain('>Cancel<')
  })

  it('empties the query and leaves the field on Cancel, then shows the board folded as before', () => {
    const search = flat(searchSource)
    expect(search).toContain('const cancelling = $derived(oncancel !== undefined && (focused || value !== \'\'))')
    expect(search).toContain("const cancel = () => { value = '' field?.blur() oncancel?.() }")
    expect(search).toContain('onmousedown={(event) => event.preventDefault()} onclick={cancel}')
    expect(search).toContain('onfocus={() => (focused = true)} onblur={() => (focused = false)}')
    expect(flat(boardSource)).toContain("oncancel={() => search('')}")
    const machine = unfolded(45, 2)
    searching(machine, 'dig')
    searching(machine, '')
    const body = draw(BRANCH, CONNECTED, 0, machine)
    expect(titles(body)).toEqual(['Lead'])
    expect(disclosures(body).map(([label]) => label)).toEqual(['Show 2 subagents'])
    expect(folds.expanded(machine, 'b1')).toEqual(new Set([2]))
  })

  it('leaves the field on Enter and keeps the query', () => {
    expect(flat(searchSource)).toContain(
      "const submit = (event: KeyboardEvent) => { if (oncancel !== undefined && event.key === 'Enter') { field?.blur() } }",
    )
    expect(flat(searchSource)).toContain('onkeydown={submit}')
  })

  it('writes each input as the query of its machine', () => {
    expect(flat(boardSource)).toContain('oninput={(event) => search(event.currentTarget.value)}')
    expect(flat(boardSource)).toContain(
      'const search = (text: string) => { if (machine !== null) { boardSearch.write(machine, text) } }',
    )
  })

  it('keeps the query when the board comes back on the same machine, and starts empty on another', () => {
    const machine = searching(46, 'ask')
    expect(titles(draw(BRANCH, CONNECTED, 0, machine))).toEqual(['Lead', 'Ask'])
    expect(titles(draw(BRANCH, CONNECTED, 0, machine))).toEqual(['Lead', 'Ask'])
    const other = draw(BRANCH, CONNECTED, 0, 47)
    expect(titles(other)).toEqual(['Lead'])
    expect(field(other)).toContain('value=""')
  })

  it('searches nothing without a machine', () => {
    searching(48, 'dig')
    expect(titles(draw(BRANCH, CONNECTED, 0, null))).toEqual(['Lead'])
  })
})

describe('Closing an agent from the board', () => {
  const ref = (pane: number) => ({ agent: 'codex', pane, project: 1, tab: 3, workspace: 2 })

  const PLAN: AgentClosing = {
    pane: 1,
    agent: 'codex',
    project: 1,
    workspace: 2,
    tabs: [3],
    stops: [ref(1), ref(2), ref(3)],
    keeps: [],
    run: null,
    closed: false,
    warning: null,
  }

  const closerAt = (kind: Closing['kind'] | 'idle', rows: Agent[] = BRANCH, by: Asker = 'board') =>
    closingAt(kind, rows, PLAN, by)

  const CLOSE = /<button class="close svelte-[\w-]+ eased" type="button" tabindex="-1" aria-hidden="true" style="width: 88px; --reveal: 0px;">\s*Close\s*<\/button>/g

  const ending = (body: string) =>
    [...body.matchAll(/<span class="title svelte-[\w-]+">(\w+)<\/span>[^]*?(Closing…|class="spinner|<\/button>)/g)].map(
      (m) => [m[1], m[2]],
    )

  const dialog = (body: string) => body.match(/<div class="sheet svelte-[\w-]+" role="dialog" aria-modal="true" aria-label="([^"]+)"/)?.[1]

  it('hides a red Close behind each closable row on iOS, out of reach until the row opens', async () => {
    const body = draw(BRANCH, CONNECTED, 0, unfolded(60, 1, 2), await closerAt('idle'))
    expect(body.match(CLOSE)).toHaveLength(3)
    const source = flat(rowSource)
    expect(source).toContain("{#if gesture === 'swipe' && closable}")
    expect(source).toContain("tabindex={open ? undefined : -1} aria-hidden={open ? undefined : 'true'} onclick={() => onclose(row, root)}")
    expect(source).toContain('background: var(--failed); color: var(--glass);')
    expect(source).toContain('clip-path: inset(0 0 0 calc(100% - var(--reveal)));')
  })

  it.each<[string, Agent[], boolean, ConnectionView_Serialize]>([
    ['a row without a boot', BRANCH.map((agent) => ({ ...agent, boot: '' })), true, CONNECTED],
    ['a board without a closer', BRANCH, false, CONNECTED],
    ['a board that is not connected', BRANCH, true, { state: 'offline' }],
  ])('offers no Close on %s', async (_, rows, closing, connection) => {
    const closer = closing ? await closerAt('idle', rows) : null
    expect(draw(rows, connection, 0, unfolded(61, 1, 2), closer)).not.toContain('class="close')
    const board = flat(boardSource)
    expect(board).toContain(
      "const closes = (row: Agent) => closer !== null && row.boot !== '' && connection.state === 'connected'",
    )
    expect(board).toContain('const gestureOf = (row: Agent) => (closes(row) ? gesture : null)')
    expect(board).toContain('if (closer === null || !closes(row) || !closer.offered(row)) { return }')
  })

  it('says Closing… on the closed row and on the rows of what it stops, in place of their time', async () => {
    const since = new Date(Date.now() - 5 * 60_000).toISOString()
    const rows = [...BRANCH.map((agent) => ({ ...agent, since })), at(4, 'waiting', { title: 'Other', since })]
    const body = draw(rows, CONNECTED, 0, unfolded(62, 1, 2), await closerAt('closing', rows))
    expect(ending(body)).toEqual([
      ['Lead', 'Closing…'],
      ['Ask', 'Closing…'],
      ['Dig', 'Closing…'],
      ['Other', '</button>'],
    ])
    expect(body.match(/<span class="time svelte-[\w-]+">5 min<\/span>/g)).toHaveLength(1)
    expect(body.match(/aria-busy="true"/g)).toHaveLength(3)
    expect(body.match(CLOSE)).toHaveLength(1)
    expect(body.indexOf('class="close')).toBeGreaterThan(body.indexOf('>Dig<'))
  })

  it('turns a spinner on the row while cornercase checks what closing it stops', async () => {
    const body = draw(BRANCH, CONNECTED, 0, unfolded(63, 1, 2), await closerAt('checking'))
    expect(ending(body)).toEqual([
      ['Lead', 'class="spinner'],
      ['Ask', '</button>'],
      ['Dig', '</button>'],
    ])
    expect(dialog(body)).toBeUndefined()
  })

  it.each([
    ['confirming', ' type="button">'],
    ['rechecking', ' type="button" disabled="" aria-busy="true">'],
  ] as const)('asks before closing while %s, naming the row as the board does', async (kind, button) => {
    const body = draw(BRANCH, CONNECTED, 0, 64, await closerAt(kind))
    expect(dialog(body)).toBe('Close Lead?')
    expect(body).toContain('Also stops 2 subagents')
    expect(body).toMatch(new RegExp(`<button class="button danger svelte-[\\w-]+( busy)?"${button}`))
    expect(flat(boardSource)).toContain(
      "<CloseConfirm plan={asking.state.plan} label={label(asking.row, agents ?? [])} rechecking={asking.state.kind === 'rechecking'} {anchor} oncancel={() => closer?.cancel(pane)} onconfirm={() => void closer?.confirm(pane)} />",
    )
  })

  it("shows no confirmation the agent's screen asked for, which that screen shows beside it in two panes", async () => {
    const body = draw(BRANCH, CONNECTED, 0, 64, await closerAt('confirming', BRANCH, 'agent'))
    expect(dialog(body)).toBeUndefined()
  })

  it('never slides the section headers or the search field', async () => {
    const body = draw(BRANCH, CONNECTED, 0, unfolded(65, 1, 2), await closerAt('idle'))
    expect(body.match(/<div class="layer/g)).toHaveLength(3)
    expect(body.indexOf('<div class="layer')).toBeGreaterThan(body.indexOf('<h2 class="section'))
    expect(flat(boardSource)).not.toMatch(/<h2 class="section"[^>]*@attach|<div class="find"[^>]*@attach/)
    expect(flat(rowSource)).toContain('<div class="layer" class:eased={dragged === null} style:transform={offset < 0 ? `translateX(${offset}px)` : undefined} {@attach touches} >')
  })

  it('slides the fold with the row, its offset measured inside the sliding layer', () => {
    const source = flat(rowSource)
    expect(source.indexOf('<div class="layer"')).toBeLessThan(source.indexOf('<button class="fold"'))
    expect(source).toContain('.agent { position: relative; overflow: clip; }')
    expect(source).toContain('.layer { position: relative; display: flex; align-items: center; padding-left: calc(var(--depth) * var(--inset-wide)); }')
  })

  it('opens the row at the width of Close and settles it eased, at once with reduced motion', () => {
    const source = flat(rowSource)
    expect(source).toContain('const offset = $derived(dragged ?? (open ? -OPEN_WIDTH : 0))')
    expect(source).toContain('.layer.eased { transition: transform var(--leave) ease-out; }')
    expect(source).toContain('.close.eased { transition: clip-path var(--leave) ease-out; }')
    expect(source).toContain('@media (prefers-reduced-motion: reduce) { .layer.eased, .close.eased { transition: none; } }')
  })

  it('swipes on iOS and holds on Android, with a light tap when the hold fires', () => {
    const source = flat(rowSource)
    expect(source).toContain("if (gesture === 'swipe') { return watchRowSwipe(node, {")
    expect(source).toContain("if (gesture === 'hold') { return watchLongPress(node, () => onclose(row, root)) }")
    expect(source).toContain('ondrag: (next) => (dragged = closable ? next : null), onsettle: (next) => onswipe(row.pane, closable && next),')
    const board = flat(boardSource)
    expect(board).toContain('const gesture = rowGesture(platform)')
    expect(board).toContain("if (gesture === 'hold') { void tap(haptics) } shut() anchor = from void closer.ask(row, 'board')")
    expect(board).toContain('const ask = (row: Agent, from: HTMLElement | null) => {')
  })

  it('keeps one row open at most, shut by a touch elsewhere, a scroll, a list that moves it or a lost connection', () => {
    const board = flat(boardSource)
    expect(board).toContain('let swiped = $state<{ pane: number; at: number } | null>(null)')
    expect(board).toContain('swiped = open ? { pane, at: placeOf(pane) } : null')
    expect(board).toContain(
      "const placeOf = (pane: number) => shown.findIndex((item) => item.kind === 'row' && item.row.pane === pane)",
    )
    expect(board).toContain('if (swiped !== null && placeOf(swiped.pane) !== swiped.at) { shut() }')
    expect(board).toContain(
      "['touchstart', outside, { capture: true, passive: true }], ['scroll', shut, { capture: true, passive: true }],",
    )
    expect(board).toContain("event.target.closest('[data-open]') !== null")
    expect(board).toContain(
      'const opens = (row: Agent) => swiped?.pane === row.pane && closes(row) && closer?.offered(row) === true',
    )
    expect(board).toContain("if (swiped !== null && connection.state !== 'connected') { shut() }")
    expect(flat(rowSource)).toContain("<div class=\"agent\" style:--depth={item.depth} data-open={open ? '' : undefined} bind:this={root}>")
  })
})
