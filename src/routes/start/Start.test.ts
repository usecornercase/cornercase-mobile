import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import comments from '../../../crates/core/tests/fixtures/control/issue-read/v1/comments.json'
import type {
  ConnectionView_Serialize,
  FlowChoice_Serialize as FlowChoice,
  Place,
  ReadIssue_Serialize as ReadIssue,
  StartAgents_Serialize,
} from '../../lib/bindings'
import { FlowStart } from '../../lib/flowStart.svelte'
import type { StartingIssue } from '../../lib/router.svelte'
import { StartForm, type StartCalls } from '../../lib/startForm.svelte'
import AgentForm from './AgentForm.svelte'
import agentSource from './AgentForm.svelte?raw'
import pickerSource from './AgentPicker.svelte?raw'
import flowPickerSource from './FlowPicker.svelte?raw'
import IssueForm from './IssueForm.svelte'
import issueSource from './IssueForm.svelte?raw'
import Picker from './Picker.svelte'
import Segmented from './Segmented.svelte'
import segmentedSource from './Segmented.svelte?raw'
import ShowIssues from './ShowIssues.svelte'
import showSource from './ShowIssues.svelte?raw'
import Start from './Start.svelte'
import startSource from './Start.svelte?raw'
import Switch from './Switch.svelte'
import switchSource from './Switch.svelte?raw'
import workspacePickerSource from './WorkspacePicker.svelte?raw'

const CONNECTED: ConnectionView_Serialize = { state: 'connected', route: 'ws://mac:7000' }

const answer = <T>(data: T) => Promise.resolve({ status: 'ok' as const, data })

const never = () => new Promise<never>(() => {})

const installed = (...names: string[]): StartAgents_Serialize => ({
  agents: names.map((name) => ({ agent: name, command: name, installed: true })),
  accounts: [],
})

const CALLS: StartCalls = {
  startProjects: () =>
    answer({
      boot: 'boot-1',
      projects: [
        { id: 1, name: 'web', workspaces: [{ id: 12, name: 'main' }] },
        { id: 2, name: 'api', workspaces: [{ id: 9, name: 'Login' }] },
      ],
    }),
  installedAgents: () => answer(installed('claude', 'codex')),
  startAgent: never,
  startIssue: never,
  issueFlows: never,
  startFlow: never,
}

const formOf = async (calls: Partial<StartCalls> = {}) => {
  const form = new StartForm({ ...CALLS, ...calls }, () => {}, { agent: null, workspace: null })
  await form.load()
  return form
}

const refusing = (message: string) => () =>
  Promise.resolve({ status: 'error' as const, error: { code: 'failed' as const, message } })

const READ = comments as ReadIssue

const API = { project: 2, workspace: null, label: 'api', worktree: true }

const LOGIN = { project: 2, workspace: 9, label: 'api › Login', worktree: false }

const COUPON: StartingIssue = { project: 2, places: [LOGIN, API], issue: READ.issue, prompt: READ.prompt }

const screen = (
  form: StartForm,
  connection: ConnectionView_Serialize = CONNECTED,
  issue?: StartingIssue,
  workspace?: number,
) =>
  render(Start, {
    props: {
      connection,
      issue,
      workspace,
      backTo: 'Agents',
      onback: () => {},
      onstarted: () => {},
      onissues: () => {},
      form,
    },
  }).body

const onIssue = (form: StartForm, connection: ConnectionView_Serialize = CONNECTED, issue = COUPON) =>
  screen(form, connection, issue)

const OPTION = /<option value="([^"]*)"( selected)?[^>]*>([^<]*)<\/option>/g

const optionsOf = (body: string) =>
  [...body.matchAll(OPTION)].map(([, value, selected, name]) => `${selected === undefined ? ' ' : '*'}${value} ${name}`)

const showIssues = (sendable = true) => render(ShowIssues, { props: { sendable, onshow: () => {} } }).body

const agentForm = (form: StartForm, sendable = true) => render(AgentForm, { props: { form, sendable } }).body

const LABEL = /<label class="label[^"]*" for="[^"]+">([^<]+)<\/label>/g

const labels = (body: string) => [...body.matchAll(LABEL)].map(([, text]) => text)

const errorOf = (body: string, label: string) =>
  body.match(new RegExp(`>${label}</label>[^]*?<p class="error[^"]*" id="[^"]+">([^<]*)</p>`))?.[1]

const SUBMIT = /<button class="button primary[^"]*" type="submit"([^>]*)>([^]*?)<\/button>/

