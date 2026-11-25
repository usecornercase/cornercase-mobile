import { render } from 'svelte/server'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { describe, expect, it, vi } from 'vitest'
import App from './App.svelte'
import appSource from './App.svelte?raw'
import noMachinesSource from './routes/NoMachines.svelte?raw'

vi.mock('@tauri-apps/api/core', async (actual) => ({ ...(await actual<object>()), invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', async (actual) => ({ ...(await actual<object>()), listen: vi.fn() }))

describe('App', () => {
  const body = render(App).body.replaceAll('<!---->', '')

  it('opens on the screen with no machines, under the brand', () => {
    expect(body).toMatch(
      /<h1 class="name svelte-[\w-]+"><span class="wordmark svelte-[\w-]+" style="font-size: 22px;">cornercase<\/span><\/h1>/,
    )
    expect(body).toContain('--unit: 5px;')
    expect(body).toMatch(/<h2 class="title svelte-[\w-]+">No machines yet<\/h2>/)
  })

  it('says what a machine is and what it needs', () => {
    expect(body).toContain('A machine is a computer running cornercase whose agents you follow from here.')
    expect(body).toContain('It needs Phone app turned on in cornercase › Settings › Remote on your computer (Linux or macOS), and the code it shows.')
  })

  it('offers adding a machine, ready to be pressed', () => {
    expect(body).toMatch(/<button class="button primary svelte-[\w-]+" type="button">(<!--[^>]*-->)* Add machine<\/button>/)
  })

  it('neither calls nor listens to Tauri while rendering on the server', () => {
    expect(render(App).body).toContain('No machines yet')
    expect(invoke).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })

  it('shows the empty toast stack but no connection bar while there is no machine', () => {
    expect(body).toMatch(/<div class="toasts svelte-[\w-]+" aria-live="polite" style="--below: 0px;"><!--\[--><!--\]--><\/div>/)
    expect(body).not.toContain('role="status"')
    expect(body).not.toContain('class="board')
  })

  it('brings the card in with the shared motion', () => {
    expect(noMachinesSource).toMatch(/class="card"[^>]*\sin:riseIn[\s>]/)
    expect(noMachinesSource).toMatch(/class="card"[^>]*\sout:fadeOut[\s>]/)
  })
})

describe('App in Tauri, before the machines are listed', () => {
  it('mounts no screen, only the toast stack, so the launch layer covers no empty screen', () => {
    vi.stubGlobal('isTauri', true)
    const body = render(App).body.replace(/<!--[^>]*-->/g, '')
    vi.unstubAllGlobals()
    expect(body).toMatch(/^<main> <div class="toasts svelte-[\w-]+" aria-live="polite" style="--below: 0px;"><\/div><\/main>$/)
    expect(invoke).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })
})

describe('App wiring', () => {
  const source = appSource.replace(/\s+/g, ' ')

  it('takes the base route from the screen on every change, without leaving an open agent once the machine is gone', () => {
    expect(source).toContain('const router = new Router(routeFor(idle, 0))')
    expect(source).toContain(
      'const show = (next: Screen) => { current = next router.setBase(routeFor(next, machines.length)) }',
    )
    expect(source.match(/ current = (?!\$state)/g)).toHaveLength(1)
  })

  it('connects to the last machine asked for, and a refused connect becomes an error toast', () => {
    expect(source).toContain(
      "const join = latestWins(async (machine: number) => { show(connecting(machine)) const connected = await commands.connect(machine) if (connected.status === 'error') { joinFailed = true toasts.failed(connected.error) } })",
    )
  })

  it('goes home with a new machine, reloads the machines for its name and connects to it, leaving the demo out of the list', () => {
    expect(source).toContain(
      'const added = (machine: number) => { const from = current.machine show(connecting(machine)) Promise.all([commands.machinesList().then(remember), demoExit.switched(from, join(machine))]).catch(toasts.failed) }',
    )
    expect(source).toContain('const barMachine = $derived(onTheBar(machines, current.machine))')
  })

  it('reads the machines before the first screen, so saved machines never show the empty screen', () => {
    expect(source).toContain('let listed = $state(!isTauri())')
    expect(source).toContain('<main> {#if listed} {#if split} <aside')
    expect(source).toContain('</aside> {/if} {#if viewed !== undefined}')
    expect(source).toContain('{/if} {/if} <ToastStack')
    expect(source.match(/listed = true/g)).toHaveLength(2)
  })

  it('shows the machine it connects to before calling the list read, so the layer never leaves on a screen without it', () => {
    expect(source).toContain(
      'const known = remember(list) const first = firstToConnect(known, state) show(first === null ? screen(state, agents) : connecting(first)) listed = true if (first !== null) { await join(first) } }',
    )
  })

  it('calls the list read however the load ends, so a failed load still leaves the screens and the toast', () => {
    expect(source).toContain('Promise.all(listening).then(load).catch(toasts.failed).finally(() => (listed = true))')
  })

  it('takes the launch layer away once ready or after the cap, with the shared fade, and stops the cap on unmount', () => {
    expect(source).toContain(
      "$effect(() => { const leaving = exit(() => void dismiss(document.getElementById('launch'), prefersReducedMotion())) $effect(() => { const isReady = joinFailed || ready(listed, current) untrack(() => leaving.when(isReady)) }) return () => leaving.stop() })",
    )
    expect(source.match(/exit\(/g)).toHaveLength(1)
    expect(source.match(/[^.]dismiss\(/g)).toHaveLength(1)
  })

  it('takes the launch layer away when the connect call fails, so its error toast does not wait under it', () => {
    expect(source).toContain("if (connected.status === 'error') { joinFailed = true toasts.failed(connected.error) }")
    expect(source.match(/joinFailed = true/g)).toHaveLength(1)
  })

  it('turns a failed machine list into an error toast and connects to nothing then', () => {
    expect(source).toContain("if (listed.status === 'error') { toasts.failed(listed.error) return { machines: [], active: null } }")
    expect(source).toContain(
      'const known = remember(list) const first = firstToConnect(known, state) show(first === null ? screen(state, agents)',
    )
  })

  it('opens Machines from the bar, with the list, the active machine and its connection', () => {
    expect(source).toContain(
      "{:else if route.name === 'machines'} <Machines {machines} active={current.machine} connection={current.connection} {backTo} onback={goBack} onpick={(machine) => void pick(machine).catch(toasts.failed)} onadded={added} onrouted={reload} onedit={(machine) => router.go({ name: 'machine', id: machine })} onrescan={(machine) => router.go({ name: 'machine', id: machine, adding: true })} ondemo={() => void tryDemo().catch(toasts.failed)} />",
    )
  })

  it('edits the machine asked for, against the names of the others, and reloads the machines after each change', () => {
    expect(source).toContain(
      "const editing = $derived(route.name === 'machine' ? machines.find((machine) => machine.id === route.id) : undefined)",
    )
    expect(source).toContain(
      'const taken = $derived(machines.filter((machine) => machine.id !== editing?.id).map((machine) => machine.name))',
    )
    expect(source).toContain('const reload = () => commands.machinesList().then(remember).catch(toasts.failed)')
    expect(source).toContain(
      '{:else if editing !== undefined} <Machine machine={editing} {taken} connection={editing.id === current.machine ? current.connection : null} {backTo} onback={goBack} onchanged={reload} onremoved={() => demoExit.removed(editing.demo, removed)} adding={rescanning} />',
    )
  })

  it('opens a machine with Add route open when Machines asks to scan it again', () => {
    expect(source).toContain(
      "const rescanning = $derived(route.name === 'machine' && route.adding === true)",
    )
  })

  it('leaves a deleted machine for Machines, connecting no other, and for the empty screen after the last', () => {
    expect(source).toContain(
      'const removed = async () => { router.back() await reload() router.setBase(routeFor(current, machines.length)) }',
    )
    expect(source.match(/join\(/g)).toHaveLength(3)
  })

  it('listens before loading, and sends toasts and failures to the stack', () => {
    expect(source).toContain('events.toast.listen((event) => toasts.push(event.payload)),')
    expect(source).toContain('events.agentsChanged.listen((event) => show(apply(current, event.payload))),')
    expect(source).toContain('Promise.all(listening).then(load).catch(toasts.failed)')
  })

  it('leaves the demo through its exit, which goes back to the board and loads again as on opening', () => {
    expect(source).toContain(
      'const demoExit = new DemoExit(commands, { root: () => router.root(), load, reload, failed: toasts.failed })',
    )
  })

  it('joins a machine picked in Machines through the demo exit, which lists the machines again after the demo', () => {
    expect(source).toContain('const pick = (machine: number) => demoExit.switched(current.machine, join(machine))')
  })

  it('enters the demo on its board, shown as connecting to it before it starts so none of its events is lost, then lists it', () => {
    expect(source).toContain(
      'const tryDemo = async () => { show(connecting(DEMO_MACHINE)) router.root() await commands.demoStart() await reload() }',
    )
    expect(source.match(/tryDemo\(\)/g)).toHaveLength(2)
  })

  it('loads the agents with the state, and never the session', () => {
    expect(source).toContain('commands.connectionState(), commands.agents(), ])')
    expect(source).toContain('screen(state, agents)')
    expect(source).not.toMatch(/session/i)
  })

  it('shows the connection bar on home, an agent and a terminal of another machine in one pane, and puts the board, the agent and the toasts below it', () => {
    expect(source).toContain("const chatty = $derived(route.name === 'agent' || route.name === 'terminal')")
    expect(source).toContain("const barred = $derived(!split && (route.name === 'home' || chatty))")
    expect(source).toContain(
      "{#snippet bar()} <ConnectionBar connection={current.connection} machineName={barMachine.name} demo={barMachine.demo} bind:height={barHeight} onmachines={() => side({ name: 'machines' })} onleave={() => void demoExit.leave().catch(toasts.failed)} /> {/snippet}",
    )
    expect(source).toContain('{:else} {#if barred} {@render bar()} {/if} <div class="page"')
    expect(source).toContain(
      "style:transform={translated(shift)}> {#if route.name === 'home'} {#if !split} {@render board()} {:else if (current.agents?.length ?? 0) > 0} <p class=\"unchosen\">Choose an agent</p> {/if}",
    )
    expect(source).toContain('{:else} <NoMachines onadded={added} ondemo={() => void tryDemo().catch(toasts.failed)} /> {/if}')
    expect(source).toContain(
      '{#snippet board()} <Board machine={current.machine} agents={current.agents} connection={current.connection} {closer} {selected} below={barHeight} onopen={choose} onstart={start} /> {/snippet}',
    )
    expect(source).toContain(
      'const toastsBelow = $derived(viewed !== undefined ? terminalHead : barred ? barHeight : 0)',
    )
    expect(source).toContain(
      '<ToastStack items={toasts.items} ondismiss={(id) => toasts.dismiss(id)} below={toastsBelow} />',
    )
  })

  it('splits into two panes in a wide window over the board, unless the terminal takes the whole width', () => {
    expect(source).toContain('$effect(() => layout.watch(globalThis))')
    expect(source).toContain(
      'const split = $derived(splits(layout.wide, router.base.name, layout.full && viewed !== undefined))',
    )
    expect(source).toContain(
      "$effect(() => { const root = document.documentElement root.classList.toggle('split', split) return () => root.classList.remove('split') })",
    )
  })

  it('keeps the bar and the board in the side in two panes, beside the terminal too, following the keyboard', () => {
    expect(source).toContain(
      '{#if split} <aside class="side" style:top={keyboard.covered ? `${keyboard.offset}px` : undefined} style:height={keyboard.covered ? `${keyboard.height}px` : undefined} > {@render bar()} {@render board()} </aside> {/if}',
    )
    expect(source).toContain('const keyboard = new Keyboard(globalThis)')
    expect(source).toContain('$effect(() => keyboard.watch())')
    expect(source).toContain(
      '.side { position: fixed; top: 0; bottom: 0; left: 0; z-index: 2; box-sizing: border-box; width: var(--side); padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) env(safe-area-inset-left); overflow-y: auto; overscroll-behavior: contain; border-right: 1px solid var(--border); }',
    )
    expect(source).toContain('.page { margin-left: var(--pane-left); }')
    expect(source.match(/\{@render bar\(\)\}/g)).toHaveLength(2)
    expect(source.match(/\{@render board\(\)\}/g)).toHaveLength(2)
  })

  it('replaces the detail with what the side opens in two panes, and stacks it in one', () => {
    expect(source).toContain('const side = (next: Route) => (split ? router.settle(next) : router.go(next))')
    expect(source).toContain("const agentOf = (pane: number): Route => ({ name: 'agent', machine: current.machine, pane })")
    expect(source).toContain('const choose = (pane: number) => side(agentOf(pane))')
    expect(source).toContain("onmachines={() => side({ name: 'machines' })}")
  })

  it('always stacks an agent opened from a chat, so it goes back to its parent', () => {
    expect(source).toContain('const open = (pane: number) => router.go(agentOf(pane))')
    expect(source).toContain('onback={goBack} onopen={open}')
  })

  it('marks the shown agent of the shown machine in two panes, and drops the back button straight over the board', () => {
    expect(source).toContain(
      'const selected = $derived(split && pane !== null && owner === current.machine ? pane : null)',
    )
    expect(source).toContain("const rooted = $derived(split && router.below?.name === 'home')")
  })

  it('keeps one closer per shown machine, fed every listed board and never a list it does not have', () => {
    expect(source).toContain('const shownMachine = $derived(current.machine)')
    expect(source).toContain(
      'const closerOf = (machine: number) => new CloseAgent(commands, (toast) => toasts.push(toast), (panes) => router.closed(machine, panes)) const closer = $derived(shownMachine === null ? null : closerOf(shownMachine))',
    )
    expect(source).toContain(
      '$effect(() => { const { agents } = current if (closer !== null && agents !== null) { untrack(() => closer.seen(agents)) } })',
    )
    expect(source.match(/new CloseAgent\(/g)).toHaveLength(1)
  })

  it('goes back to the board once the agent shown, or its terminal, closes, before its chat could say it is gone', () => {
    expect(source.indexOf('chat.see(machine, agents, waiting, closing)')).toBeLessThan(source.indexOf('closer.seen(agents)'))
    expect(source).toContain('(panes) => router.closed(machine, panes)')
  })

  it('opens a chat for the tapped pane on its own machine, kept alive under its terminal and under Machines, and goes back from it', () => {
    expect(source).toContain('const opening = $derived(router.opened)')
    expect(source).toContain('const pane = $derived(opening?.pane ?? null)')
    expect(source).toContain('const owner = $derived(opening?.machine ?? null)')
    expect(source).toContain(
      'const chat = $derived( pane === null ? null : new Chat( owner, pane, commands.lastMessage, commands.send, commands.keys, commands.markReviewed, images, haptics, timers, asker, history, ), )',
    )
    expect(source).toContain('const history = new LocalHistory(commands)')
    expect(source).toContain(
      'const images: Images = { attach: commands.attach, paste: commands.pasteAttached, discard: commands.discard }',
    )
    expect(source).toContain(
      'const asker: Asker = { open: commands.questionOpen, close: commands.questionClose, listen: (heard) => events.questionChanged.listen((event) => heard(event.payload)), }',
    )
    expect(source).toContain(
      "<Agent {chat} agents={current.agents} connection={current.connection} {closer} {backTo} below={split ? 0 : barHeight} topmost={split} {rooted} {starting} onback={goBack} onopen={open} onfailed={(message) => toasts.push({ level: 'error', message })} ontoast={(toast) => toasts.push(toast)} onterminal={terminal} onchanges={review} onfiles={browse} onstart={startIn} />",
    )
  })

  it('gives the chat every list of agents, and reads once its row is seen', () => {
    expect(source).toContain(
      '$effect(() => { const { machine, agents } = current if (chat !== null) { const waiting = starting !== null const closing = closer?.closing(chat.pane) ?? false untrack(() => chat.see(machine, agents, waiting, closing)) } })',
    )
    expect(source).toContain('const seen = $derived(chat?.row != null)')
    expect(source).toContain('$effect(() => { if (chat !== null && seen) { untrack(() => chat.refresh()) } })')
  })

  it('lets the chat go once it is left, so that its images waiting on the phone are dropped', () => {
    expect(source).toContain('$effect(() => { const opened = chat return () => opened?.leave() })')
  })

  it('watches the chat for done only while its agent or its terminal is on top and the page shows', () => {
    expect(source).toContain('const inView = $derived(chatOf(route) === null ? null : chat)')
    expect(source).toContain(
      '$effect(() => { const watched = inView if (watched !== null) { return untrack(() => whileShown(document, () => watched.watchDone())) } })',
    )
  })

  it("names the route below for the back button, from the saved machines and the active machine's rows", () => {
    expect(source).toContain(
      'const lookups: Lookups = { machineName: (id) => machines.find((machine) => machine.id === id)?.name, agentRow: (opened) => opened.machine === current.machine ? current.agents?.find((row) => row.pane === opened.pane) : undefined, listed: () => current.agents ?? [], }',
    )
    expect(source).toContain('const backTo = $derived(titleOf(router.below, lookups))')
  })

  it('opens Start from the board on the active machine, with its connection and without the bar', () => {
    expect(source).toContain(
      "const start = () => { if (current.machine !== null) { side({ name: 'start', machine: current.machine }) } }",
    )
    expect(source).not.toContain('boot')
    expect(source).toContain(
      "{:else if route.name === 'start'} <Start connection={current.connection} issue={route.issue} workspace={route.workspace} {backTo} onback={goBack} onstarted={started} onissues={listIssues} /> {:else if route.name === 'issues'}",
    )
  })

  it("opens Start from an agent on the active machine, with the agent's workspace chosen", () => {
    expect(source).toContain(
      "const startIn = (workspace: number) => { if (current.machine !== null) { router.go({ name: 'start', machine: current.machine, workspace }) } }",
    )
  })

  it('lists the issues on the machine of Start, opens a tapped one with its project and starts on it where it may, from the workspace Start was opened on', () => {
    expect(source).toContain(
      "const listIssues = () => { const at = router.current if (at.name === 'start') { router.go({ name: 'issues', machine: at.machine }) } }",
    )
    expect(source).toContain(
      "const openIssue = (row: Found) => { if (issues !== null) { const { project, repository, key, source } = row router.go({ name: 'issue', machine: issues.machine, project, repository, key, source }) } }",
    )
    expect(source).toContain(
      "const whereOf = (shown: Extract<Route, { name: 'issue' }>): Where => issues?.whereOf(shown, router.latest('start')?.workspace) ?? { project: null, places: [] }",
    )
    expect(source).toContain(
      "const startOn = (starting: StartingIssue) => { if (issue !== null) { router.go({ name: 'start', machine: issue.machine, issue: starting }) } }",
    )
    expect(source).toContain(
      "{:else if route.name === 'issues'} {#if issues !== null} <Issues {issues} {backTo} onback={goBack} onopen={openIssue} /> {/if} {:else if route.name === 'issue'} {#if issue !== null} <Issue {issue} where={whereOf(route)} {backTo} onback={goBack} onstart={startOn} /> {/if} {:else if route.name === 'machines'}",
    )
  })

  it('keeps one state of the listed project and one of the read issue while they are in the stack, reading them on untracked and leaving them after', () => {
    expect(source).toContain("const listing = $derived(router.latest('issues'))")
    expect(source).toContain(
      'const issues = $derived(listing === null ? null : new IssuesState(listing.machine, commands))',
    )
    expect(source).toContain("const shown = $derived(router.latest('issue'))")
    expect(source).toContain(
      'const issue = $derived(shown === null ? null : new IssueState(shown.machine, shown, commands))',
    )
    expect(source).toContain(
      'const kept = (state: IssuesState | IssueState | null) => { if (state === null) { return } untrack(() => void state.load()) return () => state.stop() }',
    )
    expect(source).toContain('$effect(() => kept(issues)) $effect(() => kept(issue))')
  })

  it('reads the issues again when the connection comes back', () => {
    expect(source).toContain(
      "$effect(() => { const connected = current.connection.state === 'connected' const watched = [issues, issue] untrack(() => watched.forEach((state) => void state?.see(connected))) })",
    )
  })

  it('puts the agent it started on the board in place of Start and all under it, says it is starting and tells its warning', () => {
    expect(source).toContain(
      "const started = (placed: Started, agent: string) => { const at = router.current if (at.name === 'start') { launched = agent router.settle({ name: 'agent', machine: at.machine, pane: placed.pane, starting: true }) } else { toasts.push({ level: 'info', message: `${agent} started` }) } if (placed.warning !== null) { toasts.push({ level: 'info', message: placed.warning }) } }",
    )
    expect(source).toContain(
      "const starting = $derived(route.name === 'agent' && route.starting === true ? launched : null)",
    )
  })

  it('reads again on a status change of its pane on its machine, vouching for nothing after one of the machine', () => {
    expect(source).toContain(
      'events.paneStatusChanged.listen((event) => { if (chat !== null && touches(event.payload, chat.machine, chat.pane)) { if (event.payload.pane === null) { chat.lose() } void chat.refresh() } }),',
    )
  })

  it("opens an agent's terminal on top of it, on the machine the agent runs on", () => {
    expect(source).toContain(
      "const terminal = (row: AgentRow) => { if (current.machine !== null) { router.go({ name: 'terminal', machine: current.machine, row }) } }",
    )
  })

  it('shows the terminal on top of everything only on its own machine, going back from it and putting the toasts below its bar', () => {
    expect(source).toContain('const viewed = $derived(openedTerminal(route, current))')
    expect(source).toContain(
      '{#if viewed !== undefined} <Terminal machine={viewed.machine} row={viewed.row} {backTo} {shift} onback={goBack} onfailed={toasts.failed} bind:height={terminalHead} />',
    )
  })

  it("opens the changes of an agent's workspace on top of it, on the active machine, and their diff above them", () => {
    expect(source).toContain(
      "const review = (workspace: number, title: string) => { if (current.machine !== null) { router.go({ name: 'changes', machine: current.machine, workspace, title }) } }",
    )
    expect(source).toContain(
      "{:else if route.name === 'changes'} {#if changes !== null} <Changes title={route.title} {changes} {backTo} onback={goBack} onopen={change} /> {/if} {:else if route.name === 'change'} {#if changes !== null} <Diff path={route.path} {changes} {backTo} onback={goBack} onfile={whole} /> {/if} {:else if route.name === 'files'}",
    )
  })

  it("reads a file of the list and opens its diff in the list's mode", () => {
    expect(source).toContain(
      "const change = (path: string) => { if (changes !== null) { void changes.open(path) router.go({ name: 'change', machine: changes.machine, workspace: changes.workspace, path }) } }",
    )
  })

  it('goes back through one action that drops the open diff only when leaving it', () => {
    expect(source).toContain(
      "const goBack = () => { const top = router.current.name if (top === 'change') { changes?.closeDiff() }",
    )
    expect(source.match(/onback=\{goBack\}/g)).toHaveLength(11)
    expect(source).not.toContain('onback={() =>')
    expect(source).not.toContain('leaveDiff')
  })

  it('keeps one state of the reviewed workspace under its list and its diff, following it once it listens and leaving it after', () => {
    expect(source).toContain('const reviewedMachine = $derived(reviewed?.machine ?? null)')
    expect(source).toContain('const reviewedWorkspace = $derived(reviewed?.workspace ?? null)')
    expect(source).toContain(
      'follow: commands.changesFollow, unfollow: commands.changesUnfollow, read: commands.changesFile, mark: commands.changesViewed, }, (toast) => toasts.push(toast),',
    )
    expect(source).toContain(
      'const listening = events.changesChanged.listen((event) => state.see(event.payload)) listening.then(() => state.start()).catch(toasts.failed) return () => { state.stop() listening.then((unlisten) => unlisten()).catch(toasts.failed) }',
    )
  })

  it("opens the files of an agent's workspace on top of it, on the active machine, and a file above them", () => {
    expect(source).toContain(
      "const browse = (workspace: number, title: string) => { if (current.machine !== null) { router.go({ name: 'files', machine: current.machine, workspace, title }) } }",
    )
    expect(source).toContain(
      "{:else if route.name === 'files'} {#if files !== null} <Files title={route.title} {files} {backTo} onback={goBack} onopen={read} /> {/if} {:else if route.name === 'file'} {#if files !== null} <File path={route.path} {files} {backTo} onback={goBack} /> {/if} {:else if route.name === 'start'}",
    )
  })

  it('reads a file of the tree each time it opens it', () => {
    expect(source).toContain(
      "const read = (path: string) => { if (files !== null) { void files.open(path) router.go({ name: 'file', machine: files.machine, workspace: files.workspace, path }) } }",
    )
  })

  it('drops the open file before going back from it, then lists the tree again', () => {
    expect(source).toContain(
      "if (top === 'file') { files?.closeFile() } router.back() if (top === 'file') { void files?.refresh() } }",
    )
    expect(source).not.toContain('leaveFile')
  })

  it('opens the whole file of a diff above it, on the same workspace, keeping the diff and its state under it', () => {
    expect(source).toContain(
      "const whole = (path: string) => { if (changes !== null) { router.go({ name: 'file', machine: changes.machine, workspace: changes.workspace, path }) } }",
    )
  })

  it('keeps one state of the browsed workspace under its tree and its file, listing the tree or reading the file it opened on untracked, so its own writes do not stop it, and leaving it after', () => {
    expect(source).toContain('const browsedMachine = $derived(browsed?.machine ?? null)')
    expect(source).toContain('const browsedWorkspace = $derived(browsed?.workspace ?? null)')
    expect(source).toContain(
      '{ list: commands.filesList, read: commands.filesRead, search: commands.filesSearch, stopSearch: commands.filesSearchStop, }, (toast) => toasts.push(toast),',
    )
    expect(source).toContain(
      "untrack(() => { const top = router.current void (top.name === 'file' ? state.open(top.path) : state.start()) }) return () => state.stop()",
    )
  })

  it('goes back with the edge swipe only on iOS over another screen, and never while the scanner is open', () => {
    expect(source).toContain('const swipeable = $derived(backSwipes(platform, router.below, split))')
    expect(source).toContain(
      "$effect(() => { if (!swipeable) { return } return watchBackSwipe(document, { enabled: () => !document.documentElement.classList.contains('scanning'), width: () => innerWidth, reduced: prefersReducedMotion, onshift: (next) => (shift = next), onback: goBack, }) })",
    )
    expect(source.match(/watchBackSwipe\(/g)).toHaveLength(1)
  })

  it("takes android's back button only while it goes back or cancels the scanner, deciding when pressed", () => {
    expect(source).toContain('const pressed = () => backPressed(platform, router.below, openScanner.scanning)')
    expect(source).toContain('const backHandled = $derived(handled(pressed()))')
    expect(source).toContain(
      '$effect(() => { if (!backHandled) { return } return watchBackButton({ pressed, onback: goBack, onscan: () => void openScanner.stop(), failed: toasts.failed }) })',
    )
    expect(source.match(/watchBackButton\(/g)).toHaveLength(1)
  })

  it('slides every screen but the connection bar and the toasts, and the terminal on its own', () => {
    expect(source).toContain('let shift = $state<Shift>(RESTING)')
    expect(source).toContain(
      '{#if barred} {@render bar()} {/if} <div class="page" class:sliding={shift.x > 0} class:settling={shift.eased} style:transform={translated(shift)}>',
    )
    expect(source).toContain('<NoMachines onadded={added} ondemo={() => void tryDemo().catch(toasts.failed)} /> {/if} </div> {/if} {/if} <ToastStack')
    expect(source.match(/translated\(shift\)/g)).toHaveLength(1)
  })

  it('shows a terminal of another machine as the gone agent', () => {
    expect(source).toContain(
      "{:else if chatty} {#if chat !== null} <Agent {chat} agents={current.agents} connection={current.connection} {closer} {backTo} below={split ? 0 : barHeight} topmost={split} {rooted} {starting} onback={goBack} onopen={open} onfailed={(message) => toasts.push({ level: 'error', message })} ontoast={(toast) => toasts.push(toast)} onterminal={terminal} onchanges={review} onfiles={browse} onstart={startIn} /> {/if} {:else if route.name === 'changes'}",
    )
  })
})
