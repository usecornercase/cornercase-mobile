import { describe, expect, it, vi } from 'vitest'
import type { AgentClosing_Serialize as AgentClosing, CommandError, PaneRef_Serialize as PaneRef } from './bindings'
import { fakeClock, gate, ok, refused, row } from './chatFakes'
import {
  CHECK_UNANSWERED,
  CLOSE_UNANSWERED,
  CloseAgent,
  FLOW_ENDS,
  NOTHING_DELETED,
  UNANSWERED_WAIT_MS,
  confirmationText,
  grew,
  type CloseCalls,
} from './closeAgent.svelte'

const PANE = 10
const CHILD = 12

const ref = (pane: number, agent: string | null = 'claude'): PaneRef => ({
  agent,
  pane,
  project: 9,
  tab: pane + 1,
  workspace: 8,
})

const plan = (more: Partial<AgentClosing> = {}): AgentClosing => ({
  pane: PANE,
  agent: 'claude',
  project: 9,
  workspace: 8,
  tabs: [11, 13],
  stops: [ref(PANE), ref(CHILD)],
  keeps: [],
  run: null,
  closed: false,
  warning: null,
  ...more,
})

const CHECKED = plan()
const CLOSED = plan({ closed: true })
const ROWS = [row(PANE, 'working'), row(CHILD, 'working'), row(30, 'idle')]
const OTHERS = [row(30, 'idle')]

type Reply = ReturnType<CloseCalls['closeAgent']>

const replying = (answer: AgentClosing | CommandError) =>
  Promise.resolve('code' in answer ? refused(answer.message, answer.code) : ok(answer))

const closer = (check: () => Reply = () => replying(CHECKED), close: () => Reply = () => replying(CLOSED)) => {
  const calls = { closeAgentCheck: vi.fn(check), closeAgent: vi.fn(close) }
  const tell = vi.fn()
  const onclosed = vi.fn()
  const time = fakeClock()
  const closing = new CloseAgent(calls, tell, onclosed, time.clock)
  closing.seen(ROWS)
  return { closing, calls, tell, onclosed, time }
}

const confirmed = async (made = closer()) => {
  await made.closing.ask(row(PANE, 'working'), 'board')
  await made.closing.confirm(PANE)
  return made
}

const rechecking = async () => {
  const again = gate<Awaited<Reply>>()
  const made = closer()
  await made.closing.ask(row(PANE, 'working'), 'board')
  made.calls.closeAgentCheck.mockImplementation(() => again.promise)
  return { again, made, confirmed: made.closing.confirm(PANE) }
}

const REFUSALS: [string, CommandError][] = [
  ['a restarted server', { code: 'stale_boot', message: 'the server restarted' }],
  ['the reason cornercase gave', { code: 'failed', message: 'pane 10 runs no agent cornercase reads' }],
  ['nothing sent', { code: 'not_sent', message: 'nothing was sent' }],
]

const failure = (message: string) => ({ level: 'error', message })

const LOST: CommandError = { code: 'unanswered', message: 'it may have been sent, but no answer came back' }

describe('confirmationText', () => {
  it('names the agent and says nothing leaves the disk when it stops alone', () => {
    expect(confirmationText(plan({ stops: [ref(PANE)] }), 'Fix the login')).toEqual({
      title: 'Close Fix the login?',
      lines: [NOTHING_DELETED],
    })
  })

  it.each<[string, PaneRef[], string]>([
    ['one subagent', [ref(PANE), ref(CHILD)], 'Also stops 1 subagent'],
    ['several', [ref(PANE), ref(CHILD), ref(14)], 'Also stops 2 subagents'],
  ])('counts %s without the agent itself', (_, stops, line) => {
    expect(confirmationText(plan({ stops }), 'codex').lines).toEqual([line, NOTHING_DELETED])
  })

  it('says the whole flow team closes and its run ends', () => {
    const member = plan({ pane: 22, run: 20, stops: [ref(21, null), ref(22), ref(23)] })
    expect(confirmationText(member, 'reviewer').lines).toEqual(['Also stops 2 agents', FLOW_ENDS, NOTHING_DELETED])
  })

  it('tells what keeps running, then the warning last', () => {
    const kept = plan({ stops: [ref(PANE)], keeps: [ref(17)], warning: 'the tab also holds a shell' })
    expect(confirmationText(kept, 'codex').lines).toEqual([
      'Keeps 1 agent running',
      NOTHING_DELETED,
      'the tab also holds a shell',
    ])
    expect(confirmationText(plan({ keeps: [ref(17), ref(18)] }), 'codex').lines).toContain('Keeps 2 agents running')
  })

  it('leaves out an empty warning', () => {
    expect(confirmationText(plan({ stops: [ref(PANE)], warning: '' }), 'codex').lines).toEqual([NOTHING_DELETED])
  })
})