const submit = (body: string) => body.match(SUBMIT)

const label = (button: RegExpMatchArray | null) => button?.[2].replace(/<[^>]*>|\s/g, '')

const filled = async (calls: Partial<StartCalls> = {}) => {
  const form = await formOf(calls)
  form.workspace = 9
  form.prompt = 'fix the login'
  return form
}

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('Start', () => {
  it('goes back to the agents from a bar with its title, and starts on Agent, with Issue as the only other action', async () => {
    const body = screen(await formOf())
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost form"[^]*?aria-label="Back to Agents"/)
    expect(body).toMatch(/<div class="center svelte-[\w-]+">(<!--[^>]*-->)*<h1 class="title svelte-[\w-]+">Start<\/h1>/)
    expect(body).not.toContain('class="top')
    expect(body).toMatch(
      /<div class="actions[^"]*" role="group" aria-label="What to start"><!--\[-->(<!--[^>]*-->)?<button[^>]*aria-pressed="true">Agent<\/button>(<!--[^>]*-->)?<button[^>]*aria-pressed="false">Issue<\/button>(<!--[^>]*-->)?<!--]--><\/div>/,
    )
    expect(labels(body)).toEqual(['Workspace', 'Agent', 'Model', 'Prompt'])
  })

  it('shows the projects and the agents loading while the rest can be filled', () => {
    const body = screen(new StartForm(CALLS, () => {}, { agent: null, workspace: null }))
    const reading = [...body.matchAll(/<p class="state[^"]*"><span class="spinner[^]*?<\/span>(?:<!---->)?([^<]*)</g)]
    expect(reading.map(([, text]) => text)).toEqual(['Reading the workspaces…', 'Reading the agents…'])
    expect(labels(body)).toEqual(['Model', 'Prompt'])
  })

  it('holds Start and says why while not connected', async () => {
    const form = await formOf()
    const body = screen(form, { state: 'connecting' })
    expect(body).toContain('Not connected to the machine. What you type stays here until it connects.')
    expect(submit(body)?.[1]).toContain('disabled=""')
    expect(screen(form)).not.toContain('Not connected')
    expect(submit(screen(form))?.[1]).not.toContain('disabled')
  })
})

describe('Start, its agent form', () => {
  it('lists the workspaces to choose from under their projects, and the agents with the first one chosen', async () => {
    const body = agentForm(await formOf())
    expect(body).toMatch(
      /<option disabled="" selected="">Choose…<\/option>[^]*?<option value="12">web › main<\/option><option value="9">api › Login</,
    )
    expect(body).toMatch(/<option value="claude" selected="">claude<\/option><option value="codex">codex<\/option>/)
  })

  it('chooses the workspace of the agent it was opened from', async () => {
    const form = await formOf()
    const body = screen(form, CONNECTED, undefined, 9)
    expect(form.workspace).toBe(9)
    expect(body).toMatch(/<option value="12">web › main<\/option><option value="9" selected="">api › Login</)
  })

  it('chooses the only workspace', async () => {
    const projects = [
      { id: 5, name: 'web', workspaces: [{ id: 12, name: 'main' }] },
      { id: 2, name: 'api', workspaces: [] },
    ]
    const body = agentForm(await formOf({ startProjects: () => answer({ boot: null, projects }) }))
    expect(body).toMatch(/<select[^>]*>(?:<!--[^>]*-->)*<option value="12" selected="">web › main<\/option>/)
  })

  it('says why the agents could not be read, with Try again', async () => {
    const body = agentForm(await formOf({ installedAgents: refusing('account list failed') }))
    expect(body).toMatch(/<p class="label[^"]*">Agent<\/p>/)
    expect(body).toMatch(
      /<p class="state reason[^"]*">account list failed<\/p> (?:<!--\[0-->)?<button class="button plain[^"]*"[^>]*>[^]*?Try again/,
    )
  })

  it('says when no agent is installed and holds Start', async () => {
    const body = agentForm(await formOf({ installedAgents: () => answer(installed()) }))
    expect(body).toContain('No agent is installed on this machine.')
    expect(submit(body)?.[1]).toContain('disabled=""')
  })

  it('tells each refused field under it', async () => {
    const form = await formOf()
    form.agent = ''
    form.prompt = '   '
    await form.start()
    const body = agentForm(form)
    expect(['Workspace', 'Agent', 'Prompt', 'Model'].map((field) => errorOf(body, field))).toEqual([
      'Choose a workspace',
      'Choose an agent',
      'Write what the agent should do',
      '',
    ])
  })

  it('turns the button into a spinner with Starting… and holds the fields while it sends', async () => {
    const form = await filled()
    void form.start()
    const body = agentForm(form)
    expect(submit(body)?.[1]).toContain('aria-busy="true"')
    expect(submit(body)?.[2]).toContain('class="spinner')
    expect(label(submit(body))).toBe('Starting…')
    expect(body.match(/<(?:input|textarea|select)[^>]*disabled=""/g)).toHaveLength(5)
  })

  it('shows what the server says and keeps what was typed', async () => {
    const form = await filled({ startAgent: refusing('the branch exists') })
    await form.start()
    const body = agentForm(form)
    expect(body).toMatch(/<p class="problem[^"]*" role="alert">the branch exists<\/p>/)
    expect(body).toContain('>fix the login</textarea>')
    expect(label(submit(body))).toBe('Start')
  })
})

