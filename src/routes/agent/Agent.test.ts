import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { AgentRow_Serialize as AgentRow, ConnectionView_Serialize } from '../../lib/bindings'
import { subagents } from '../../lib/board'
import type { Chat } from '../../lib/chat.svelte'
import type { Asker, CloseAgent, Closing } from '../../lib/closeAgent.svelte'
import { closerAt } from '../../lib/closeFakes'
import Agent from './Agent.svelte'
import agentSource from './Agent.svelte?raw'
import { CHIPS, ROW, SINCE, chatWith, clockAt, flat, lineChat } from './agentFakes'
import ChatHeader from './ChatHeader.svelte'
import chatHeaderSource from './ChatHeader.svelte?raw'
import toolButtonSource from '../../lib/ui/ToolButton.svelte?raw'
import Children from './Children.svelte'
import childrenSource from './Children.svelte?raw'
import KeyRow from './KeyRow.svelte'
import keyRowSource from './KeyRow.svelte?raw'
import subagentsSource from './Subagents.svelte?raw'
import threadSource from './Thread.svelte?raw'

const CONNECTED: ConnectionView_Serialize = { state: 'connected', route: 'ws://mac:7000' }

const tool = (name: string, path: string) =>
  new RegExp(`<button class="tool svelte-[\\w-]+" type="button" aria-label="${name}">(?:<!--[^>]*-->| )*<svg [^>]*>(?:(?!</svg>)[^])*?<path d="${path}"></path>`)

const BACK =
  /<button class="back svelte-[\w-]+" type="button" aria-label="Back to Agents">(?:<!--[^>]*-->| )*<svg [^>]*>(?:(?!<\/svg>)[^])*?<path d="m15 18-6-6 6-6"><\/path>/

const TERMINAL = tool('Terminal', 'm7 11 2-2-2-2')

const CHANGES = tool('Changes', 'M13 6h3a2 2 0 0 1 2 2v7')