describe('grew', () => {
  it.each<[string, Partial<AgentClosing>, Partial<AgentClosing>, boolean]>([
    ['the same plan', {}, {}, false],
    ['a new subagent', { stops: [ref(PANE), ref(CHILD), ref(14)] }, {}, true],
    ['a subagent fewer', { stops: [ref(PANE)] }, {}, false],
    ['a new tab', { tabs: [11, 13, 15] }, {}, true],
    ['a flow run', { run: 20 }, {}, true],
    ['another flow run', { run: 21 }, { run: 20 }, true],
    ['the run gone', {}, { run: 20 }, false],
  ])('sees %s', (_, now, shown, grown) => {
    expect(grew(plan(now), plan(shown))).toBe(grown)
  })
})

describe('CloseAgent', () => {
  describe('asking', () => {
    it('checks with the boot of the row while it shows checking, then confirms with the answer', async () => {
      const answer = gate<Awaited<Reply>>()
      const { closing, calls } = closer(() => answer.promise)
      const asked = closing.ask(row(PANE, 'working'), 'board')
      expect(closing.stateOf(PANE)).toEqual(expect.objectContaining({ kind: 'checking' }))
      answer.open(ok(CHECKED))
      await asked
      expect(calls.closeAgentCheck.mock.calls).toEqual([[PANE, 'b1']])
      expect(closing.stateOf(PANE)).toEqual(expect.objectContaining({ kind: 'confirming', plan: CHECKED }))
    })

    it('is not offered without a boot, and asks nothing then', async () => {
      const { closing, calls } = closer()
      const bootless = { ...row(PANE, 'working'), boot: '' }
      await closing.ask(bootless, 'board')
      expect([closing.offered(bootless), closing.offered(row(PANE, 'working'))]).toEqual([false, true])
      expect(calls.closeAgentCheck).not.toHaveBeenCalled()
    })

    it('is not offered twice while one is asked', async () => {
      const { closing, calls } = closer()
      await closing.ask(row(PANE, 'working'), 'board')
      await closing.ask(row(PANE, 'working'), 'board')
      expect(closing.offered(row(PANE, 'working'))).toBe(false)
      expect(calls.closeAgentCheck).toHaveBeenCalledTimes(1)
    })

    it.each(REFUSALS)('tells %s instead of confirming', async (_, error) => {
      const { closing, tell } = closer(() => replying(error))
      await closing.ask(row(PANE, 'working'), 'board')
      expect(closing.stateOf(PANE)).toBeUndefined()
      expect(tell.mock.calls).toEqual([[failure(error.message)]])
    })

    it('tells a rejected call by its message', async () => {
      const { closing, tell } = closer(() => Promise.reject(new Error('IPC is gone')))
      await closing.ask(row(PANE, 'working'), 'board')
      expect(tell.mock.calls).toEqual([[failure('IPC is gone')]])
    })

    it('says nothing was closed when the check gets no answer', async () => {
      const { closing, tell } = closer(() => replying(LOST))
      await closing.ask(row(PANE, 'working'), 'board')
      expect(closing.stateOf(PANE)).toBeUndefined()
      expect(tell.mock.calls).toEqual([[failure(CHECK_UNANSWERED)]])
    })

    it('forgets the confirmation when cancelled', async () => {
      const { closing, calls } = closer()
      await closing.ask(row(PANE, 'working'), 'board')
      closing.cancel(PANE)
      await closing.confirm(PANE)
      expect(closing.stateOf(PANE)).toBeUndefined()
      expect(calls.closeAgent).not.toHaveBeenCalled()
    })
  })

  describe('confirming', () => {
    it('checks again while it shows rechecking, then closes with the same boot', async () => {
      const { again, made, confirmed } = await rechecking()
      expect(made.closing.stateOf(PANE)).toEqual(expect.objectContaining({ kind: 'rechecking', plan: CHECKED }))
      again.open(ok(CHECKED))
      await confirmed
      expect(made.calls.closeAgentCheck).toHaveBeenCalledTimes(2)
      expect(made.calls.closeAgent.mock.calls).toEqual([[PANE, 'b1']])
    })

    it.each<[string, AgentClosing]>([
      ['a new subagent', plan({ stops: [ref(PANE), ref(CHILD), ref(14)] })],
      ['a flow run', plan({ run: 20 })],
    ])('asks again with the new answer when the check found %s', async (_, grown) => {
      const made = closer()
      await made.closing.ask(row(PANE, 'working'), 'board')
      made.calls.closeAgentCheck.mockImplementation(() => replying(grown))
      await made.closing.confirm(PANE)
      expect(made.closing.stateOf(PANE)).toEqual(expect.objectContaining({ kind: 'confirming', plan: grown }))
      expect(made.calls.closeAgent).not.toHaveBeenCalled()
    })

    it.each<[string, CommandError, string]>([
      ['why it failed', { code: 'failed', message: 'project 9 is closing' }, 'project 9 is closing'],
      ['that nothing was closed when no answer came', LOST, CHECK_UNANSWERED],
    ])('tells %s on the second check, and closes nothing', async (_, error, message) => {
      const made = closer()
      await made.closing.ask(row(PANE, 'working'), 'board')
      made.calls.closeAgentCheck.mockImplementation(() => replying(error))
      await made.closing.confirm(PANE)
      expect(made.closing.stateOf(PANE)).toBeUndefined()
      expect(made.tell.mock.calls).toEqual([[failure(message)]])
      expect(made.calls.closeAgent).not.toHaveBeenCalled()
    })

    it('does nothing for a pane it is not confirming', async () => {
      const { closing, calls } = closer()
      await closing.confirm(PANE)
      expect(calls.closeAgentCheck).not.toHaveBeenCalled()
    })
  })

  describe('closing', () => {
    it('marks the agent and the panes it stops, which take no other close', async () => {
      const { closing } = await confirmed()
      expect(closing.stateOf(PANE)).toEqual(expect.objectContaining({ kind: 'closing', panes: [PANE, CHILD] }))
      expect([PANE, CHILD, 30].map((pane) => closing.closing(pane))).toEqual([true, true, false])
      expect(closing.offered(row(CHILD, 'working'))).toBe(false)
    })

    it('tells the progress of each pane: checking while asked, none while confirming, closing for what it stops', async () => {
      const answer = gate<Awaited<Reply>>()
      const asking = closer(() => answer.promise).closing
      const asked = asking.ask(row(PANE, 'working'), 'board')
      expect([PANE, CHILD].map((pane) => asking.progress(pane))).toEqual(['checking', null])
      answer.open(ok(CHECKED))
      await asked
      expect(asking.progress(PANE)).toBeNull()
      const { closing } = await confirmed()
      expect([PANE, CHILD, 30].map((pane) => closing.progress(pane))).toEqual(['closing', 'closing', null])
    })

    it('ends once none of its rows is on the board', async () => {
      const { closing, onclosed, tell } = await confirmed()
      closing.seen([row(CHILD, 'working'), ...OTHERS])
      expect(closing.closing(PANE)).toBe(true)
      closing.seen(OTHERS)
      expect(closing.stateOf(PANE)).toBeUndefined()
      expect(onclosed.mock.calls).toEqual([[[PANE, CHILD]]])
      expect(tell).not.toHaveBeenCalled()
    })

    it('stays while the rows stay after the command finished', async () => {
      const { closing, onclosed } = await confirmed()
      closing.seen(ROWS)
      expect(closing.closing(PANE)).toBe(true)
      expect(onclosed).not.toHaveBeenCalled()
    })

    it('ends when the command finishes after the rows went', async () => {
      const made = closer()
      made.closing.seen(OTHERS)
      await made.closing.ask(row(PANE, 'working'), 'board')
      await made.closing.confirm(PANE)
      expect(made.closing.stateOf(PANE)).toBeUndefined()
      expect(made.onclosed.mock.calls).toEqual([[[PANE, CHILD]]])
    })

    it('ends when the rows go before the command answers, and ignores its answer', async () => {
      const answer = gate<Awaited<Reply>>()
      const made = closer(undefined, () => answer.promise)
      const closed = confirmed(made)
      await vi.waitFor(() => expect(made.calls.closeAgent).toHaveBeenCalled())
      made.closing.seen(OTHERS)
      answer.open(refused('it failed late'))
      await closed
      expect(made.onclosed).toHaveBeenCalledTimes(1)
      expect(made.tell).not.toHaveBeenCalled()
    })

    it.each(REFUSALS)('stops closing and tells %s', async (_, error) => {
      const { closing, tell, onclosed } = await confirmed(closer(undefined, () => replying(error)))
      expect([closing.stateOf(PANE), closing.closing(CHILD)]).toEqual([undefined, false])
      expect(tell.mock.calls).toEqual([[failure(error.message)]])
      expect(onclosed).not.toHaveBeenCalled()
    })
  })

  describe('a row that leaves the board', () => {
    it('forgets a confirmation whose row left the board', async () => {
      const { closing, tell, onclosed } = closer()
      await closing.ask(row(PANE, 'working'), 'board')
      closing.seen(OTHERS)
      expect([closing.stateOf(PANE), closing.offered(row(PANE, 'working'))]).toEqual([undefined, true])
      expect([tell.mock.calls, onclosed.mock.calls]).toEqual([[], []])
    })

    it('ignores a check answered after its row left', async () => {
      const answer = gate<Awaited<Reply>>()
      const { closing, tell } = closer(() => answer.promise)
      const asked = closing.ask(row(PANE, 'working'), 'board')
      closing.seen(OTHERS)
      answer.open(refused('pane 10 runs no agent cornercase reads'))
      await asked
      expect([closing.stateOf(PANE), tell.mock.calls]).toEqual([undefined, []])
    })

    it('closes nothing when its row leaves during the second check', async () => {
      const { again, made, confirmed } = await rechecking()
      made.closing.seen(OTHERS)
      again.open(ok(CHECKED))
      await confirmed
      expect(made.closing.stateOf(PANE)).toBeUndefined()
      expect([made.calls.closeAgent.mock.calls, made.onclosed.mock.calls]).toEqual([[], []])
    })

    it('keeps what another row asks while one row leaves', async () => {
      const { closing } = closer()
      await closing.ask(row(30, 'idle'), 'board')
      closing.seen(OTHERS)
      expect(closing.stateOf(30)).toEqual(expect.objectContaining({ kind: 'confirming' }))
    })
  })

  describe('a lost answer', () => {
    it('keeps closing until the wait ends, then says the agent may still close', async () => {
      const { closing, tell, time } = await confirmed(closer(undefined, () => replying(LOST)))
      time.tick(UNANSWERED_WAIT_MS - 1)
      expect([closing.closing(PANE), tell.mock.calls]).toEqual([true, []])
      time.tick(1)
      expect(closing.stateOf(PANE)).toBeUndefined()
      expect(tell.mock.calls).toEqual([[failure(CLOSE_UNANSWERED)]])
    })

    it('ends quietly when the rows go before the wait ends', async () => {
      const { closing, tell, onclosed, time } = await confirmed(closer(undefined, () => replying(LOST)))
      closing.seen(OTHERS)
      time.tick(UNANSWERED_WAIT_MS)
      expect(onclosed.mock.calls).toEqual([[[PANE, CHILD]]])
      expect(tell).not.toHaveBeenCalled()
    })
  })
})