describe('Start, where its agent works', () => {
  const WORKTREE: Place = { kind: 'worktree', project: 2, branch: 'fix-login' }

  const note = (body: string) => flat(body).match(/<p class="note[^"]*">([^<]*)<\/p>/)?.[1]

  it('starts in a new tab in the workspace with the Own worktree switch off', async () => {
    const body = agentForm(await formOf())
    expect(body).toMatch(/">Own worktree<\/span> <input class="toggle[^"]*" type="checkbox" role="switch"\/>/)
    expect(labels(body)).toEqual(['Workspace', 'Agent', 'Model', 'Prompt'])
    expect(note(body)).toBe('The agent starts in a new tab in this workspace.')
  })

  it('asks for a branch once the switch is on, and says where the agent works', async () => {
    const form = await formOf()
    form.ownWorktree = true
    form.branch = 'fix-login'
    const body = agentForm(form)
    expect(body).toMatch(/role="switch" checked=""\/>/)
    expect(labels(body)).toEqual(['Workspace', 'Branch', 'Agent', 'Model', 'Prompt'])
    expect(body).toContain('value="fix-login"')
    expect(note(body)).toBe("The agent works in its own worktree on this branch, made from the workspace's project.")
  })

  it('tells a missing branch under it', async () => {
    const form = await filled()
    form.ownWorktree = true
    await form.start()
    expect(errorOf(agentForm(form), 'Branch')).toBe('Name the branch')
  })

  it.each<[string, boolean, string, Place]>([
    ['the workspace with the switch off', false, '', { kind: 'workspace', workspace: 9 }],
    ["a worktree of the workspace's project with it on", true, 'fix-login', WORKTREE],
  ])('sends %s', async (_, own, branch, place) => {
    const startAgent = vi.fn(never)
    const form = await filled({ startAgent })
    form.ownWorktree = own
    form.branch = branch
    void form.start()
    const sent = { place, agent: 'claude', model: '', prompt: 'fix the login', accounts: [] }
    expect(startAgent.mock.calls).toEqual([[sent]])
  })

  it('says no workspace is open and holds Start without any', async () => {
    const projects = [{ id: 1, name: 'web', workspaces: [] }]
    const body = agentForm(await formOf({ startProjects: () => answer({ boot: null, projects }) }))
    expect(body).toContain('No workspace is open on this machine.')
    expect(submit(body)?.[1]).toContain('disabled=""')
  })
})

describe('Start, the account its agent starts with', () => {
  const TEAM: StartAgents_Serialize = {
    ...installed('claude', 'codex'),
    accounts: [
      {
        agent: 'codex',
        default: 'team',
        options: [
          { name: '', label: 'Mac login', login: 'signed-in' },
          { name: 'team', label: 'Team', login: 'signed-in' },
          { name: 'old', label: 'Old', login: 'signed-out' },
        ],
      },
    ],
  }

  const onCodex = async () => {
    const form = await formOf({ installedAgents: () => answer(TEAM) })
    form.agent = 'codex'
    return form
  }

  const SIGNED_OUT = 'This account is signed out: the agent will ask to log in on the machine.'

  it('offers the own login and each account of the agent under it, its default chosen', async () => {
    const body = agentForm(await onCodex())
    expect(labels(body)).toEqual(['Workspace', 'Agent', 'Account', 'Model', 'Prompt'])
    expect(optionsOf(body).slice(-3)).toEqual(['  Mac login', '*team Team', ' old Old · signed out'])
  })

  it('shows no Account for an agent without accounts', async () => {
    const form = await onCodex()
    form.agent = 'claude'
    expect(labels(agentForm(form))).toEqual(['Workspace', 'Agent', 'Model', 'Prompt'])
  })

  it('notes that the account chosen is signed out', async () => {
    const form = await onCodex()
    expect(agentForm(form)).not.toContain(SIGNED_OUT)
    form.accounts.choose('codex', 'old')
    const body = agentForm(form)
    expect(body).toMatch(new RegExp(`<p class="note[^"]*">${SIGNED_OUT}</p>`))
    expect(optionsOf(body).slice(-1)).toEqual(['*old Old · signed out'])
  })

  it('offers the accounts on an issue under its agent', async () => {
    expect(labels(onIssue(await onCodex()))).toEqual(['Where', 'Branch', 'Agent', 'Account', 'Model'])
  })
})

describe('Start, its way to the issues', () => {
  it('asks for no project and offers Show issues, for the issues of every project', () => {
    const body = showIssues()
    expect(labels(body)).toEqual([])
    expect(body).not.toContain('<select')
    expect(body).toContain('See the issues of every project and pick one to start an agent on it.')
    expect(label(submit(body))).toBe('Showissues')
    expect(submit(body)?.[1]).not.toContain('disabled')
    expect(flat(showSource)).toContain('<FormFrame problem={null} onsubmit={onshow}>')
  })

  it('holds Show issues while not connected', () => {
    expect(submit(showIssues(false))?.[1]).toContain('disabled=""')
  })
})

describe('Start, on an issue', () => {
  it('shows only the issue form, with no other action to switch to and no prompt to write', async () => {
    const body = onIssue(await formOf())
    expect(body).not.toContain('aria-label="What to start"')
    expect(body).not.toContain('Show issues')
    expect(labels(body)).toEqual(['Where', 'Branch', 'Agent', 'Model'])
    expect(body).not.toContain('<textarea')
    expect(label(submit(body))).toBe('Start')
  })

  it("heads the form with the issue's key, its project and its title", async () => {
    const body = onIssue(await formOf())
    expect(body).toMatch(/<span class="key[^"]*">#41<\/span> (?:<!--[^>]*-->)*<span class="project[^"]*">api<\/span>/)
    expect(body).toMatch(/<p class="name[^"]*">Checkout forgets the coupon after a refresh<\/p>/)
  })

  it("fills the branch with the issue's and says where the agent works", async () => {
    const body = flat(onIssue(await formOf()))
    expect(body).toMatch(/placeholder="issue-41-checkout-forgets-the-coupon"[^>]*value="issue-41-checkout-forgets-the-coupon"/)
    expect(body.match(/>Branch<\/label>[^]*<p class="note[^"]*">([^<]*)<\/p>/)?.[1]).toBe(
      "The agent works in its own worktree on this branch. If the project's folder is not the root of a git repository, it starts in a new tab there instead.",
    )
  })

  it("offers where to start it, at first in a new worktree of the issue's project, on the issue's branch", async () => {
    const body = onIssue(await formOf())
    expect(optionsOf(body).filter((option) => option.includes('workspace-') || option.includes('project-'))).toEqual([
      ' workspace-9 api › Login · new tab',
      '*project-2 api · new worktree on issue-41-checkout-forgets-the-coupon',
    ])
  })

  it('starts it in the workspace Start was opened on, in a new tab with no branch', async () => {
    const body = flat(onIssue(await formOf(), CONNECTED, { ...COUPON, workspace: 9 }))
    expect(optionsOf(body)).toContain('*workspace-9 api › Login · new tab')
    expect(labels(body)).toEqual(['Where', 'Agent', 'Model'])
    expect(body).toMatch(/<p class="note[^"]*">The agent starts in a new tab there.<\/p>/)
  })

  it('says cornercase names the branch when the issue has none', async () => {
    const body = flat(onIssue(await formOf(), CONNECTED, { ...COUPON, issue: { ...READ.issue, branch: '' } }))
    expect(body).toMatch(/<p class="note[^"]*">Left empty, cornercase names the branch.<\/p>/)
  })

  it('asks where to start it under Where when no place is chosen', async () => {
    const form = await formOf()
    onIssue(form, CONNECTED, { ...COUPON, project: null, places: [LOGIN, API] })
    await form.startIssue()
    const body = screen(form)
    expect(errorOf(body, 'Where')).toBe('Choose where to start')
    expect(labels(body)).toEqual(['Where', 'Agent', 'Model'])
    expect(body).not.toContain('note')
  })

  it('says there is nowhere to start it when there is no place', async () => {
    const body = onIssue(await formOf(), CONNECTED, { ...COUPON, places: [] })
    expect(body).toContain('There is no place to start an agent on this issue.')
  })

  it('folds the prompt cornercase will use, to read and not to change', async () => {
    const body = onIssue(await formOf())
    expect(body).toMatch(
      /<details class="prompt[^"]*"><summary class="summary[^"]*">Prompt cornercase will use<\/summary> <p class="said[^"]*">https:\/\/github.com\/acme\/shop\/issues\/41<\/p><\/details>/,
    )
  })

  it('turns the button into a spinner with Starting… and holds the fields while it sends', async () => {
    const form = await formOf()
    const body = () => screen(form)
    onIssue(form)
    void form.startIssue()
    expect(submit(body())?.[1]).toContain('aria-busy="true"')
    expect(label(submit(body()))).toBe('Starting…')
    expect(body().match(/<(?:input|select)[^>]*disabled=""/g)).toHaveLength(4)
  })

  it('shows what the server says and keeps the branch typed', async () => {
    const form = await formOf({ startIssue: refusing('no issue #41 in GitHub') })
    onIssue(form)
    form.branch = 'coupon-fix'
    await form.startIssue()
    const body = screen(form)
    expect(body).toMatch(/<p class="problem[^"]*" role="alert">no issue #41 in GitHub<\/p>/)
    expect(body).toContain('value="coupon-fix"')
    expect(label(submit(body))).toBe('Start')
  })

  it('holds Start while not connected', async () => {
    const body = onIssue(await formOf(), { state: 'connecting' })
    expect(body).toContain('Not connected to the machine.')
    expect(submit(body)?.[1]).toContain('disabled=""')
  })

  it('hands over the agent it started on the issue', async () => {
    const onstarted = vi.fn()
    const started = { project: 2, workspace: 3, tab: 4, pane: 5, warning: null }
    const form = new StartForm({ ...CALLS, startIssue: () => answer(started) }, onstarted, {
      agent: null,
      workspace: null,
    })
    await form.load()
    onIssue(form)
    await form.startIssue()
    expect(onstarted.mock.calls).toEqual([[started, 'claude']])
  })

  it("sends a new worktree of the issue's project, or the workspace chosen", async () => {
    const startIssue = vi.fn(() => answer({ project: 2, workspace: 3, tab: 4, pane: 5, warning: null }))
    const sent = async (place: string) => {
      const form = await formOf({ startIssue })
      onIssue(form)
      form.place = place
      await form.startIssue()
    }
    await sent('project-2')
    await sent('workspace-9')
    const branch = READ.issue.branch
    const issue = { agent: 'claude', model: '', key: '#41', source: 'github', issue_branch: branch, accounts: [] }
    expect(startIssue.mock.calls).toEqual([
      [{ ...issue, place: { kind: 'worktree', project: 2, branch: READ.issue.branch } }],
      [{ ...issue, place: { kind: 'workspace', workspace: 9 } }],
    ])
  })
})