const FILES = tool('Files', 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z')

const NEW_AGENT = /<button class="tool svelte-[\w-]+" type="button" aria-label="New agent"( disabled="")?>(?:<!--[^>]*-->| )*<svg [^>]*>(?:(?!<\/svg>)[^])*?<path d="M5 12h14"><\/path>/

const draw = (
  chat: Chat,
  below = 0,
  connection: ConnectionView_Serialize = CONNECTED,
  starting: string | null = null,
  agents: AgentRow[] | null = null,
  closer: CloseAgent | null = null,
  panes: { topmost?: boolean; rooted?: boolean } = {},
) =>
  render(Agent, {
    props: {
      ...panes,
      chat,
      agents,
      connection,
      closer,
      backTo: 'Agents',
      below,
      starting,
      onback: () => {},
      onopen: () => {},
      onfailed: () => {},
      ontoast: () => {},
      onterminal: () => {},
      onchanges: () => {},
      onfiles: () => {},
      onstart: () => {},
    },
  }).body

const STARTING = /<p class="starting svelte-[\w-]+"><span class="spinner[^]*?<\/span>(?:<!---->)?Starting claude…<\/p>/

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

describe('Agent, its header', () => {
  it('shows the dot, the status in words, the agent, its place and its tab', () => {
    const body = draw(chatWith(ROW))
    expect(body).toContain('aria-label="Waiting"')
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">Fix the login flow<\/h1>/)
    expect(body).toMatch(
      /<p class="place svelte-[\w-]+"><span class="status svelte-[\w-]+">Waiting<\/span> · web › login › agent<\/p>/,
    )
    expect(body).not.toContain('no longer running')
  })

  it('names the agent when it has no title, and only the project when it has one workspace', () => {
    const body = draw(chatWith({ ...ROW, title: null, status: 'done', workspace_count: 1, tab_name: 'review' }))
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">claude<\/h1>/)
    expect(body).toMatch(/<span class="status svelte-[\w-]+">Done<\/span> · web › review<\/p>/)
  })

  it('sits below the connection bar', () => {
    expect(draw(chatWith(ROW), 52)).toContain('style="--below: 52px;"')
  })

  it("names a flow's member by its role, as on the board, and keeps its place", () => {
    const coder = { ...ROW, parent: 11, depth: 1, role: 'coder', title: 'Write the form', status: 'working' }
    const team = [{ ...ROW, pane: 11, role: 'orchestrator' }, coder]
    const body = draw(chatWith(coder), 0, CONNECTED, null, team)
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">coder<\/h1>/)
    expect(body).toMatch(/<span class="called svelte-[\w-]+">coder<\/span>/)
    expect(body).toMatch(/<span class="status svelte-[\w-]+">Working<\/span> · web › login › agent<\/p>/)
    expect(draw(chatWith(coder))).toMatch(/<h1 class="title svelte-[\w-]+">Write the form<\/h1>/)
  })
})

const LEAD: AgentRow = { ...ROW, status: 'working', role: 'orchestrator', rank_status: 'waiting' }

const CODER: AgentRow = { ...ROW, pane: 13, parent: 12, depth: 1, role: 'coder', title: 'Write the form', status: 'working' }

const DIG: AgentRow = { ...ROW, pane: 14, parent: 13, depth: 2, role: null, title: 'Dig', status: 'waiting' }

const REVIEWER: AgentRow = { ...ROW, pane: 15, parent: 12, depth: 1, role: 'reviewer', title: 'Review', status: 'working' }

const TEAM = [LEAD, CODER, DIG, REVIEWER]

const COUNT = /<span class="count svelte-[\w-]+">([^<]*)<\/span>/

const unfolded = (agents: AgentRow[]) =>
  render(Children, { props: { children: subagents(agents, LEAD.pane)?.children ?? [], agents, onopen: () => {} } }).body

const CHEVRON_RIGHT = /<span class="arrow svelte-[\w-]+"><svg [^>]*width="18" height="18"[^]*?<path d="m9 18 6-6-6-6"><\/path>/

const names = (body: string) => [...body.matchAll(/<span class="name svelte-[\w-]+">([^<]*)<\/span>/g)].map(([, name]) => name)

describe('Agent, its subagents', () => {
  it('counts the subagents of every level on a folded line under the header', () => {
    const body = draw(chatWith(LEAD), 0, CONNECTED, null, TEAM)
    expect(body.match(COUNT)?.[1]).toBe('3 subagents · 1 waiting, 2 working')
    expect(body).toMatch(/<\/header>(?:<!--[^>]*-->|\s)*<div class="close[^]*?<\/div>(?:<!--[^>]*-->|\s)*<div class="subagents[^]*?<div class="thread/)
    expect(body).toContain('aria-expanded="false"')
    expect(body).toMatch(CHEVRON_RIGHT)
    expect(body).not.toContain('class="children')
  })

  it.each<[string, AgentRow[] | null]>([
    ['an agent without children', [LEAD, DIG]],
    ['no list of agents', null],
  ])('has no line for %s', (_, agents) => {
    const body = draw(chatWith(LEAD), 0, CONNECTED, null, agents)
    expect(body).toContain('</header>')
    expect(body).not.toContain('class="subagents')
  })

  it('unfolds into its direct children, named by their role, with the attention and count below each', () => {
    const body = unfolded(TEAM)
    expect(body).toMatch(/<ul class="children svelte-[\w-]+" aria-label="Subagents">/)
    expect(names(body)).toEqual(['coder', 'reviewer'])
    expect(body).toMatch(/<span class="where svelte-[\w-]+">Write the form<\/span>/)
    expect(body).toMatch(
      /role="img" aria-label="1 subagent hidden, waiting"><span class="marks svelte-[\w-]+" aria-hidden="true">[^]*?aria-label="Waiting" width="10"[^]*?<span class="hidden svelte-[\w-]+">\+1<\/span>/,
    )
    expect(body).not.toContain('>Dig<')
  })

  it("opens a child's chat from its row and folds the list from the line", () => {
    expect(flat(childrenSource)).toContain(
      '<button class="child" type="button" onclick={() => onopen(child.row.pane)} ontouchstart={() => {}}>',
    )
    expect(flat(childrenSource)).toContain('min-height: 44px;')
    expect(flat(subagentsSource)).toContain('let open = $state(false)')
    expect(flat(subagentsSource)).toContain('aria-expanded={open} onclick={() => (open = !open)}')
    expect(flat(subagentsSource)).toContain("<Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} />")
    expect(flat(subagentsSource)).toContain('{#if open} <Children children={summary.children} {agents} {onopen} /> {/if}')
    expect(flat(subagentsSource)).toContain('.arrow { display: flex; flex: none; align-items: center; justify-content: center; min-width: 44px;')
  })

  it('starts folded again for each agent opened, and opens its children like the board', () => {
    expect(flat(agentSource)).toContain('{#key row.pane} <Subagents {row} agents={agents ?? []} {onopen} /> {/key} <Thread {chat} {now} boxed={seen !== null} {drop} {bar} />')
  })

  it("hands the header's bar to the thread, to measure where a message starts", () => {
    expect(flat(agentSource)).toContain('let bar = $state<HTMLElement | null>(null)')
    expect(flat(chatHeaderSource)).toContain('bar = $bindable(null),')
  })

  it('follows the rows as they change', () => {
    const chat = chatWith(LEAD)
    const changed = [LEAD, CODER, { ...DIG, status: 'done' }]
    chat.see(1, changed)
    expect(draw(chat, 0, CONNECTED, null, changed).match(COUNT)?.[1]).toBe('2 subagents · 1 done, 1 working')
    expect(names(unfolded(changed))).toEqual(['coder'])
  })
})

const BAR = /<div class="bar ios svelte-[\w-]+ fixed column" style="--below: 0px;">(.*?)<\/div><!----> <header class="head svelte-[\w-]+">/

const SHORT = /<div class="short svelte-[\w-]+" aria-hidden="true">(.*?)<\/div>/

const bar = (row: AgentRow) => draw(chatWith(row)).match(BAR)?.[1] ?? ''

describe('Agent, in two panes', () => {
  it('shows no back button straight over the board, keeping the start of the bar', () => {
    const body = draw(chatWith(ROW), 0, CONNECTED, null, null, null, { topmost: true, rooted: true })
    expect(body).not.toMatch(BACK)
    expect(body).toMatch(/<div class="start svelte-[\w-]+">(<!--[^>]*-->)*<\/div>/)
  })

  it('reaches its bar over the safe area, with no connection bar above it', () => {
    const body = draw(chatWith(ROW), 0, CONNECTED, null, null, null, { topmost: true })
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column" style="--below: 0px;">/)
    expect(body).toMatch(/<section class="agent svelte-[\w-]+ topmost"/)
    expect(body).toMatch(BACK)
  })

  it('reaches over the safe area in every state of its bar', () => {
    const body = draw(chatWith(null), 0, CONNECTED, null, null, null, { topmost: true, rooted: true })
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column" style="--below: 0px;">/)
    expect(body).not.toMatch(/class="back /)
  })

  it('keeps the chat in a centred column, its bars and its composer across the pane', () => {
    expect(flat(agentSource)).toContain('padding: calc(var(--below) + var(--inset)) var(--gutter) var(--inset-wide);')
    expect(flat(agentSource).match(/measure="column"/g)).toHaveLength(2)
    expect(flat(chatHeaderSource)).toContain('measure="column"')
  })

  it('lines the bar up with the top of the pane, keyboard or not', () => {
    expect(flat(agentSource)).toContain(
      '.topmost { padding-top: var(--gap); } .keyboard.topmost { padding-top: calc(env(safe-area-inset-top) + var(--gap)); }',
    )
  })
})

describe('Agent, its sticky header', () => {
  it('keeps Back at the start of the bar and Terminal, Changes, Files and New agent at its end, with the large header after it to scroll away', () => {
    const shown = bar(ROW)
    const end = shown.slice(shown.indexOf('<div class="end'))
    expect(shown.slice(0, shown.indexOf('<div class="center'))).toMatch(BACK)
    expect(end).toMatch(TERMINAL)
    expect(end).toMatch(CHANGES)
    expect(end).toMatch(FILES)
    expect(end).toMatch(NEW_AGENT)
    expect(shown).not.toContain('<h1')
  })

  it('starts large at the top of the page, below the connection bar', () => {
    expect(draw(chatWith(ROW), 52)).toMatch(/<div class="bar ios svelte-[\w-]+ fixed column" style="--below: 52px;"><div class="start/)
  })

  it('carries a compact line between them, with the dot and the title, hidden from VoiceOver', () => {
    const short = bar(ROW).match(SHORT)?.[1] ?? ''
    expect(short).toContain('aria-label="Waiting"')
    expect(short).toMatch(/<span class="called svelte-[\w-]+">Fix the login flow<\/span>$/)
    const shown = bar(ROW)
    expect(shown.indexOf('class="short')).toBeGreaterThan(shown.indexOf('<div class="center'))
    expect(shown.indexOf('class="short')).toBeLessThan(shown.indexOf('<div class="end'))
  })

  it('names the agent in the compact line when it has no title', () => {
    const short = bar({ ...ROW, title: null, status: 'working' }).match(SHORT)?.[1] ?? ''
    expect(short).toMatch(/<span class="called svelte-[\w-]+">claude<\/span>$/)
  })

  it('turns compact past the large header, measured, following the page with a passive listener', () => {
    const source = flat(chatHeaderSource)
    expect(source).toContain('const compact = $derived(boxed || compactHeader(scrolled, tall))')
    expect(source).toContain('<NavBar bind:bar {backTo} {onback} {below} {topmost} {rooted} measure="column" edge={compact}> {#snippet center()} <div class="short" class:compact aria-hidden="true">')
    expect(source).toContain('<header class="head" class:spoken={boxed} bind:clientHeight={tall}>')
    expect(source).toContain("const seen = () => (scrolled = window.scrollY) seen() window.addEventListener('scroll', seen, { passive: true })")
    expect(source).toContain("return () => window.removeEventListener('scroll', seen)")
  })

  it('sticks under the connection bar in the shared bar, with its edge only while compact', () => {
    expect(bar(ROW)).not.toContain('edge')
    expect(flat(chatHeaderSource)).not.toContain('.bar {')
  })

  it('shows the compact line only while compact, as tall as its 44 px buttons', () => {
    const source = flat(chatHeaderSource)
    expect(source).toContain('min-width: 0; min-height: 44px; visibility: hidden; opacity: 0;')
    expect(source).toContain('.short.compact { max-width: 100%; visibility: visible; opacity: 1; transition-delay: 0s; }')
    expect(bar(ROW)).not.toMatch(/class="short[^"]* compact"/)
  })

  it('leaves the compact line the room its icon buttons of 44 by 44 px do not take, centred and cut at the end', () => {
    const source = flat(chatHeaderSource)
    expect(source.match(/<ToolButton label="[\w ]+" icon="[\w-]+"(?: disabled=\{!sendable\})? onclick=\{.*?\} \/>/g)).toHaveLength(4)
    expect(source).toContain('{#snippet right()} <ToolButton label="Terminal"')
    expect(flat(toolButtonSource)).toContain('.tool { display: flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px;')
    expect(source).toContain('.short { display: inline-flex; align-items: center; max-width: 0; overflow: hidden; vertical-align: middle;')
    expect(source.slice(source.indexOf('<NavBar'), source.indexOf('</NavBar>'))).not.toContain('<Button')
  })

  it('leaves the back button the whole room while the compact line is hidden, taking it back once faded out', () => {
    const source = flat(chatHeaderSource)
    expect(source).toContain('.short { display: inline-flex; align-items: center; max-width: 0;')
    expect(source).toContain('transition: opacity 150ms ease-out, visibility 150ms, max-width 0s 150ms; }')
  })

  it('changes without animation under Reduce Motion', () => {
    expect(flat(chatHeaderSource)).toContain('@media (prefers-reduced-motion: reduce) { .short { transition: none; } }')
  })
})

describe('Agent, its message', () => {
  it('draws the message as markdown, with the time it was written', () => {
    const chat = chatWith(ROW)
    chat.conversation = [
      { kind: 'agent', id: 0, text: 'Tests **pass**.', written: minutesAgo(5), turn_over: true, seen: 0 },
    ]
    const body = draw(chat)
    expect(body).toContain('<strong')
    expect(body).toContain('pass')
    expect(body).toMatch(/<p class="written svelte-[\w-]+">5 min<\/p>/)
  })

  it('leaves out the time when the message has none', () => {
    const chat = chatWith(ROW)
    chat.conversation = [{ kind: 'agent', id: 0, text: 'Ready.', written: null, turn_over: null, seen: 0 }]
    expect(draw(chat)).not.toContain('class="written')
  })

  it.each<[string, Chat['reading'], string]>([
    ['the reason it cannot be read', { kind: 'unreadable', reason: 'no message yet' }, 'no message yet'],
    ['that it is reading', { kind: 'loading' }, 'Reading its last message…'],
  ])('says %s in its place, muted', (_, reading, text) => {
    const chat = chatWith(ROW)
    chat.reading = reading
    const body = draw(chat)
    expect(body).toMatch(new RegExp(`<p class="reason svelte-[\\w-]+">${text}</p>`))
    expect(body).not.toContain('class="markdown')
  })

  it('mutes the reason', () => {
    expect(flat(threadSource)).toContain('.reason { margin: 0; color: var(--muted); }')
  })

  it('reads it again while the screen shows, and stops when it goes', () => {
    expect(flat(agentSource)).toContain(
      '$effect(() => { const followed = chat return untrack(() => whileShown(document, () => followed.follow())) })',
    )
  })
})

describe('Agent, its composer', () => {
  it('ends the chat with the composer of its agent, below the thread', () => {
    const body = draw(chatWith({ ...ROW, status: 'done' }, 'go on'))
    expect(body).toMatch(/<div class="composer svelte-[\w-]+" style="--below: 0px;">/)
    expect(body).toMatch(/<textarea class="area svelte-[\w-]+" rows="1" aria-label="Answer" placeholder="Answer claude"/)
    expect(body).toContain('go on</textarea>')
    expect(flat(agentSource)).toContain('<Thread {chat} {now} boxed={seen !== null} {drop} {bar} /> <Composer {chat} agent={row.agent} {below} {seen} {drop} {onfailed} {ontoast} />')
  })

  it('offers no attaching without its agent, nor once it is gone', () => {
    const gone = chatWith({ ...ROW, status: 'done' })
    gone.attachments.chips = CHIPS
    gone.see(1, [{ ...ROW, pane: 30 }])
    expect(draw(chatWith(null))).not.toContain('aria-label="Attach image"')
    expect(draw(gone)).not.toContain('aria-label="Attach image"')
    expect(draw(gone)).not.toContain('Attached images')
  })
})

const header = (boxed: boolean) =>
  render(ChatHeader, {
    props: {
      row: ROW,
      agents: [],
      backTo: 'Agents',
      boxed,
      sendable: true,
      closable: true,
      progress: null,
      onback: () => {},
      onterminal: () => {},
      onchanges: () => {},
      onfiles: () => {},
      onstart: () => {},
      onclose: () => {},
    },
  }).body

describe('Agent, with the phone keyboard open', () => {
  it('lays the composer\'s ground under it down to the bottom, moving with it, so a frame of lag behind the keys shows no gap', () => {
    const source = flat(agentSource)
    expect(source).toContain(
      '{#if seen !== null} <div class="floor" style:transform={drop > 0 ? `translateY(${drop}px)` : undefined}></div> {/if}',
    )
    expect(source).toContain(
      '.floor { position: absolute; top: 100%; right: 0; left: 0; height: 100vh; background: var(--glass); pointer-events: none; will-change: transform; }',
    )
  })

  it('drops the composer onto the keys while a finger takes them down, from where the app says they begin', () => {
    const source = flat(agentSource)
    expect(source).toContain(
      'const keys = new KeyboardTop() const seen = $derived(keyboard.covered ? keyboard.height : null) const drop = $derived(seen === null ? 0 : dropped(seen, keys.top))',
    )
    expect(source).toContain('<Composer {chat} agent={row.agent} {below} {seen} {drop} {onfailed} {ontoast} />')
    expect(source).toContain('$effect(() => keys.watch(globalThis))')
  })

  it('tells the app, while it is open, that the keys may follow the finger here and nowhere else', () => {
    expect(flat(agentSource)).toContain('$effect(() => followKeys(document.documentElement))')
  })

  it('takes the place and height of what the keyboard leaves visible, as the terminal does', () => {
    const source = flat(agentSource)
    expect(source).toContain('const keyboard = new Keyboard(globalThis)')
    expect(source).toContain('$effect(() => keyboard.watch())')
    expect(source).toContain(
      'class:keyboard={seen !== null} class:topmost style:--below="{below}px" style:top={seen === null ? undefined : `${keyboard.offset}px`} style:height={seen === null ? undefined : `${seen}px`} >',
    )
    expect(source).toContain(
      '.keyboard { position: fixed; right: 0; left: var(--pane-left); min-height: 0; padding-top: calc(env(safe-area-inset-top) + var(--below) + var(--inset)); padding-right: calc(env(safe-area-inset-right) + var(--gutter)); padding-left: calc(var(--pane-safe-left) + var(--gutter)); }',
    )
  })

  it('stays in the page while the keyboard is closed', () => {
    expect(draw(chatWith(ROW))).toMatch(/<section class="agent svelte-[\w-]+" style="--below: 0px;">/)
  })

  it('turns the header compact at once, taking the large one only out of sight', () => {
    expect(header(true)).toMatch(/<div class="short svelte-[\w-]+ compact" aria-hidden="true">/)
    expect(header(true)).toMatch(/<header class="head svelte-[\w-]+ spoken">/)
    expect(header(true)).toMatch(/<h1 class="title svelte-[\w-]+">Fix the login flow<\/h1>/)
    expect(header(false)).toMatch(/<header class="head svelte-[\w-]+">/)
    expect(header(false)).not.toMatch(/class="short[^"]* compact"/)
  })
})

describe('Agent, without its row', () => {
  it('says so once its agent stops running, offers going back to the board in the bar and has no field', () => {
    const chat = chatWith(ROW, 'go on')
    chat.see(1, [{ ...ROW, pane: 30 }])
    const body = draw(chat)
    expect(body).toMatch(/<p class="gone svelte-[\w-]+">This agent is no longer running\.<\/p>/)
    expect(body).toMatch(BACK)
    expect(body.search(BACK)).toBeLessThan(body.indexOf('class="gone'))
    expect(body).not.toContain('Back to the board')
    expect(body).not.toContain('<textarea')
    expect(body).not.toContain('<h1')
    expect(body).not.toContain('role="img"')
  })

  it('says the agent it started is starting until its row comes, with the bar and no field', () => {
    const chat = chatWith(null)
    chat.see(1, [{ ...ROW, pane: 30 }], true)
    const body = draw(chat, 0, CONNECTED, 'claude')
    expect(body).toMatch(STARTING)
    expect(body).toMatch(BACK)
    expect(body).not.toContain('no longer running')
    expect(body).not.toContain('<textarea')
    expect(body).not.toContain('class="cell cursor')
  })

  it('shows the agent it started once its row comes', () => {
    const body = draw(chatWith(ROW), 0, CONNECTED, 'claude')
    expect(body).not.toMatch(STARTING)
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">Fix the login flow<\/h1>/)
  })

  it('says it stopped running when its row goes, though it was started from here', () => {
    const chat = chatWith(null)
    chat.see(1, [ROW], true)
    chat.see(1, [{ ...ROW, pane: 30 }], true)
    const body = draw(chat, 0, CONNECTED, 'claude')
    expect(body).toContain('This agent is no longer running.')
    expect(body).not.toMatch(STARTING)
  })

  it('pulses the mark while it connects, before the first list', () => {
    const body = draw(chatWith(null), 0, { state: 'connecting' })
    expect(body).toMatch(/<span class="cell cursor svelte-[\w-]+ pulsing"><\/span>/)
    expect(body).not.toContain('no longer running')
    expect(body).not.toContain('<textarea')
  })

  it('keeps the mark still without a list once it stops connecting', () => {
    const body = draw(chatWith(null), 0, { state: 'not_paired' })
    expect(body).toMatch(/<span class="cell cursor svelte-[\w-]+"><\/span>/)
    expect(body).not.toContain('no longer running')
  })

  it.each([
    ['with its row', () => chatWith(ROW)],
    ['without its row', () => chatWith(null)],
    [
      'once it is gone',
      () => {
        const chat = chatWith(ROW)
        chat.see(1, [{ ...ROW, pane: 30 }])
        return chat
      },
    ],
  ])('offers going back to the Agents in one bar %s, with no word button', (_, made) => {
    const body = draw(made())
    expect(body.match(/<div class="bar /g)).toHaveLength(1)
    expect(body).toMatch(BACK)
    expect(body).not.toMatch(/>(?:<!--[^>]*-->| )*Back(?: to the board)?<!---->/)
  })

  it('draws the bar of the shared NavBar in every state, with no text Button to go back', () => {
    const source = flat(agentSource)
    expect(source.match(/<NavBar \{backTo\} \{onback\} \{below\} \{topmost\} \{rooted\} measure="column" \/>/g)).toHaveLength(2)
    expect(source).not.toContain('<Button tone="plain" onclick={onback}>')
  })

  it('offers opening the terminal and the changes of its agent, beside going back', () => {
    expect(draw(chatWith(ROW))).toMatch(TERMINAL)
    expect(flat(agentSource)).toContain(
      "{:else} <ChatHeader bind:bar {row} agents={agents ?? []} {backTo} {below} {topmost} {rooted} boxed={seen !== null} sendable={connection.state === 'connected'} {closable} progress={closer?.progress(row.pane) ?? null} {onback} {onterminal} {onchanges} {onfiles} {onstart} onclose={ask} /> {#key row.pane}",
    )
    const source = flat(chatHeaderSource)
    expect(source).toContain('label="Terminal" icon="square-terminal" onclick={() => onterminal(row)}')
    expect(source).toContain('label="Changes" icon="git-compare" onclick={() => onchanges(row.workspace, row.workspace_name)}')
  })

  it("offers the changes of its agent's workspace, beside its terminal", () => {
    const body = draw(chatWith(ROW))
    expect(body).toMatch(CHANGES)
    expect(body.search(CHANGES)).toBeGreaterThan(body.search(TERMINAL))
  })

  it("offers the files of its agent's workspace after its changes, titled with the workspace's name", () => {
    const body = draw(chatWith(ROW))
    expect(body.search(FILES)).toBeGreaterThan(body.search(CHANGES))
    expect(flat(chatHeaderSource)).toContain('label="Files" icon="folder" onclick={() => onfiles(row.workspace, row.workspace_name)}')
  })

  it("offers starting a new agent in its agent's workspace last, once connected", () => {
    const body = draw(chatWith(ROW))
    expect(body.search(NEW_AGENT)).toBeGreaterThan(body.search(FILES))
    expect(body.match(NEW_AGENT)?.[1]).toBeUndefined()
    expect(flat(chatHeaderSource)).toContain(
      '<ToolButton label="New agent" icon="plus" disabled={!sendable} onclick={() => onstart(row.workspace)} />',
    )
  })

  it.each<ConnectionView_Serialize>([
    { state: 'connecting' },
    { state: 'none' },
    { state: 'not_paired' },
  ])('holds New agent while the connection is $state', (connection) => {
    expect(draw(chatWith(ROW), 0, connection).match(NEW_AGENT)?.[1]).toBe(' disabled=""')
  })

  it.each([
    ['terminal', TERMINAL],
    ['changes', CHANGES],
    ['files', FILES],
    ['new agent', NEW_AGENT],
  ])('offers no %s without its agent, nor once it is gone', (_, button) => {
    const gone = chatWith(ROW)
    gone.see(1, [{ ...ROW, pane: 30 }])
    expect(draw(chatWith(null))).not.toMatch(button)
    expect(draw(gone)).not.toMatch(button)
  })
})

const keys = (chat: Chat, initialDigits = false) =>
  render(KeyRow, { props: { chat, initialDigits, onfailed: () => {} } }).body

const group = (body: string, name: string) =>
  body.match(new RegExp(`<div class="row svelte-[\\w-]+" role="group" aria-label="${name}">(.*?)</div>`))?.[1] ?? ''

const labels = (markup: string) => [...markup.matchAll(/<button [^>]*aria-label="([^"]+)"/g)].map((found) => found[1])

const key = (body: string, name: string) =>
  body.match(new RegExp(`<button class="([^"]*)" type="button" aria-label="${name}"[^>]*>(.*?)</button>`))

describe('Agent, its keys', () => {
  it('has no keys without its agent, nor once it is gone', () => {
    const gone = chatWith(ROW)
    gone.see(1, [{ ...ROW, pane: 30 }])
    expect(draw(chatWith(null))).not.toContain('aria-label="Keys"')
    expect(draw(gone)).not.toContain('aria-label="Keys"')
  })

  it.each<[string, string | RegExp]>([
    ['Escape', 'Esc'],
    ['Tab', 'Tab'],
    ['Enter', 'Enter'],
    ['Ctrl-C', /<span class="svelte-[\w-]+ shown">Ctrl-C<\/span>/],
  ])('labels %s with its short name', (name, text) => {
    const found = key(keys(chatWith(ROW)), name)
    expect(found?.[1]).toMatch(/^button plain svelte-[\w-]+ compact$/)
    expect(found?.[2]).toMatch(text)
  })

  it.each(['Up', 'Down', 'Left', 'Right'])('draws %s as an arrow', (name) => {
    const drawn = key(keys(chatWith(ROW)), name)?.[2] ?? ''
    expect(drawn).toContain('<svg')
    expect(drawn).not.toMatch(/[↑↓←→]/)
  })

  it('presses the key of each button and hands the reason of a failure over, to be told', () => {
    expect(keyRowSource.match(/onclick=\{\(\) => void press\(button\.key\)\}/g)).toHaveLength(2)
    expect(flat(keyRowSource)).toContain(
      'const press = async (key: KeyName) => { const failed = await chat.press(key) if (failed !== null) { onfailed(failed) } }',
    )
  })

  it('keeps the digits folded until their button opens them', () => {
    const body = keys(chatWith(ROW))
    expect(key(body, 'Digits')?.[0]).toContain('aria-expanded="false"')
    expect(body).not.toContain('aria-label="1"')
  })

  it('opens the digits from 1 to 0 above the keys', () => {
    const body = keys(chatWith(ROW), true)
    expect(key(body, 'Digits')?.[0]).toContain('aria-expanded="true"')
    expect(labels(group(body, 'Digits'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
    expect(body.indexOf('aria-label="Digits"')).toBeLessThan(body.indexOf('aria-label="Keys"'))
  })

  it('folds the digits only from their button, so they stay open after one is pressed', () => {
    expect(keyRowSource.match(/\bdigits = (?!\$state)/g)).toEqual(['digits = '])
    expect(keyRowSource).toContain('expanded={digits} onclick={() => (digits = !digits)}>0–9</Button>')
  })

  it('asks for a second tap in the danger tone once Ctrl-C is armed, and says it aloud', () => {
    const chat = chatWith(ROW)
    void chat.press('ctrl+c')
    const body = keys(chat)
    const found = key(body, 'Tap again to interrupt')
    expect(found?.[1]).toMatch(/^button danger svelte-[\w-]+ compact$/)
    expect(found?.[2]).toMatch(/<span class="svelte-[\w-]+ shown">Again\?<\/span>/)
    expect(found?.[2]).not.toContain('aria-live')
    expect(body).toContain('</button><!----></div> <span class="spoken" aria-live="polite">Tap again to interrupt</span></div>')
    expect(body).not.toContain('aria-label="Ctrl-C"')
  })

  it('keeps the live region outside the buttons, silent until Ctrl-C is armed', () => {
    expect(keys(chatWith(ROW))).toContain('</button><!----></div> <span class="spoken" aria-live="polite"></span></div>')
  })

  it('keeps the width of Ctrl-C when armed, so the row does not move under the second tap', () => {
    const drawn = (chat: Chat) => (key(keys(chat), chat.interrupting ? 'Tap again to interrupt' : 'Ctrl-C')?.[2] ?? '').replace(/ shown/, '')
    const chat = chatWith(ROW)
    const resting = drawn(chat)
    void chat.press('ctrl+c')
    expect(drawn(chat)).toEqual(resting)
    expect(resting).toMatch(/<span class="steady svelte-[\w-]+"><span class="svelte-[\w-]+">Ctrl-C<\/span><span class="svelte-[\w-]+">Again\?<\/span><\/span>/)
    expect(flat(keyRowSource)).toContain(
      '.steady { display: grid; } .steady > span { grid-area: 1 / 1; visibility: hidden; } .steady > .shown { visibility: visible; }',
    )
  })

  it('wraps the keys onto more lines rather than scroll sideways', () => {
    expect(flat(keyRowSource)).toContain('.row { display: flex; flex-wrap: wrap; gap: var(--gap); }')
  })
})

describe('Agent, its live line', () => {
  it('draws the line at the end of the thread, above the composer', () => {
    expect(flat(agentSource)).toContain('<Thread {chat} {now} boxed={seen !== null} {drop} {bar} /> <Composer {chat} agent={row.agent} {below} {seen} {drop} {onfailed} {ontoast} />')
    expect(flat(threadSource)).toContain('{#if note !== null} <p class="reason">{note}</p> {/if} <AgentLine {chat} {now} /> {#if boxed} <div class="room"></div> {/if} </div> </div>')
  })

  it('tells the time by the chat clock', () => {
    const body = draw(lineChat('working', ROW.since, clockAt(SINCE + 7 * 60_000).clock))
    expect(body).toMatch(/<span class="time svelte-[\w-]+">· 7 min<\/span>/)
  })

  it('ticks with the chat clock every 15 seconds', () => {
    expect(agentSource).toContain('const TICK_MS = 15_000')
    expect(flat(agentSource)).toContain('let now = $state(untrack(() => chat.now()))')
    expect(flat(agentSource)).toContain(
      '$effect(() => { const told = chat const timer = setInterval(() => (now = told.now()), TICK_MS) return () => clearInterval(timer) })',
    )
  })
})

describe('Agent, closing its agent', () => {
  const PLAN = {
    pane: ROW.pane,
    agent: 'claude',
    project: ROW.project,
    workspace: ROW.workspace,
    tabs: [ROW.tab],
    stops: [{ agent: 'claude', pane: ROW.pane, project: ROW.project, tab: ROW.tab, workspace: ROW.workspace }],
    keeps: [],
    run: null,
    closed: false,
    warning: null,
  }

  const at = (kind: Closing['kind'] | 'idle', row: AgentRow = ROW, by: Asker = 'agent') =>
    closerAt(kind, [row], { ...PLAN, pane: row.pane }, by)

  const shown = async (kind: Closing['kind'] | 'idle', connection = CONNECTED, row: AgentRow = ROW) =>
    draw(chatWith(row), 0, connection, null, [row], await at(kind, row))

  const CLOSE_AGENT = /<div class="close svelte-[\w-]+">(?:<!--[^>]*-->)*<button class="button danger svelte-[\w-]+([^"]*)"([^>]*)>([^]*?)<\/button>/

  const button = (body: string) => {
    const [, classes, attributes, inside] = body.match(CLOSE_AGENT) ?? []
    if (inside === undefined) return null
    const text = inside.replace(/<[^>]*>/g, '').trim()
    return { classes: classes.trim(), attributes: attributes.trim(), spinner: inside.includes('class="spinner'), text }
  }

  const RESTING = { classes: 'quiet resting', attributes: 'type="button" disabled="" aria-disabled="true"', spinner: false }

  const dialog = (body: string) => body.match(/<div class="sheet svelte-[\w-]+" role="dialog" aria-modal="true" aria-label="([^"]+)"/)?.[1]

  it('shows no confirmation the board asked for, which the board shows beside it in two panes', async () => {
    const body = draw(chatWith(ROW), 0, CONNECTED, null, [ROW], await at('confirming', ROW, 'board'))
    expect(dialog(body)).toBeUndefined()
  })

  it('offers a quiet danger Close agent at the foot of the large header, named by its text for VoiceOver', async () => {
    const body = await shown('idle')
    expect(button(body)).toEqual({ classes: 'quiet', attributes: 'type="button"', spinner: false, text: 'Close agent' })
    expect(body.search(CLOSE_AGENT)).toBeGreaterThan(body.indexOf('</header>'))
    expect(body.search(CLOSE_AGENT)).toBeLessThan(body.indexOf('class="composer'))
    expect(dialog(body)).toBeUndefined()
  })

  it.each<[string, ConnectionView_Serialize, AgentRow, boolean]>([
    ['while connecting', { state: 'connecting' }, ROW, true],
    ['without a connection', { state: 'none' }, ROW, true],
    ['for a row without a boot', CONNECTED, { ...ROW, boot: '' }, true],
    ['without a closer', CONNECTED, ROW, false],
  ])('rests %s, as New agent does', async (_, connection, row, closing) => {
    const closer = closing ? await at('idle', row) : null
    const body = draw(chatWith(row), 0, connection, null, [row], closer)
    expect(button(body)).toEqual({ ...RESTING, text: 'Close agent' })
  })

  it('turns a spinner while cornercase checks what closing it stops', async () => {
    const body = await shown('checking')
    expect(button(body)).toEqual({ classes: 'quiet busy', attributes: 'type="button" disabled="" aria-busy="true"', spinner: true, text: 'Close agent' })
  })

  it('says Closing… while it closes, and takes no other close', async () => {
    const body = await shown('closing')
    expect(button(body)).toEqual({ ...RESTING, text: 'Closing…' })
    expect(body).not.toContain('no longer running')
  })

  it.each(['confirming', 'rechecking'] as const)('asks before closing while %s, naming the agent as its header does', async (kind) => {
    const body = await shown(kind)
    expect(dialog(body)).toBe('Close Fix the login flow?')
    expect(body).toContain('Nothing is deleted from disk')
    expect(flat(agentSource)).toContain(
      "{#if asking !== null} {@const pane = row.pane} <CloseConfirm plan={asking.plan} label={label(row, agents ?? [])} rechecking={asking.kind === 'rechecking'} {anchor} oncancel={() => closer?.cancel(pane)} onconfirm={() => void closer?.confirm(pane)} /> {/if}",
    )
  })

  it('asks only while it is offered, the screen has its row and the phone is connected', () => {
    const source = flat(agentSource)
    expect(source).toContain(
      "const closable = $derived(row !== null && connection.state === 'connected' && closer?.offered(row) === true)",
    )
    expect(source).toContain(
      'const ask = (from: HTMLElement | null) => { if (row !== null && closable) { anchor = from void closer?.ask(row, \'agent\') } }',
    )
  })

  it('anchors the confirmation to the Close agent that opened it', () => {
    expect(flat(chatHeaderSource)).toContain('<div class="close" class:spoken={boxed} bind:this={closing}>')
    expect(flat(chatHeaderSource)).toContain("busy={progress === 'checking'} onclick={() => onclose(closing)}>")
  })

  it('leaves the button out of sight with the large header while the phone keyboard is open', () => {
    expect(header(true)).toMatch(/<div class="close svelte-[\w-]+ spoken">(?:<!--[^>]*-->)*<button class="button danger/)
    expect(header(false)).toMatch(/<div class="close svelte-[\w-]+">(?:<!--[^>]*-->)*<button class="button danger/)
  })
})
