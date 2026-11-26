import { describe, expect, it } from 'vitest'
import type { AgentRow_Serialize as AgentRow, HistoryEntry_Serialize as Entry } from './bindings'
import type { Outgoing, Reading } from './chat.svelte'
import {
  AT_END_MARGIN,
  STALL_MS,
  agentLine,
  atEnd,
  compactHeader,
  landingAfter,
  lastAnswer,
  readingNote,
  sendNews,
  sentAnew,
  shownState,
  startTop,
  threadOf,
  type Change,
  type Landing,
} from './thread'

const NOW = Date.parse('2026-11-09T21:30:00.000Z')

const MINUTE = 60_000

const agentIn = (status: string | null, since: string | null = null): AgentRow => ({
  boot: 'b7',
  project: 8,
  workspace: 9,
  tab: 10,
  pane: 11,
  project_name: 'terminal',
  workspace_name: 'thread',
  tab_name: 'line',
  workspace_count: 3,
  agent: 'claude',
  title: 'Fix the chat',
  status,
  since,
  parent: null,
  depth: 0,
  role: null,
  rank_status: status,
})

const ago = (millis: number) => new Date(NOW - millis).toISOString()

const lineOf = (status: string | null, since: string | null = null, lastNews = NOW) =>
  agentLine(agentIn(status, since), NOW, lastNews)

describe('agentLine', () => {
  it.each([
    ['working', 'working', 'claude is working…'],
    ['shell', 'working', 'claude is waiting for a background command…'],
    ['waiting', 'waiting', 'claude is waiting for your answer'],
    ['failed', 'failed', 'claude stopped with an error'],
  ])('says what a %s agent is doing, in its tone', (status, tone, phrase) => {
    expect(lineOf(status)).toEqual({ tone, phrase, time: '', stalled: false })
  })

  it.each(['done', 'pending', 'idle', 'something new', null])('draws no line for %o', (status) => {
    expect(lineOf(status)).toBeNull()
  })

  it.each([
    ['working', 'now'],
    ['shell', '7 min'],
  ])('gives a %s agent the time since its status changed, as the board does', (status, time) => {
    const since = status === 'working' ? ago(40_000) : ago(7 * MINUTE + 5_000)
    expect(lineOf(status, since)?.time).toBe(time)
  })

  it.each(['waiting', 'failed'])('gives a %s agent no time', (status) => {
    expect(lineOf(status, ago(5 * MINUTE))?.time).toBe('')
  })

  it('names the agent the row says', () => {
    const row = { ...agentIn('working'), agent: 'codex' }
    expect(agentLine(row, NOW, NOW)?.phrase).toBe('codex is working…')
  })
})

describe('agentLine, without news', () => {
  it('keeps the working line one millisecond before the threshold', () => {
    expect(lineOf('working', ago(30 * MINUTE), NOW - STALL_MS + 1)).toEqual({
      tone: 'working',
      phrase: 'claude is working…',
      time: '30 min',
      stalled: false,
    })
  })

  it('says there is no news, muted, once the threshold is reached', () => {
    expect(lineOf('working', ago(30 * MINUTE), NOW - STALL_MS)).toEqual({
      tone: 'muted',
      phrase: 'claude is working… · no news',
      time: 'for 2 min · Ctrl-C interrupts',
      stalled: true,
    })
  })

  it('counts the minutes since the last news, not since the status changed', () => {
    expect(lineOf('working', ago(30 * MINUTE), NOW - 9 * MINUTE - 59_000)?.time).toBe('for 9 min · Ctrl-C interrupts')
  })

  it('waits two minutes', () => {
    expect(STALL_MS).toBe(2 * MINUTE)
  })

  it.each(['shell', 'waiting', 'failed'])('never calls a %s agent stalled', (status) => {
    expect(lineOf(status, null, NOW - 10 * STALL_MS)?.stalled).toBe(false)
  })

  it('keeps the phrase while the time runs', () => {
    const since = ago(MINUTE)
    const phrases = [0, MINUTE, 5 * MINUTE].map((later) => agentLine(agentIn('working', since), NOW + later, NOW + later))
    expect(phrases.map((line) => line?.phrase)).toEqual(['claude is working…', 'claude is working…', 'claude is working…'])
    expect(phrases.map((line) => line?.time)).toEqual(['1 min', '2 min', '6 min'])
  })

  it('keeps the stalled phrase while the minutes without news grow', () => {
    const lines = [STALL_MS, 4 * MINUTE].map((quiet) => lineOf('working', null, NOW - quiet))
    expect(lines.map((line) => line?.phrase)).toEqual(['claude is working… · no news', 'claude is working… · no news'])
    expect(lines.map((line) => line?.time)).toEqual(['for 2 min · Ctrl-C interrupts', 'for 4 min · Ctrl-C interrupts'])
  })
})