describe('Start, a flow on an issue', () => {
  const team = (...members: string[]) =>
    members.map((member) => {
      const [role, agent] = member.split(' · ')
      return { role, agent }
    })

  const FLOWS: FlowChoice[] = [
    {
      name: 'Ship it',
      description: 'A coder and a tester for the shop, leaving a pull request.',
      roles: team('coder · codex', 'orchestrator · claude', 'tester · claude'),
      problems: [],
      default: true,
    },
    { name: 'Quick', description: '', roles: team('orchestrator · claude'), problems: [], default: false },
    {
      name: 'Second opinion',
      description: 'Two reviewers compare notes.',
      roles: team('orchestrator · claude', 'reviewer · codex'),
      problems: ['`summary` is in no stage', 'no reviewer'],
      default: false,
    },
  ]

  const ORCHESTRATOR = { project: 2, workspace: 3, tab: 6, pane: 7, warning: 'check the coder' }

  const opened = async (calls: Partial<StartCalls> = {}, issue = COUPON, onstarted = vi.fn()) => {
    const all = { ...CALLS, issueFlows: () => answer({ flows: FLOWS }), ...calls }
    const form = new StartForm(all, onstarted, { agent: null, workspace: null })
    await form.load()
    form.forIssue(issue)
    return { form, flows: new FlowStart(form, all, { flow: null }), onstarted }
  }

  const looked = async (calls: Partial<StartCalls> = {}, issue = COUPON) => {
    const opening = await opened(calls, issue)
    await opening.flows.look()
    return opening
  }

  const flowing = async (calls: Partial<StartCalls> = {}) => {
    const opening = await looked(calls)
    await opening.flows.use('flow')
    return opening
  }

  const drawn = ({ form, flows }: { form: StartForm; flows: FlowStart }) =>
    render(IssueForm, { props: { form, sendable: true, flows } }).body

  const modes = (body: string) =>
    body
      .match(/<div class="actions[^"]*" role="group" aria-label="Who works">([^]*?)<\/div>/)?.[1]
      .match(/aria-pressed="\w+"[^>]*>\w+/g)
      ?.map((button) => button.replace(/aria-pressed="(\w+)"[^>]*>/, '$1 '))

  const flowsOf = (body: string) =>
    [...body.matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)]
      .filter(([, value]) => FLOWS.some((flow) => flow.name === value))
      .map(([, , attributes, words]) => `${attributes.includes('selected') ? '*' : attributes.includes('disabled') ? '-' : ' '}${words}`)

  it('offers Agent and Flow above Where, on Agent, once the project has a flow', async () => {
    const body = drawn(await looked())
    expect(modes(body)).toEqual(['true Agent', 'false Flow'])
    expect(body.indexOf('aria-label="Who works"')).toBeLessThan(body.indexOf('>Where</label>'))
    expect(labels(body)).toEqual(['Where', 'Branch', 'Agent', 'Model'])
  })

  it.each<[string, Partial<StartCalls>, StartingIssue]>([
    ['without a place for a new worktree', {}, { ...COUPON, places: [LOGIN] }],
    ['when the project has none', { issueFlows: () => answer({ flows: [] }) }, COUPON],
  ])('offers no Flow %s', async (_, calls, issue) => {
    expect(drawn(await looked(calls, issue))).not.toContain('aria-label="Who works"')
  })

  it('offers no Flow while the flows are read', async () => {
    const opening = await opened({ issueFlows: never })
    void opening.flows.look()
    expect(drawn(opening)).not.toContain('aria-label="Who works"')
  })

  it("in Flow asks for no agent nor model, keeps Branch and offers only the project's new worktree", async () => {
    const body = drawn(await flowing())
    expect(modes(body)).toEqual(['false Agent', 'true Flow'])
    expect(labels(body)).toEqual(['Where', 'Branch', 'Flow'])
    expect(optionsOf(body).filter((option) => option.includes('workspace-') || option.includes('project-'))).toEqual([
      '*project-2 api · new worktree on issue-41-checkout-forgets-the-coupon',
    ])
    expect(flat(body)).toMatch(/<p class="note[^"]*">The flow's team works in its own worktree on this branch.<\/p>/)
  })

  it('lists each flow with its name, its agents and its description, the one with problems held with the first', async () => {
    expect(flowsOf(drawn(await flowing()))).toEqual([
      '*Ship it · 3 agents · A coder and a tester for the shop, leaving a pull request.',
      ' Quick · 1 agent',
      '-Second opinion · 2 agents · `summary` is in no stage',
    ])
  })

  it('lists once a name two flows share, the one cornercase runs', async () => {
    const shadowed = { ...FLOWS[1], problems: ['the built-in one is also named `Quick` and runs instead'] }
    const flows = [...FLOWS.slice(0, 2), shadowed, FLOWS[2]]
    expect(flowsOf(drawn(await flowing({ issueFlows: () => answer({ flows }) })))).toEqual([
      '*Ship it · 3 agents · A coder and a tester for the shop, leaving a pull request.',
      ' Quick · 1 agent',
      '-Second opinion · 2 agents · `summary` is in no stage',
    ])
  })

  it("shows the chosen flow's team under it, the orchestrator first", async () => {
    const body = drawn(await flowing())
    const members = body.match(/<ul class="team[^"]*" aria-label="Team">([^]*?)<\/ul>/)?.[1] ?? ''
    expect([...members.matchAll(/<li class="member[^"]*">([^<]*)<\/li>/g)].map(([, member]) => member)).toEqual([
      'orchestrator · claude',
      'coder · codex',
      'tester · claude',
    ])
  })

  it('says why the flows could not be read, with Try again', async () => {
    const body = drawn(await flowing({ issueFlows: refusing('no project 2') }))
    expect(body).toMatch(/<p class="label[^"]*">Flow<\/p>/)
    expect(body).toMatch(/<p class="state reason[^"]*">no project 2<\/p> (?:<!--\[0-->)?<button class="button plain[^"]*"[^>]*>[^]*?Try again/)
  })

  it('folds the prompt cornercase will use', async () => {
    expect(drawn(await flowing())).toMatch(/<summary class="summary[^"]*">Prompt cornercase will use<\/summary>/)
  })

  it('tells a missing place and a missing flow under each', async () => {
    const opening = await flowing()
    opening.form.place = null
    opening.flows.flow = null
    await opening.flows.start()
    const body = drawn(opening)
    expect(['Where', 'Flow'].map((field) => errorOf(body, field))).toEqual(['Choose where to start', 'Choose a flow'])
  })

  it('turns the button into a spinner with Starting… and holds the fields while it sends', async () => {
    const opening = await flowing({ startFlow: never })
    void opening.flows.start()
    const body = drawn(opening)
    expect(submit(body)?.[1]).toContain('aria-busy="true"')
    expect(label(submit(body))).toBe('Starting…')
    expect(body.match(/<(?:input|select)[^>]*disabled=""/g)).toHaveLength(3)
    expect(body.match(/<button[^>]*aria-pressed="\w+" disabled=""/g)).toHaveLength(2)
  })

  it('shows what cornercase refused over the button and keeps the branch typed', async () => {
    const opening = await flowing({ startFlow: refusing('workspace 17 already runs a flow, and a workspace runs one at a time') })
    opening.form.branch = 'coupon-fix'
    await opening.flows.start()
    const body = drawn(opening)
    expect(body).toMatch(
      /<p class="problem[^"]*" role="alert">workspace 17 already runs a flow, and a workspace runs one at a time<\/p>(?:<!--[^>]*-->)* <div class="buttons/,
    )
    expect(body).toContain('value="coupon-fix"')
    expect(label(submit(body))).toBe('Start')
  })

  it("sends the chosen flow on the issue's branch and hands over its orchestrator", async () => {
    const startFlow = vi.fn(() => answer({ started: ORCHESTRATOR, agent: 'claude' }))
    const startIssue = vi.fn(never)
    const { flows, onstarted } = await flowing({ startFlow, startIssue })
    await flows.start()
    const branch = READ.issue.branch
    expect(startFlow.mock.calls).toEqual([
      [{ project: 2, name: 'Ship it', key: '#41', source: 'github', branch, issue_branch: branch, accounts: [] }],
    ])
    expect(startIssue).not.toHaveBeenCalled()
    expect(onstarted.mock.calls).toEqual([[ORCHESTRATOR, 'claude']])
  })

  it('goes back on Agent to the agent and its model, where it was', async () => {
    const opening = await looked()
    opening.form.place = 'workspace-9'
    await opening.flows.use('flow')
    await opening.flows.use('agent')
    const body = drawn(opening)
    expect(labels(body)).toEqual(['Where', 'Agent', 'Model'])
    expect(optionsOf(body)).toContain('*workspace-9 api › Login · new tab')
  })

  it("offers an account for each of the team's agents with accounts under the team, as the Agent way chose it", async () => {
    const own = { name: '', label: 'This Mac', login: 'signed-in' as const }
    const accounts = [
      { agent: 'claude', default: '', options: [own, { name: 'lab', label: 'Lab', login: 'signed-in' as const }] },
      { agent: 'codex', default: 'ops', options: [own, { name: 'ops', label: 'Ops', login: 'unknown' as const }] },
    ]
    const opening = await flowing({ installedAgents: () => answer({ ...installed('claude', 'codex'), accounts }) })
    opening.form.accounts.choose('claude', 'lab')
    const body = drawn(opening)
    expect(labels(body)).toEqual(['Where', 'Branch', 'Flow', 'codex account', 'claude account'])
    expect(body.indexOf('aria-label="Team"')).toBeLessThan(body.indexOf('>codex account</label>'))
    expect(optionsOf(body).slice(-4)).toEqual(['  This Mac', '*ops Ops', '  This Mac', '*lab Lab'])
    opening.flows.flow = 'Quick'
    expect(labels(drawn(opening))).toEqual(['Where', 'Branch', 'Flow', 'claude account'])
  })
})

