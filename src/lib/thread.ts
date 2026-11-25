import type { AgentRow_Serialize as AgentRow, HistoryEntry_Serialize as Entry, SendState } from './bindings'
import { elapsed, span } from './board'
import type { Outgoing, Reading } from './chat.svelte'
import { lastAgent, type AgentEntry } from './history'

export const STALL_MS = 120_000

export type LineTone = 'working' | 'waiting' | 'failed' | 'muted'

export type AgentLine = { tone: LineTone; phrase: string; time: string; stalled: boolean }

type Said = { tone: LineTone; doing: string; timed: boolean }

const SAID: Record<string, Said> = {
  working: { tone: 'working', doing: 'is working…', timed: true },
  shell: { tone: 'working', doing: 'is waiting for a background command…', timed: true },
  waiting: { tone: 'waiting', doing: 'is waiting for your answer', timed: false },
  failed: { tone: 'failed', doing: 'stopped with an error', timed: false },
}

const stalledLine = (row: AgentRow, quiet: number): AgentLine => ({
  tone: 'muted',
  phrase: `${row.agent} ${SAID.working.doing} · no news`,
  time: `for ${span(quiet)} · Ctrl-C interrupts`,
  stalled: true,
})

export const agentLine = (row: AgentRow, now: number, lastNews: number): AgentLine | null => {
  const said = SAID[row.status ?? '']
  if (said === undefined) {
    return null
  }
  if (row.status === 'working' && now - lastNews >= STALL_MS) {
    return stalledLine(row, now - lastNews)
  }
  const time = said.timed ? elapsed(row.since, now) : ''
  return { tone: said.tone, phrase: `${row.agent} ${said.doing}`, time, stalled: false }
}

export const sendNews = (outgoing: Pick<Outgoing, 'state' | 'reason'> | null) => {
  if (outgoing === null) {
    return ''
  }
  if (outgoing.state === 'failed') {
    return outgoing.reason === null ? 'Not sent' : `Not sent: ${outgoing.reason}`
  }
  return outgoing.state === 'sending' ? 'Sending' : 'Sent'
}

export type Bubble = { entry: Entry; live: boolean; going: boolean }

export const AT_END_MARGIN = 48

export const threadOf = (conversation: Entry[], live: boolean): Bubble[] => {
  const agent = lastAgent(conversation)
  const you = conversation.findLast((entry) => entry.kind === 'you')
  return conversation.map((entry) => ({
    entry,
    live: live && entry === you,
    going: entry === agent && agent.turn_over === false,
  }))
}

export const readingNote = (reading: Reading) => {
  if (reading.kind === 'message') {
    return null
  }
  return reading.kind === 'loading' ? 'Reading its last message…' : reading.reason
}

export const shownState = (state: SendState, live: boolean) => (state === 'sending' && !live ? 'unconfirmed' : state)

export const atEnd = (scrollY: number, viewport: number, height: number, margin = AT_END_MARGIN) =>
  scrollY + viewport >= height - margin

export type Landing = 'end' | 'start' | 'stay'

export type Change = { opened: boolean; sent: boolean; pinned: boolean; fresh: boolean }

export const sentAnew = (before: Outgoing | null, after: Outgoing | null) =>
  after !== null && after !== before && after.state === 'sending'

export const lastAnswer = (conversation: Entry[]): AgentEntry | null => {
  const last = conversation.at(-1)
  return last?.kind === 'agent' ? last : null
}

export const landingAfter = ({ opened, sent, pinned, fresh }: Change): Landing => {
  if (opened || sent) {
    return 'end'
  }
  if (!pinned) {
    return 'stay'
  }
  return fresh ? 'start' : 'end'
}

export const startTop = (scrollTop: number, end: number, start: number) => Math.min(end, Math.max(scrollTop, start))

export const compactHeader = (scrollY: number, headerHeight: number) => headerHeight > 0 && scrollY > headerHeight