const gap = (id: number): Entry => ({ kind: 'gap', id, seen: NOW })

const agent = (id: number, text: string, turn_over: boolean | null = true): Entry => ({
  kind: 'agent',
  id,
  text,
  written: null,
  turn_over,
  seen: NOW,
})

const you = (id: number, text: string): Entry => ({
  kind: 'you',
  id,
  text,
  chips: [],
  state: 'sent',
  reason: null,
  seen: NOW,
})

describe('sendNews', () => {
  it.each([
    ['sending', null, 'Sending'],
    ['sent', null, 'Sent'],
    ['failed', 'the agent is gone', 'Not sent: the agent is gone'],
    ['failed', null, 'Not sent'],
  ] as const)('says a message %s with reason %o as %o', (state, reason, news) => {
    expect(sendNews({ state, reason })).toBe(news)
  })

  it('says nothing before anything is sent', () => {
    expect(sendNews(null)).toBe('')
  })
})

describe('threadOf', () => {
  const conversation = [gap(0), agent(1, 'Which file?'), you(2, 'thread.ts'), agent(3, 'Fixed.'), you(4, 'and tests')]

  const lives = (bubbles: ReturnType<typeof threadOf>) => bubbles.map((bubble) => bubble.live)

  const goings = (bubbles: ReturnType<typeof threadOf>) => bubbles.map((bubble) => bubble.going)

  it('keeps every entry, in the order the phone saw them', () => {
    expect(threadOf(conversation, false).map((bubble) => bubble.entry)).toEqual(conversation)
  })

  it('draws nothing for an empty conversation', () => {
    expect(threadOf([], true)).toEqual([])
  })

  it('lets only your last message keep its actions while the chat sent it', () => {
    expect(lives(threadOf(conversation, true))).toEqual([false, false, false, false, true])
  })

  it('takes your last message for the live one even when the agent answered it', () => {
    expect(lives(threadOf(conversation.slice(0, 4), true))).toEqual([false, false, true, false])
  })

  it('leaves every message of yours without actions when the chat sent nothing', () => {
    expect(lives(threadOf(conversation, false))).toEqual([false, false, false, false, false])
  })

  it('marks only the last message of the agent as having more to come', () => {
    const working = [agent(0, 'Reading', false), you(1, 'go on'), agent(2, 'Writing', false)]
    expect(goings(threadOf(working, false))).toEqual([false, false, true])
  })

  it.each([true, null])('marks nothing to come when the last turn is %o', (turnOver) => {
    expect(goings(threadOf([agent(0, 'Reading', false), agent(1, 'Done.', turnOver)], false))).toEqual([false, false])
  })
})

describe('readingNote', () => {
  it.each<[string, Reading, string | null]>([
    ['reading', { kind: 'loading' }, 'Reading its last message…'],
    ['unreadable', { kind: 'unreadable', reason: 'no transcript' }, 'no transcript'],
    [
      'read',
      { kind: 'message', message: { pane: 11, agent: 'claude', text: 'Done.', written: null, turn_over: true } },
      null,
    ],
  ])('says %s messages as %o', (_, reading, note) => {
    expect(readingNote(reading)).toBe(note)
  })
})

describe('shownState', () => {
  it.each([
    ['sending', true, 'sending'],
    ['sending', false, 'unconfirmed'],
    ['sent', false, 'sent'],
    ['sent', true, 'sent'],
    ['failed', false, 'failed'],
    ['failed', true, 'failed'],
  ] as const)('shows a %s message, live %s, as %s', (state, live, shown) => {
    expect(shownState(state, live)).toBe(shown)
  })
})

