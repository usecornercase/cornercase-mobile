import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import comments from '../../../crates/core/tests/fixtures/control/issue-read/v1/comments.json'
import type { ReadIssue_Serialize as ReadIssue } from '../../lib/bindings'
import { IssueState, type IssueReading } from '../../lib/issues.svelte'
import Issue from './Issue.svelte'
import issueSource from './Issue.svelte?raw'

const AT = Date.parse('2026-11-10T09:20:24Z')

const READ = comments as ReadIssue

const unanswered = () => new Promise<never>(() => {})

const holding = (reading: IssueReading) => {
  const state = new IssueState(3, { project: 7, source: 'github', key: '#41' }, { issueRead: unanswered })
  state.reading = reading
  return state
}

const reads = (change: Partial<ReadIssue> = {}): IssueReading => ({ kind: 'read', read: { ...READ, ...change } })

const drawn = (reading: IssueReading) =>
  render(Issue, {
    props: {
      issue: holding(reading),
      where: { project: 7, places: [] },
      backTo: 'Issues',
      onback: () => {},
      onstart: () => {},
      now: AT,
    },
  }).body

const all = (body: string, kind: string) =>
  [...body.matchAll(new RegExp(`<(?:p|span|h2|h3) class="${kind} svelte-[\\w-]+">([^<]*)<`, 'g'))].map(
    (found) => found[1],
  )

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('Issue', () => {
  it('heads the screen with the key in the shared bar, going back to the issues', () => {
    const body = drawn({ kind: 'reading' })
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column"[^]*?aria-label="Back to Issues"/)
    expect(body).toMatch(/<h1 class="title svelte-[\w-]+">#41<\/h1>/)
  })

  it('spins while cornercase reads the issue, with no way to start yet', () => {
    const body = drawn({ kind: 'reading' })
    expect(body).toMatch(/<p class="note svelte-[\w-]+"><span class="spinner[^]*?Reading the issue…<\/p>/)
    expect(body).not.toContain('>Start<')
  })

  it('says why it could not be read and offers to read it again', () => {
    const body = drawn({ kind: 'failed', reason: 'cornercase did not answer.' })
    expect(all(body, 'note reason')).toEqual(['cornercase did not answer.'])
    expect(body).toContain('Try again')
    expect(body).not.toContain('>Start<')
    expect(flat(issueSource)).toContain('<Button tone="plain" onclick={() => void issue.retry()}>Try again</Button>')
  })

  it('heads the issue with its state, key, author, age, title, labels and branch', () => {
    const body = drawn(reads())
    expect(all(body, 'state')).toEqual(['open'])
    expect(all(body, 'key')).toEqual(['#41'])
    expect(all(body, 'by')).toEqual(['grace · 1 d', 'ada · 1 d', 'grace · 1 d'])
    expect(all(body, 'name')).toEqual(['Checkout forgets the coupon after a refresh'])
    expect(all(body, 'tag')).toEqual(['bug', 'checkout'])
    expect(all(body, 'branch')).toEqual(['issue-41-checkout-forgets-the-coupon'])
  })

  it('greys a closed issue and leaves out the labels, branch and age it does not have', () => {
    const issue = { ...READ.issue, state: 'closed', closed: true, labels: [], branch: '', updated_at: 'soon' }
    const body = drawn(reads({ issue, comments: [] }))
    expect(body).toMatch(/<span class="state svelte-[\w-]+ closed">closed<\/span>/)
    expect(all(body, 'by')).toEqual(['grace'])
    expect(body).not.toContain('class="tag')
    expect(body).not.toContain('class="branch')
    expect(body).not.toContain('Comments')
  })

  it('draws the body and every comment as Markdown, oldest first', () => {
    const body = drawn(reads())
    expect(body.match(/<div class="markdown svelte-[\w-]+">/g)).toHaveLength(3)
    expect(body).toContain('<code')
    expect(body.indexOf('It happens on Safari too.')).toBeLessThan(body.indexOf('The coupon lives only in memory'))
    expect(all(body, 'comments')).toEqual(['Comments'])
  })

  it('says the issue has no description when its body is empty', () => {
    expect(all(drawn(reads({ body: ' \n' })), 'note')).toEqual(['No description'])
  })

  it("starts where it may with the issue under its row's tracker and key and the prompt cornercase will use", () => {
    expect(drawn(reads())).toMatch(/<button class="button primary svelte-[\w-]+"[^>]*>[^]*?Start[^]*?<\/button>/)
    expect(flat(issueSource)).toContain('const chosen = { ...read.issue, source: issue.source, key: issue.key }')
    expect(flat(issueSource)).toContain('onstart({ ...where, issue: chosen, prompt: read.prompt })')
    expect(flat(issueSource)).toContain('<Button onclick={start}>Start</Button>')
  })
})
