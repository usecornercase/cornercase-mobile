import { SvelteMap } from 'svelte/reactivity'
import type {
  AgentClosing_Serialize as AgentClosing,
  AgentRow_Serialize as AgentRow,
  ErrorCode,
  PaneRef_Serialize as PaneRef,
  Toast,
  commands,
} from './bindings'
import { timers, type Clock } from './chat.svelte'
import { counted } from './machineForm'
import { messageOf } from './toasts'

export type CloseCalls = Pick<typeof commands, 'closeAgentCheck' | 'closeAgent'>

export type Closing =
  | { kind: 'checking' }
  | { kind: 'confirming'; plan: AgentClosing }
  | { kind: 'rechecking'; plan: AgentClosing }
  | { kind: 'closing'; panes: number[] }

export type Progress = 'checking' | 'closing' | null

export type Asker = 'board' | 'agent'

export type Confirmation = { title: string; lines: string[] }

export const UNANSWERED_WAIT_MS = 15_000

export const CLOSE_UNANSWERED =
  'cornercase did not answer, so the agent may still close: look at the board before trying again.'

export const CHECK_UNANSWERED = 'cornercase did not answer, so nothing was closed. Try again.'

export const NOTHING_DELETED = 'Nothing is deleted from disk: the worktree and the branch stay.'

export const FLOW_ENDS = 'Ends the flow run: its whole team closes'

type Entry = Closing & { boot: string; ticket: number }

type Refusal = { ok: false; code: ErrorCode | null; message: string }

type Answer = { ok: true; plan: AgentClosing } | Refusal

const asked = async (call: () => ReturnType<CloseCalls['closeAgent']>): Promise<Answer> => {
  try {
    const answer = await call()
    return answer.status === 'ok'
      ? { ok: true, plan: answer.data }
      : { ok: false, code: answer.error.code, message: answer.error.message }
  } catch (error) {
    return { ok: false, code: null, message: messageOf(error) }
  }
}

const panesOf = (refs: PaneRef[]) => refs.map((ref) => ref.pane)

const added = (now: number[], then: number[]) => now.some((id) => !then.includes(id))

export const grew = (now: AgentClosing, shown: AgentClosing) =>
  (now.run !== null && now.run !== shown.run) ||
  added(now.tabs, shown.tabs) ||
  added(panesOf(now.stops), panesOf(shown.stops))

const othersOf = (plan: AgentClosing) => panesOf(plan.stops).filter((pane) => pane !== plan.pane)

export const confirmationText = (plan: AgentClosing, label: string): Confirmation => {
  const others = othersOf(plan).length
  const flow = plan.run !== null
  const lines = [
    others > 0 ? `Also stops ${counted(others, flow ? 'agent' : 'subagent')}` : '',
    flow ? FLOW_ENDS : '',
    plan.keeps.length > 0 ? `Keeps ${counted(plan.keeps.length, 'agent')} running` : '',
    NOTHING_DELETED,
    plan.warning ?? '',
  ]
  return { title: `Close ${label}?`, lines: lines.filter((line) => line !== '') }
}

export class CloseAgent {
  #states = new SvelteMap<number, Entry>()
  #listed: readonly number[] = []
  #tickets = 0
  #askers = new SvelteMap<number, { ticket: number; by: Asker }>()
  #calls: CloseCalls
  #tell: (toast: Toast) => void
  #onclosed: (panes: number[]) => void
  #clock: Pick<Clock, 'after'>

  constructor(
    calls: CloseCalls,
    tell: (toast: Toast) => void,
    onclosed: (panes: number[]) => void,
    clock: Pick<Clock, 'after'> = timers,
  ) {
    this.#calls = calls
    this.#tell = tell
    this.#onclosed = onclosed
    this.#clock = clock
  }

  stateOf(pane: number): Closing | undefined {
    return this.#states.get(pane)
  }

  askedBy(pane: number): Asker | undefined {
    const asker = this.#askers.get(pane)
    return asker !== undefined && this.#holds(pane, asker.ticket) ? asker.by : undefined
  }

