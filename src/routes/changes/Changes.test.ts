import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import fixture from '../../../crates/core/tests/fixtures/control/changes/v1/summary.json'
import type { ChangedFile_Serialize as ChangedFile, Mode, Summary_Serialize as Summary } from '../../lib/bindings'
import { ChangesState, CLOSED } from '../../lib/changes.svelte'
import Changes from './Changes.svelte'
import changesSource from './Changes.svelte?raw'
import FileRow from './FileRow.svelte'
import rowSource from './FileRow.svelte?raw'
import viewedSource from './Viewed.svelte?raw'

const WORKSPACE = 2

const never = () => new Promise<never>(() => {})

const FIXTURE = {
  ...fixture,
  workspaces: fixture.workspaces.map((listed) => ({
    ...listed,
    files: listed.files.map((file) => ({ ...file, staged: null })),
  })),
} as Summary

const stateWith = (summary: Summary | null, mode: Mode = 'commits') => {
  const state = new ChangesState(1, WORKSPACE, { follow: never, unfollow: never, read: never, mark: never }, () => {})
  state.mode = mode
  state.summary = summary
  return state
}

const ready = (files: ChangedFile[], base: string | null = 'main', more: Partial<Summary> = {}): Summary => ({
  ...FIXTURE,
  ...more,
  workspaces: [{ project: 1, workspace: WORKSPACE, base, added: 0, removed: 0, files }],
})

const FILE: ChangedFile = {
  path: 'src/app.rs',
  old_path: null,
  status: 'modified',
  added: 7,
  removed: 2,
  fold: 'open',
  viewed: false,
  staged: null,
  digest: 'd1',
}

const draw = (changes: ChangesState, title = 'login') =>
  render(Changes, { props: { title, changes, backTo: 'tests', onback: () => {}, onopen: () => {} } }).body

const row = (file: ChangedFile) => render(FileRow, { props: { file, onopen: () => {}, onviewed: () => {} } }).body

const flat = (text: string) => text.replace(/\s+/g, ' ')

const note = (body: string) => body.match(/<p class="note svelte-[\w-]+">(.*?)<\/p>/)?.[1] ?? null

const paths = (body: string) => [...body.matchAll(/<span dir="ltr">([^<]*)<\/span>/g)].map((m) => m[1])

const pressed = (body: string) =>
  [...body.matchAll(/<button class="mode svelte-[\w-]+" type="button" aria-pressed="true"[^>]*>\s*(\w+)/g)].map((m) => m[1])