describe('Switch', () => {
  const toggle = (props: { label: string; checked?: boolean; disabled?: boolean }) => render(Switch, { props }).body

  it('labels a checkbox that reads as a switch, off unless checked', () => {
    const off = toggle({ label: 'Own worktree' })
    expect(off).toMatch(/<label class="switch svelte-[\w-]+"><span class="words svelte-[\w-]+">Own worktree<\/span> /)
    expect(off).toMatch(/<input class="toggle svelte-[\w-]+" type="checkbox" role="switch"\/><\/label>/)
    const on = toggle({ label: 'Own worktree', checked: true, disabled: true })
    expect(on).toContain('role="switch" checked="" disabled=""/>')
  })

  it.each([
    'min-height: 44px;',
    'width: 51px; height: 31px;',
    '-webkit-appearance: none; appearance: none;',
    '.toggle:checked { background: var(--brand); }',
    '.toggle:checked::after { transform: translateX(20px); }',
    '.toggle:disabled { opacity: 0.6; }',
  ])('holds %s', (text) => {
    expect(flat(switchSource)).toContain(text)
  })
})

describe('Segmented', () => {
  it('presses the chosen option of a labelled group and turns every option off while disabled', () => {
    const options: ['agent' | 'flow', string][] = [
      ['agent', 'Agent'],
      ['flow', 'Flow'],
    ]
    const body = render(Segmented, { props: { label: 'Who works', options, value: 'flow', disabled: true } }).body
    expect(body).toMatch(/<div class="actions[^"]*" role="group" aria-label="Who works">/)
    const buttons = [...body.matchAll(/<button[^>]*aria-pressed="(\w+)"([^>]*)>(\w+)<\/button>/g)]
    expect(buttons.map(([, pressed, rest, words]) => [words, pressed, rest.includes('disabled=""')])).toEqual([
      ['Agent', 'false', true],
      ['Flow', 'true', true],
    ])
  })
})