describe('atEnd', () => {
  it('margins 48 px', () => {
    expect(AT_END_MARGIN).toBe(48)
  })

  it.each([
    [1952, true],
    [1951, false],
    [2000, true],
    [0, false],
  ])('at scroll %i of a 2,800 px page in an 800 px window is %s', (scrollY, end) => {
    expect(atEnd(scrollY, 800, 2800)).toBe(end)
  })

  it('takes a page shorter than the window as at the end', () => {
    expect(atEnd(0, 800, 500)).toBe(true)
  })

  it('takes another margin', () => {
    expect(atEnd(1990, 800, 2800, 10)).toBe(true)
    expect(atEnd(1989, 800, 2800, 10)).toBe(false)
  })
})

const sending = (state: Outgoing['state']): Outgoing => ({ text: 'go on', chips: [], state, reason: null })

describe('sentAnew', () => {
  it('takes a new send for one', () => {
    expect(sentAnew(null, sending('sending'))).toBe(true)
  })

  it('takes a Retry, a new send after a failed one, for one', () => {
    expect(sentAnew(sending('failed'), sending('sending'))).toBe(true)
  })

  it('takes the same send seen again for none', () => {
    const same = sending('sending')
    expect(sentAnew(same, same)).toBe(false)
  })

  it.each<[string, Outgoing | null, Outgoing | null]>([
    ['sending to sent', sending('sending'), sending('sent')],
    ['sending to failed', sending('sending'), sending('failed')],
    ['failed to nothing, an Edit', sending('failed'), null],
    ['nothing to nothing', null, null],
  ])('takes %s for no send', (_, before, after) => {
    expect(sentAnew(before, after)).toBe(false)
  })
})

describe('lastAnswer', () => {
  it("gives the agent's message when it is last", () => {
    const answer = agent(3, 'Fixed.')
    expect(lastAnswer([you(2, 'fix it'), answer])).toBe(answer)
  })

  it.each<[string, Entry[]]>([
    ['your bubble', [agent(1, 'Which file?'), you(2, 'thread.ts')]],
    ['a gap', [gap(0)]],
    ['nothing', []],
  ])('gives none when %s is last', (_, conversation) => {
    expect(lastAnswer(conversation)).toBeNull()
  })
})

describe('landingAfter', () => {
  const change = (fields: Partial<Change>): Change => ({ opened: false, sent: false, pinned: false, fresh: false, ...fields })

  it.each<[string, Partial<Change>, Landing]>([
    ['opening, even away from the end', { opened: true, fresh: true }, 'end'],
    ['a send, even away from the end', { sent: true }, 'end'],
    ['a send with a new answer at the end', { sent: true, pinned: true, fresh: true }, 'end'],
    ['a new answer away from the end', { fresh: true }, 'stay'],
    ['any other change away from the end', {}, 'stay'],
    ['a new answer at the end', { pinned: true, fresh: true }, 'start'],
    ['any other change at the end', { pinned: true }, 'end'],
  ])('lands after %s', (_, fields, landing) => {
    expect(landingAfter(change(fields))).toBe(landing)
  })
})

describe('startTop', () => {
  it("goes to a long message's start below", () => {
    expect(startTop(1000, 5000, 1600)).toBe(1600)
  })

  it('stops at the end when a short message starts past it', () => {
    expect(startTop(1000, 1200, 1600)).toBe(1200)
  })

  it('never goes back up to a start above', () => {
    expect(startTop(1000, 5000, 400)).toBe(1000)
  })
})

describe('compactHeader', () => {
  it.each([
    [0, false],
    [180, false],
    [181, true],
    [900, true],
  ])('at scroll %i past a header ending at 180 px is %s', (scrollY, compact) => {
    expect(compactHeader(scrollY, 180)).toBe(compact)
  })

  it('stays large while the header is not measured', () => {
    expect(compactHeader(400, 0)).toBe(false)
  })
})