  confirmingFor(pane: number, by: Asker) {
    const state = this.askedBy(pane) === by ? this.stateOf(pane) : undefined
    return state?.kind === 'confirming' || state?.kind === 'rechecking' ? state : null
  }

  closing(pane: number) {
    return [...this.#states.values()].some((entry) => entry.kind === 'closing' && entry.panes.includes(pane))
  }

  progress(pane: number): Progress {
    if (this.closing(pane)) {
      return 'closing'
    }
    return this.#states.get(pane)?.kind === 'checking' ? 'checking' : null
  }

  offered(row: AgentRow) {
    return row.boot !== '' && !this.#states.has(row.pane) && !this.closing(row.pane)
  }

  async ask(row: AgentRow, by: Asker) {
    if (!this.offered(row)) {
      return
    }
    const { pane, boot } = row
    const ticket = ++this.#tickets
    this.#askers.set(pane, { ticket, by })
    this.#states.set(pane, { kind: 'checking', boot, ticket })
    const answer = await asked(() => this.#calls.closeAgentCheck(pane, boot))
    if (!this.#holds(pane, ticket)) {
      return
    }
    if (answer.ok) {
      this.#states.set(pane, { kind: 'confirming', plan: answer.plan, boot, ticket })
      return
    }
    this.#refused(pane, answer)
  }

  cancel(pane: number) {
    if (this.#states.get(pane)?.kind === 'confirming') {
      this.#states.delete(pane)
    }
  }

  async confirm(pane: number) {
    const entry = this.#states.get(pane)
    if (entry?.kind !== 'confirming') {
      return
    }
    const { boot, ticket, plan: shown } = entry
    this.#states.set(pane, { kind: 'rechecking', plan: shown, boot, ticket })
    const answer = await asked(() => this.#calls.closeAgentCheck(pane, boot))
    if (!this.#holds(pane, ticket)) {
      return
    }
    if (!answer.ok) {
      this.#refused(pane, answer)
      return
    }
    if (grew(answer.plan, shown)) {
      this.#states.set(pane, { kind: 'confirming', plan: answer.plan, boot, ticket })
      return
    }
    await this.#close(pane, boot, ticket, othersOf(answer.plan))
  }

  seen(rows: AgentRow[]) {
    this.#listed = rows.map((row) => row.pane)
    this.#settle()
  }

  async #close(pane: number, boot: string, ticket: number, others: number[]) {
    this.#states.set(pane, { kind: 'closing', panes: [pane, ...others], boot, ticket })
    const answer = await asked(() => this.#calls.closeAgent(pane, boot))
    if (!this.#holds(pane, ticket)) {
      return
    }
    if (answer.ok) {
      this.#settle()
    } else if (answer.code === 'unanswered') {
      this.#clock.after(UNANSWERED_WAIT_MS, () => this.#lost(pane, ticket))
    } else {
      this.#fail(pane, answer.message)
    }
  }

  #lost(pane: number, ticket: number) {
    if (this.#holds(pane, ticket)) {
      this.#fail(pane, CLOSE_UNANSWERED)
    }
  }

  #settle() {
    for (const [pane, entry] of this.#states) {
      const panes = entry.kind === 'closing' ? entry.panes : [pane]
      if (!panes.some((listed) => this.#listed.includes(listed))) {
        this.#states.delete(pane)
        this.#ended(entry)
      }
    }
  }

  #ended(entry: Entry) {
    if (entry.kind === 'closing') {
      this.#onclosed(entry.panes)
    }
  }

  #holds(pane: number, ticket: number) {
    return this.#states.get(pane)?.ticket === ticket
  }

  #refused(pane: number, answer: Refusal) {
    this.#fail(pane, answer.code === 'unanswered' ? CHECK_UNANSWERED : answer.message)
  }

  #fail(pane: number, message: string) {
    this.#states.delete(pane)
    this.#tell({ level: 'error', message })
  }
}