describe('Changes', () => {
  it("goes back to the agent from a bar with the workspace's name and its totals at the right", () => {
    const body = draw(stateWith(FIXTURE))
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column"[^]*?aria-label="Back to tests"/)
    expect(body).toMatch(/<div class="center svelte-[\w-]+">(<!--[^>]*-->)*<h1 class="title svelte-[\w-]+">login<\/h1>/)
    expect(body).toMatch(
      /<div class="end svelte-[\w-]+">(<!--[^>]*-->)*<p class="totals svelte-[\w-]+"><span class="plus svelte-[\w-]+">\+12<\/span> <span class="minus svelte-[\w-]+">−9<\/span>/,
    )
    expect(body).not.toContain('class="top')
  })

  it('draws a row per file of the summary, a rename as its old and new paths', () => {
    expect(paths(draw(stateWith(FIXTURE)))).toEqual(['Cargo.lock', 'src/old.rs → src/new.rs', 'notes.txt'])
  })

  it('offers the three modes and marks the one it follows', () => {
    const body = draw(stateWith(FIXTURE))
    expect(body).toMatch(/Uncommitted[^]*Commits[^]*All/)
    expect(pressed(body)).toEqual(['Commits'])
    expect(pressed(draw(stateWith(null, 'uncommitted')))).toEqual(['Uncommitted'])
  })

  it('spins while the first summary is on its way', () => {
    const body = draw(stateWith(null))
    expect(body).toMatch(/<p class="note svelte-[\w-]+"><span class="spinner[^]*?Reading the changes…<\/p>/)
    expect(body).not.toContain('class="plus')
  })

  it('keeps spinning on a loading summary with no files', () => {
    expect(draw(stateWith(ready([], 'main', { state: 'loading' })))).toContain('Reading the changes…')
  })

  it.each([
    ['uncommitted', 'main', 'No uncommitted changes'],
    ['commits', 'main', 'No commits ahead of main'],
    ['all', 'main', 'Nothing changed since main'],
    ['commits', null, 'No changes'],
    ['all', null, 'No changes'],
  ] as const)('says when %s against %s has nothing: %s', (mode, base, said) => {
    const body = draw(stateWith(ready([], base, { mode }), mode))
    expect(note(body)).toBe(said)
    expect(body).not.toContain('<ul')
  })

  it("says so for a workspace the summary leaves out, with no totals", () => {
    const body = draw(stateWith({ ...FIXTURE, mode: 'uncommitted', workspaces: [] }, 'uncommitted'))
    expect(note(body)).toBe('No uncommitted changes')
    expect(body).not.toContain('class="plus')
  })

  it("shows cornercase's error when git fails", () => {
    const body = draw(stateWith(ready([FILE], 'main', { state: 'failed', error: 'not a git repository' })))
    expect(note(body)).toBe('not a git repository')
    expect(body).not.toContain('<ul')
  })

  it('says it could not read them when a failure carries no error', () => {
    expect(note(draw(stateWith(ready([], 'main', { state: 'failed', error: null }))))).toBe(
      'Could not read the changes.',
    )
  })

  it('leaves only the notice and the way back once the workspace is closed on the machine', () => {
    const state = stateWith(FIXTURE)
    state.gone = true
    const body = draw(state)
    expect(note(body)).toBe(`${CLOSED}.`)
    expect(body).not.toContain('class="mode')
    expect(body).not.toContain('<ul')
    expect(body).toContain('aria-label="Back to tests"')
  })

  it('changes the mode through the state, opens a file and marks it viewed through it', () => {
    const source = flat(changesSource)
    expect(source).toContain('onclick={() => void changes.show(mode)}')
    expect(source).toContain('const viewed = (path: string, seen: boolean) => void changes.mark(path, seen)')
    expect(source).toContain('<FileRow {file} {onopen} onviewed={viewed} />')
    expect(source).toContain('{#each files as file (file.path)}')
  })

  it('keeps the totals on one line and goes back through the bar', () => {
    const source = flat(changesSource)
    expect(source).toContain('<NavBar {backTo} {title} {onback} topmost measure="column"> {#snippet right()}')
    expect(source).toContain('.totals { margin: 0; padding-right: var(--inset); font-variant-numeric: tabular-nums; white-space: nowrap; }')
  })
})

describe('FileRow', () => {
  it('shows the status letter, the path and what was added and removed', () => {
    const body = row(FILE)
    expect(body).toMatch(/<span class="letter modified svelte-[\w-]+">M<\/span>/)
    expect(body).toContain('<span dir="ltr">src/app.rs</span>')
    expect(body).toMatch(/<span class="plus svelte-[\w-]+">\+7<\/span>/)
    expect(body).toMatch(/<span class="minus svelte-[\w-]+">−2<\/span>/)
  })

  it('leaves out a side with nothing on it', () => {
    const body = row({ ...FILE, status: 'added', added: 3, removed: 0 })
    expect(body).toMatch(/<span class="letter added svelte-[\w-]+">A<\/span>/)
    expect(body).toContain('+3')
    expect(body).not.toContain('class="minus')
  })

  it.each([
    ['lockfile', 'lockfile'],
    ['binary', 'binary'],
    ['large', 'too large'],
  ] as const)('tags a %s file as %s', (fold, tag) => {
    expect(row({ ...FILE, fold })).toMatch(new RegExp(`<span class="tag svelte-[\\w-]+">${tag}</span>`))
  })

  it('tags an open file with nothing', () => {
    expect(row(FILE)).not.toContain('class="tag')
  })

  it('draws the viewed button empty, then ticked and pressed once viewed', () => {
    const unseen = row(FILE)
    expect(unseen).toMatch(/aria-label="Viewed" aria-pressed="false"/)
    expect(unseen).not.toContain('m9 12 2 2 4-4')
    const seen = row({ ...FILE, viewed: true })
    expect(seen).toMatch(/aria-label="Viewed" aria-pressed="true"/)
    expect(seen).toContain('m9 12 2 2 4-4')
    expect(seen).toMatch(/<div class="row svelte-[\w-]+ viewed">/)
  })

  it('opens the file on a tap of the row and flips its viewed mark on a tap of the button', () => {
    const source = flat(rowSource)
    expect(source).toContain(
      '<button class="open" type="button" onclick={() => onopen(file.path)} ontouchstart={() => {}}>',
    )
    expect(source).toContain('<Viewed viewed={file.viewed} onflip={() => onviewed(file.path, !file.viewed)} />')
  })

  it('gives the row and its viewed button the 44 px touch target', () => {
    expect(flat(rowSource)).toContain('min-height: 44px;')
    expect(flat(viewedSource)).toContain('width: 44px; height: 44px;')
    expect(flat(viewedSource)).toContain('onclick={onflip} ontouchstart={() => {}}')
  })

  it('cuts a long path at its start', () => {
    expect(flat(rowSource)).toContain('direction: rtl; text-align: left; text-overflow: ellipsis;')
  })
})
