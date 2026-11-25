import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type {
  IssueInfo_Serialize as IssueInfo,
  ListedInfo_Serialize as ListedInfo,
  SourceInfo_Serialize as SourceInfo,
} from '../../lib/bindings'
import { CAP, IssuesState, type Trackers } from '../../lib/issues.svelte'
import Connect from './Connect.svelte'
import connectSource from './Connect.svelte?raw'
import IssueRow from './IssueRow.svelte'
import rowSource from './IssueRow.svelte?raw'
import Issues from './Issues.svelte'
import issuesSource from './Issues.svelte?raw'

const NOW = Date.parse('2026-11-10T09:20:24Z')

const pending = () => new Promise<never>(() => {})

const ok = <T>(data: T) => Promise.resolve({ status: 'ok' as const, data })

const GITHUB: SourceInfo = {
  source: 'github',
  name: 'GitHub',
  repository: true,
  state: 'connected',
  missing: [],
  reason: null,
}

const SHORTCUT: SourceInfo = { ...GITHUB, source: 'shortcut', name: 'Shortcut', repository: false }

const LINEAR: SourceInfo = {
  ...SHORTCUT,
  source: 'linear',
  name: 'Linear',
  state: 'failing',
  reason: 'Linear rejected the token: it may have expired',
}

const JIRA: SourceInfo = { ...SHORTCUT, source: 'jira', name: 'Jira', state: 'missing', missing: ['site', 'token'] }

const COUPON: IssueInfo = {
  source: 'github',
  key: '#41',
  title: 'Checkout forgets the coupon after a refresh',
  url: 'https://github.com/acme/shop/issues/41',
  state: 'open',
  closed: false,
  labels: ['bug', 'checkout'],
  author: 'grace',
  updated_at: '2026-11-07T09:20:24Z',
  branch: 'issue-41-checkout-forgets-the-coupon',
}

const THEME: IssueInfo = {
  ...COUPON,
  key: '#38',
  title: 'Add a dark theme',
  url: 'https://github.com/acme/shop/issues/38',
  state: 'closed',
  closed: true,
  labels: [],
  author: 'linus',
  updated_at: '2026-11-10T07:05:00Z',
}

const REFUNDS: IssueInfo = {
  ...COUPON,
  source: 'shortcut',
  key: 'sc-7',
  title: 'Refunds by bank transfer',
  url: 'https://app.shortcut.com/acme/story/7',
  labels: ['payments'],
}

const counted = (source: string, count: number, error: string | null = null): ListedInfo => ({
  source,
  count,
  cached: false,
  error,
})

type Seen = {
  trackers?: Trackers
  issues?: IssueInfo[] | null
  listed?: ListedInfo[]
  more?: Partial<Pick<IssuesState, 'query' | 'filters' | 'loading' | 'error'>>
}

const stateOf = ({ trackers = { kind: 'ready', sources: [GITHUB] }, issues = [], listed, more = {} }: Seen) => {
  const state = new IssuesState(3, { startProjects: pending, issueSources: pending, issueList: pending })
  state.trackers = trackers
  const lists = { project: 7, issues: issues ?? [], sources: listed ?? [counted('github', issues?.length ?? 0)] }
  state.swept = issues === null ? null : [{ wanted: { project: 7, source: 'github', repository: true }, lists }]
  Object.assign(state, more)
  return state
}

const drawn = (issues: IssuesState) =>
  render(Issues, { props: { issues, backTo: 'Start', onback: () => {}, onopen: () => {}, now: NOW } }).body

const screenOf = (seen: Seen) => drawn(stateOf(seen))

const SHOP = 7
const NOTES = 8

const NOTED: IssueInfo = {
  ...COUPON,
  key: '#12',
  title: 'Notes lose their order',
  url: 'https://github.com/acme/notes/issues/12',
  updated_at: '2026-11-09T09:20:24Z',
}

const LISTED: Record<string, IssueInfo[]> = {
  [`github ${SHOP}`]: [COUPON],
  [`github ${NOTES}`]: [NOTED],
  [`shortcut ${SHOP}`]: [{ ...REFUNDS, updated_at: '2026-11-08T09:20:24Z' }],
}

const everyProject = async () => {
  const projects = [
    { id: SHOP, name: 'shop', workspaces: [] },
    { id: NOTES, name: 'notes', workspaces: [] },
  ]
  const state = new IssuesState(3, {
    startProjects: () => ok({ boot: null, projects }),
    issueSources: (project) => ok({ project, sources: [GITHUB, SHORTCUT], places: [] }),
    issueList: (project, { source }) => {
      const issues = LISTED[`${source} ${project}`] ?? []
      return ok({ project, issues, sources: [counted(source ?? '', issues.length)] })
    },
  })
  await state.refresh()
  return drawn(state)
}

const textsOf = (body: string, kind: string) =>
  [...body.matchAll(new RegExp(`<(?:p|span) class="${kind}[^"]*">([^<]*)<`, 'g'))].map((found) => found[1])

