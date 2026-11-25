import type { AgentClosing_Serialize as AgentClosing, AgentRow_Serialize as AgentRow } from './bindings'
import { fakeClock, ok } from './chatFakes'
import { CloseAgent, type Asker, type CloseCalls, type Closing } from './closeAgent.svelte'

const never = () => new Promise<never>(() => {})

const flushed = async () => {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
}

export const closerAt = async (
  kind: Closing['kind'] | 'idle',
  rows: AgentRow[],
  plan: AgentClosing,
  by: Asker = 'board',
) => {
  let checks = 0
  const calls: CloseCalls = {
    closeAgentCheck: () => {
      checks += 1
      return kind === 'checking' || (kind === 'rechecking' && checks > 1) ? never() : Promise.resolve(ok(plan))
    },
    closeAgent: never,
  }
  const closer = new CloseAgent(calls, () => {}, () => {}, fakeClock().clock)
  closer.seen(rows)
  if (kind !== 'idle') void closer.ask(rows[0], by)
  await flushed()
  if (kind === 'rechecking' || kind === 'closing') void closer.confirm(rows[0].pane)
  await flushed()
  return closer
}