describe('Picker', () => {
  it('offers no Try again when nothing can be read again', () => {
    const props = { label: 'Where', choices: { kind: 'failed' as const, reason: 'gone' }, value: null, error: null }
    const body = render(Picker, { props: { ...props, of: () => ({ value: null, name: '' }), empty: 'None' } }).body
    expect(body).toContain('gone')
    expect(body).not.toContain('Try again')
  })
})

describe('Start wiring', () => {
  it('reads the choices on opening and again when the connection comes back', () => {
    const script = flat(startSource)
    expect(script).toContain('onMount(() => { void form.load() })')
    expect(script).toContain("const sendable = $derived(connection.state === 'connected')")
    expect(script).toContain('$effect(() => { const connected = sendable untrack(() => void form.see(connected)) })')
  })

  it('hands over what started, goes back on Back and switches between the agent form and the issues', () => {
    const script = flat(startSource)
    expect(script).toContain('form = new StartForm(commands, (started, agent) => onstarted(started, agent)),')
    expect(script).toContain('<NavBar {backTo} title="Start" {onback} topmost measure="form" />')
    expect(script).toContain('options={ACTIONS} bind:value={action} disabled={form.sending}')
    expect(flat(segmentedSource)).toContain('onclick={() => (value = name)}')
    expect(script).toContain("{:else if action === 'agent'} <AgentForm {form} {sendable} />")
    expect(script).toContain('{:else} <ShowIssues {sendable} onshow={onissues} />')
  })

  it('turns into the issue form when it opens on an issue', () => {
    const script = flat(startSource)
    expect(script).toContain(
      'untrack(() => { if (issue !== undefined) { form.forIssue(issue) } if (workspace !== undefined) { form.prefer(workspace) } })',
    )
    expect(script).toContain('{#if form.issue === null} <Segmented label="What to start"')
    expect(script).toContain('{#if form.issue !== null} <IssueForm {form} {sendable} />')
  })

  it('sends each form with its own action', () => {
    expect(flat(agentSource)).toContain('void form.start()')
    expect(flat(issueSource)).toContain('const send = () => void (inFlow ? flows.start() : form.startIssue())')
    expect(flat(issueSource)).toContain('<FormFrame problem={form.formError} onsubmit={send}>')
  })

  it("reads the flows of the place on opening and after each read of the projects, and again on a move in Flow", () => {
    const script = flat(issueSource)
    expect(script).toContain('flows = new FlowStart(form, commands),')
    expect(script).toContain('$effect(() => { void form.projects untrack(() => void flows.look()) })')
    expect(script).toContain('bind:value={() => flows.mode, (mode) => void flows.use(mode)}')
    expect(script).toContain('bind:value={() => form.place, (place) => void flows.moveTo(place)}')
  })

  it('reads again what failed on Try again', () => {
    expect(flat(pickerSource)).toContain('onretry={() => void form.loadAgents()}')
    expect(flat(workspacePickerSource)).toContain('onretry={() => void form.loadProjects()}')
    expect(flat(flowPickerSource)).toContain('onretry={() => void flows.retry()}')
  })
})