const pressedIn = (body: string, label: string) => {
  const group = body.match(new RegExp(`aria-label="${label}">([^]*?)</div>`))?.[1] ?? ''
  return [...group.matchAll(/aria-pressed="(true|false)"[^>]*>\s*([^<]*?)\s*</g)].map(
    (found) => `${found[2]} ${found[1]}`,
  )
}

const one = (source: string) => source.replace(/\s+/g, ' ')

describe('Issues', () => {
  it('heads the screen with Issues in the shared bar, going back to Start', () => {
    const body = screenOf({})
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column"[^]*?aria-label="Back to Start"/)
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">Issues<\/h1>/)
  })

  it('spins while it reads which trackers the projects have', () => {
    const body = screenOf({ trackers: { kind: 'loading' }, issues: null })
    expect(body).toMatch(/<p class="note svelte-[\w-]+"><span class="spinner[^]*?Reading the trackers…<\/p>/)
    expect(body).not.toContain('type="search"')
  })

  it('says why the trackers could not be read and offers to try again', () => {
    const body = screenOf({ trackers: { kind: 'failed', reason: 'cornercase did not answer.' }, issues: null })
    expect(textsOf(body, 'note reason svelte-')).toEqual(['cornercase did not answer.'])
    expect(body).toContain('Try again')
    expect(body).not.toContain('type="search"')
  })

  it('lists each issue, the newest first, with its state, key, title, author, age and labels', () => {
    const body = screenOf({ issues: [COUPON, THEME] })
    expect(textsOf(body, 'key svelte-')).toEqual(['#38', '#41'])
    expect(textsOf(body, 'title svelte-')).toEqual(['Add a dark theme', COUPON.title])
    expect(textsOf(body, 'by svelte-')).toEqual(['linus · 2 h', 'grace · 3 d'])
    expect(textsOf(body, 'tag svelte-')).toEqual(['bug', 'checkout'])
    expect(body).toMatch(/<span class="state svelte-[\w-]+">open<\/span>/)
    expect(body).toMatch(/<span class="state svelte-[\w-]+ closed">closed<\/span>/)
  })

  it("lists every project's issues, each row with its tracker and, for a repository's, its project", async () => {
    const body = await everyProject()
    expect(textsOf(body, 'key svelte-')).toEqual(['#12', 'sc-7', '#41'])
    expect(textsOf(body, 'where svelte-')).toEqual(['GitHub · notes', 'Shortcut', 'GitHub · shop'])
    expect(body).not.toContain('<select')
  })

  it('keeps only the issues whose key, title or labels hold every word typed, without asking again', () => {
    const body = screenOf({ issues: [COUPON, THEME, REFUNDS], more: { query: 'PAY transfer' } })
    expect(textsOf(body, 'key svelte-')).toEqual(['sc-7'])
    expect(body).toMatch(/<input class="query svelte-[\w-]+" type="search" aria-label="Search issues"/)
    expect(one(issuesSource)).toContain('bind:value={issues.query}')
  })

  it.each<[string, Seen, string]>([
    ['nothing is open', {}, 'No open issues'],
    ['closed ones are asked for too', { more: { filters: { closed: true, mine: false, source: null } } }, 'No issues'],
    ['the search matches nothing', { issues: [COUPON], more: { query: 'payments' } }, 'No issue matches the search'],
  ])('says so when %s', (_, seen, text) => {
    expect(textsOf(screenOf(seen), 'note svelte-')).toEqual([text])
  })

  it('spins until the first list arrives, then only in the bar while it asks again', () => {
    const first = screenOf({ issues: null, more: { loading: true } })
    expect(first).toMatch(/<span class="spinner[^]*?Reading the issues…/)
    const again = screenOf({ issues: [COUPON], more: { loading: true } })
    expect(again).not.toContain('Reading the issues…')
    expect(again).toMatch(/<span class="busy svelte-[\w-]+"><span class="spinner/)
  })

  it('presses the filters it lists with and offers a tracker only when more than one is connected', () => {
    const mine = { closed: true, mine: true, source: 'shortcut' }
    const body = screenOf({ trackers: { kind: 'ready', sources: [GITHUB, SHORTCUT, LINEAR] }, more: { filters: mine } })
    expect(pressedIn(body, 'State')).toEqual(['Open false', 'Closed too true'])
    expect(pressedIn(body, 'People')).toEqual(['All false', 'Mine true'])
    expect(pressedIn(body, 'Tracker')).toEqual(['All trackers false', 'GitHub false', 'Shortcut true'])
    expect(screenOf({})).not.toContain('aria-label="Tracker"')
    expect(one(issuesSource)).toContain('onclick={() => void issues.filter(segment.change)}')
  })

  it('keeps what was listed and adds a line for each tracker that failed, once', () => {
    const body = screenOf({
      trackers: { kind: 'ready', sources: [GITHUB, SHORTCUT, LINEAR] },
      issues: [COUPON],
      listed: [
        counted('github', 1),
        counted('shortcut', 0, 'Shortcut rejected the token'),
        counted('linear', 0, 'gone'),
      ],
    })
    expect(textsOf(body, 'note failing svelte-')).toEqual(['Shortcut: Shortcut rejected the token', 'Linear: gone'])
    expect(textsOf(body, 'key svelte-')).toEqual(['#41'])
  })

  it('shows why a tracker that is not listed is failing', () => {
    const body = screenOf({ trackers: { kind: 'ready', sources: [GITHUB, LINEAR] } })
    expect(textsOf(body, 'note failing svelte-')).toEqual([`Linear: ${LINEAR.reason}`])
  })

  it('asks to narrow the filters when a tracker gave as many issues as it can, without a number', () => {
    const body = screenOf({ issues: [COUPON], listed: [counted('github', CAP)] })
    expect(textsOf(body, 'note svelte-')).toEqual([
      'A tracker has more issues than these. Narrow the filters to see the rest.',
    ])
    expect(screenOf({ issues: [COUPON] })).not.toContain('Narrow the filters')
  })

  it('keeps the rows under a failed refresh and offers to try again', () => {
    const body = screenOf({ issues: [COUPON], more: { error: 'cornercase did not answer.' } })
    expect(textsOf(body, 'note reason svelte-')).toEqual(['cornercase did not answer.'])
    expect(textsOf(body, 'key svelte-')).toEqual(['#41'])
    expect(one(issuesSource)).toContain('const retry = () => void issues.retry()')
  })

  it('tells how to connect a tracker instead of the list when none is connected', () => {
    const body = screenOf({ trackers: { kind: 'ready', sources: [{ ...GITHUB, state: 'missing' }, JIRA] } })
    expect(body).toContain('No issue tracker is connected')
    expect(body).not.toContain('type="search"')
    expect(one(issuesSource)).toContain('<Connect sources={trackers.sources} onretry={() => void issues.load()} />')
  })
})

describe('Connect', () => {
  const connect = (sources: SourceInfo[]) => render(Connect, { props: { sources, onretry: () => {} } }).body

  it("says what each tracker misses, why it fails and where on the machine it is connected, with no token field", () => {
    const body = connect([{ ...GITHUB, state: 'missing', missing: ['repository'] }, LINEAR, JIRA])
    expect(textsOf(body, 'name svelte-')).toEqual(['GitHub', 'Linear', 'Jira'])
    expect(textsOf(body, 'why svelte-')).toEqual(['Missing: repository', LINEAR.reason, 'Missing: site, token'])
    expect(textsOf(body, 'why svelte-[\\w-]+ failing')).toEqual([LINEAR.reason])
    expect(textsOf(body, 'how svelte-')).toEqual([
      'On the machine, open a folder inside the git repository as the project.',
      "On the machine, connect it in cornercase's Settings › Issues.",
      "On the machine, connect it in cornercase's Settings › Issues.",
    ])
    expect(body).not.toContain('<input')
    expect(body).toContain('Check again')
  })

  it.each<[string, Partial<SourceInfo>, string[]]>([
    [
      'gh failing in the folder',
      { state: 'failing', reason: 'gh is not logged in' },
      ["On the machine, sign in to gh in the project's folder."],
    ],
    [
      'a GitLab project whose remote is elsewhere',
      { source: 'gitlab', name: 'GitLab', state: 'missing', missing: ['repository'] },
      ['On the machine, open a folder inside the git repository whose remote is on your GitLab server as the project.'],
    ],
    [
      'a GitLab folder with no token outside a repository',
      { source: 'gitlab', name: 'GitLab', state: 'missing', missing: ['token', 'repository'] },
      [
        'On the machine, open a folder inside the git repository whose remote is on your GitLab server as the project.',
        "On the machine, connect it in cornercase's Settings › Issues.",
      ],
    ],
  ])('tells how to fix %s', (_, change, how) => {
    expect(textsOf(connect([{ ...GITHUB, ...change }]), 'how svelte-')).toEqual(how)
  })

  it('points at the machine when no project has a tracker at all', () => {
    const how = textsOf(connect([]), 'how svelte-')
    expect(how).toEqual(["Connect one on the machine, in cornercase's Settings › Issues."])
    expect(one(connectSource)).toContain('<Button tone="plain" onclick={onretry}>Check again</Button>')
  })
})

describe('IssueRow', () => {
  it('leaves the age out when the tracker gave no date it can read, and opens the issue on a tap', () => {
    const issue = { ...COUPON, updated_at: '', project: SHOP, repository: true }
    const body = render(IssueRow, { props: { issue, where: 'GitHub · shop', now: NOW, onopen: () => {} } }).body
    expect(textsOf(body, 'by svelte-')).toEqual(['grace'])
    expect(textsOf(body, 'where svelte-')).toEqual(['GitHub · shop'])
    expect(one(rowSource)).toContain(
      '<button class="issue" type="button" onclick={() => onopen(issue)} ontouchstart={() => {}}>',
    )
  })
})
