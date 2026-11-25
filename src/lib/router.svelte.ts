import type {
  AgentRow_Serialize as AgentRow,
  IssueInfo_Serialize as IssueInfo,
  PlaceInfo_Serialize as PlaceInfo,
} from './bindings'
import type { Screen } from './connection'

export type Route =
  | { name: 'no-machines' }
  | { name: 'home' }
  | { name: 'agent'; machine: number | null; pane: number; starting?: true }
  | { name: 'terminal'; machine: number; row: AgentRow }
  | { name: 'machines' }
  | { name: 'machine'; id: number; adding?: boolean }
  | { name: 'start'; machine: number; issue?: StartingIssue; workspace?: number }
  | { name: 'changes'; machine: number; workspace: number; title: string }
  | { name: 'change'; machine: number; workspace: number; path: string }
  | { name: 'files'; machine: number; workspace: number; title: string }
  | { name: 'file'; machine: number; workspace: number; path: string }
  | { name: 'issues'; machine: number }
  | { name: 'issue'; machine: number; project: number; repository: boolean; key: string; source: string }

export type Where = { project: number | null; places: PlaceInfo[]; workspace?: number }

export type StartingIssue = Where & { issue: IssueInfo; prompt: string }

type Base = Extract<Route, { name: 'no-machines' | 'home' }>

export const routeFor = (screen: Screen, known: number): Base =>
  screen.machine === null && known === 0 ? { name: 'no-machines' } : { name: 'home' }

export const openedTerminal = (route: Route, screen: Screen) =>
  route.name === 'terminal' && route.machine === screen.machine ? route : undefined

export type ChatOf = { machine: number | null; pane: number }

export const chatOf = (route: Route): ChatOf | null => {
  if (route.name === 'agent') {
    return { machine: route.machine, pane: route.pane }
  }
  return route.name === 'terminal' ? { machine: route.machine, pane: route.row.pane } : null
}

const overMachines = (route: Route) => route.name === 'machines' || route.name === 'machine'

type InWorkspace = Extract<Route, { name: 'changes' | 'change' | 'files' | 'file' }>

const inWorkspace = (route: Route): route is InWorkspace =>
  route.name === 'changes' || route.name === 'change' || route.name === 'files' || route.name === 'file'

const overChat = (route: Route) => overMachines(route) || inWorkspace(route)

export type WorkspaceOf = { machine: number; workspace: number }

type Named<N extends Route['name']> = Extract<Route, { name: N }>

const named =
  <N extends Route['name']>(name: N) =>
  (route: Route): route is Named<N> =>
    route.name === name

export class Router {
  #stack: Route[] = $state([])

  constructor(first: Base) {
    this.#stack = [first]
  }

  get base(): Base {
    return this.#stack[0] as Base
  }

  get current(): Route {
    return this.#stack[this.#stack.length - 1]
  }

  get below(): Route | null {
    return this.#stack.at(-2) ?? null
  }

  get opened(): ChatOf | null {
    const under = this.#stack.findLast((route) => !overChat(route))
    return under === undefined ? null : chatOf(under)
  }

  get reviewed(): WorkspaceOf | null {
    return this.#workspaceOf('changes', 'change')
  }

  get browsed(): WorkspaceOf | null {
    return this.#workspaceOf('files', 'file')
  }

  latest<N extends Route['name']>(name: N): Named<N> | null {
    return this.#stack.findLast(named(name)) ?? null
  }

  #workspaceOf(...names: InWorkspace['name'][]): WorkspaceOf | null {
    const above = this.#stack.slice(this.#stack.findLastIndex((route) => !inWorkspace(route)) + 1)
    const found = above.findLast((route): route is InWorkspace => inWorkspace(route) && names.includes(route.name))
    return found === undefined ? null : { machine: found.machine, workspace: found.workspace }
  }

  go(route: Route) {
    this.#stack = [...this.#stack, route]
  }

  settle(route: Route) {
    this.#stack = [this.#stack[0], route]
  }

  setBase(base: Base) {
    const [first, ...above] = this.#stack
    const emptied = base.name === 'no-machines'
    if (first.name === base.name && (!emptied || above.length === 0)) {
      return
    }
    this.#stack = emptied ? [base] : [base, ...above]
  }

  closed(machine: number, panes: number[]) {
    const shown = chatOf(this.current)
    if (shown !== null && shown.machine === machine && panes.includes(shown.pane)) {
      this.root()
    }
  }

  root() {
    this.#stack = [this.#stack[0]]
  }

  back() {
    if (this.#stack.length > 1) {
      this.#stack = this.#stack.slice(0, -1)
    }
  }
}