describe('CloseAgent, who asked', () => {
  it('remembers which screen asked, from the check to the confirmation', async () => {
    const { closing } = closer()
    const asking = closing.ask(row(PANE, 'working'), 'agent')
    const checking = closing.askedBy(PANE)
    await asking
    expect([checking, closing.askedBy(PANE)]).toEqual(['agent', 'agent'])
  })

  it('gives the confirmation only to the screen that asked for it', async () => {
    const { closing } = closer()
    await closing.ask(row(PANE, 'working'), 'board')
    expect([closing.confirmingFor(PANE, 'board')?.kind, closing.confirmingFor(PANE, 'agent')]).toEqual([
      'confirming',
      null,
    ])
  })

  it('keeps it for the screen that asked while it checks again', async () => {
    const { made } = await rechecking()
    expect(made.closing.confirmingFor(PANE, 'board')?.kind).toBe('rechecking')
  })

  it('gives no confirmation while it only checks', () => {
    const { closing } = closer(() => new Promise(() => {}))
    void closing.ask(row(PANE, 'working'), 'board')
    expect(closing.confirmingFor(PANE, 'board')).toBeNull()
  })

  it('forgets who asked once the confirmation is cancelled, so the next ask is the next screen\'s', async () => {
    const { closing } = closer()
    await closing.ask(row(PANE, 'working'), 'board')
    closing.cancel(PANE)
    const forgotten = closing.askedBy(PANE)
    await closing.ask(row(PANE, 'working'), 'agent')
    expect([forgotten, closing.confirmingFor(PANE, 'board'), closing.confirmingFor(PANE, 'agent')?.kind]).toEqual([
      undefined,
      null,
      'confirming',
    ])
  })

  it('leaves who asked alone when an ask is not offered', async () => {
    const { closing } = closer()
    await closing.ask(row(PANE, 'working'), 'board')
    await closing.ask(row(PANE, 'working'), 'agent')
    expect(closing.askedBy(PANE)).toBe('board')
  })
})
