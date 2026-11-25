import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import listing from '../../../crates/core/tests/fixtures/control/files/v1/listing.json'
import type {
  Entry_Serialize as Entry,
  Folder_Serialize as Folder,
  Found_Serialize as Found,
} from '../../lib/bindings'
import { CLOSED } from '../../lib/changes.svelte'
import { FilesState, type Calls, type Results, type Row } from '../../lib/files.svelte'
import EntryRow from './EntryRow.svelte'
import rowSource from './EntryRow.svelte?raw'
import Files from './Files.svelte'
import filesSource from './Files.svelte?raw'
import SearchResults from './SearchResults.svelte'
import resultsSource from './SearchResults.svelte?raw'

const [ROOT_FOLDER, MISSING] = listing.folders as Folder[]

const never = () => new Promise<never>(() => {})

const answering =
  (folders: Record<string, Folder>): Calls['list'] =>
  (_, paths) =>
    Promise.resolve({ status: 'ok', data: { folders: paths.map((path) => folders[path] ?? MISSING) } })

const browsing = async (folders: Record<string, Folder> = { '': ROOT_FOLDER }, list = answering(folders)) => {
  const files = new FilesState(1, listing.workspace, { list, read: never, search: never, stopSearch: never }, () => {})
  await files.start()
  return files
}

const draw = (files: FilesState, title = 'login') =>
  render(Files, { props: { title, files, backTo: 'Fix the login', onback: () => {}, onopen: () => {} } }).body

const entryRow = (entry: Partial<Entry>, more: Partial<Extract<Row, { kind: 'entry' }>> = {}) =>
  render(EntryRow, {
    props: {
      row: { kind: 'entry', path: 'x', depth: 0, open: false, loading: false, ...more, entry: { ...ROOT_FOLDER.entries[2], ...entry } },
      ontoggle: () => {},
      onopen: () => {},
    },
  }).body

const FOUND: Found = {
  query: 'mai',
  mode: 'names',
  names: [
    { path: 'src/main.rs', indices: [4, 5, 6] },
    { path: 'docs/café.md', indices: [8] },
  ],
  files: [],
  matches: 2,
  capped: false,
}

const results = (more: Partial<Results> = {}, found: Partial<Found> = {}) =>
  render(SearchResults, {
    props: { results: { found: { ...FOUND, ...found }, loading: false, error: null, ...more }, onopen: () => {} },
  }).body

const flat = (text: string) => text.replace(/\s+/g, ' ')

const notes = (body: string) => [...body.matchAll(/<p class="note svelte-[\w-]+">(.*?)<\/p>/g)].map((m) => m[1])

const names = (body: string) => [...body.matchAll(/<span class="name svelte-[\w-]+">([^<]*)<\/span>/g)].map((m) => m[1])

const letters = (body: string) =>
  [...body.matchAll(/<span class="letter (\w+) svelte-[\w-]+">(.)<\/span>/g)].map((m) => `${m[1]} ${m[2]}`)

const hits = (body: string) => [...body.matchAll(/<span class="svelte-[\w-]+ hit">([^<]*)<\/span>/g)].map((m) => m[1])

describe('Files', () => {
  it("heads the tree with the workspace's name in the shared bar, going back to the chat, and the search field", async () => {
    const body = draw(await browsing())
    expect(body).toMatch(/<div class="bar ios svelte-[\w-]+ fixed topmost column"[^]*?aria-label="Back to Fix the login"/)
    expect(body).toMatch(/<div class="center svelte-[\w-]+">(<!--[^>]*-->)*<h1 class="title svelte-[\w-]+">login<\/h1>/)
    expect(body).toMatch(/<input class="query svelte-[\w-]+" type="search" aria-label="Search files"/)
  })

  it('spins until the root is listed', () => {
    const files = new FilesState(1, listing.workspace, { list: never, read: never, search: never, stopSearch: never }, () => {})
    const body = draw(files)
    expect(body).toMatch(/<p class="note svelte-[\w-]+"><span class="spinner[^]*?Reading the files…<\/p>/)
    expect(body).not.toContain('<ul')
  })

  it("draws the root's entries in the server's order, with their git letters", async () => {
    const body = draw(await browsing())
    expect(names(body)).toEqual(['src', '.env', 'notes.txt'])
    expect(letters(body)).toEqual(['modified M', 'untracked U'])
  })

  it('says so for an empty workspace', async () => {
    expect(notes(draw(await browsing({ '': { ...ROOT_FOLDER, entries: [] } })))).toEqual(['No files'])
  })

  it("opens a folder under its row a level deeper, its error standing in for its children", async () => {
    const files = await browsing({ '': ROOT_FOLDER, src: MISSING })
    await files.toggle('src')
    const body = draw(files)
    expect(names(body)).toEqual(['src', '.env', 'notes.txt'])
    expect(body).toMatch(/aria-expanded="true" style="--depth: 0;"/)
    expect(body).toMatch(/<p class="notice failed svelte-[\w-]+" style="--depth: 1;">no such folder<\/p>/)
  })

  it('says a folder holds more than it listed', async () => {
    const body = draw(await browsing({ '': { ...ROOT_FOLDER, more: true } }))
    expect(body).toMatch(/<p class="notice svelte-[\w-]+" style="--depth: 0;">Only the first 10,000 entries<\/p>/)
  })

  it('shows what it found instead of the tree while a query is searched', async () => {
    const files = await browsing()
    files.results = { found: FOUND, loading: false, error: null }
    const body = draw(files)
    expect(names(body)).toEqual([])
    expect(hits(body)).toEqual(['mai', 'é'])
  })

  it('leaves only the notice and Back once the workspace is closed on the machine', async () => {
    const files = await browsing()
    files.gone = true
    const body = draw(files)
    expect(notes(body)).toEqual([`${CLOSED}.`])
    expect(body).not.toContain('type="search"')
    expect(body).not.toContain('<ul')
    expect(body).toContain('aria-label="Back to Fix the login"')
  })

  it('searches through the state as the user types, and toggles and opens through it', () => {
    const source = flat(filesSource)
    expect(source).toContain('value={files.query} oninput={(event) => files.find(event.currentTarget.value)}')
    expect(source).toContain('const toggle = (path: string) => void files.toggle(path)')
    expect(source).toContain('<EntryRow {row} ontoggle={toggle} {onopen} />')
    expect(source).toContain('<SearchResults results={files.results} {onopen} />')
  })
})

describe('EntryRow', () => {
  it('draws a closed folder as a button with a chevron and its icon', () => {
    const body = entryRow(ROOT_FOLDER.entries[0], { path: 'src' })
    expect(body).toMatch(/<button class="entry svelte-[\w-]+" type="button" aria-expanded="false"/)
    expect(body).toContain('m9 18 6-6-6-6')
    expect(body).toContain('M20 20a2 2 0 0 0 2-2V8')
  })

  it('turns the chevron down and opens the folder icon once open, with a spinner while it lists', () => {
    const body = entryRow(ROOT_FOLDER.entries[0], { open: true, loading: true })
    expect(body).toContain('aria-expanded="true"')
    expect(body).toContain('m6 9 6 6 6-6')
    expect(body).toContain('class="spinner')
    expect(body).not.toContain('m9 18 6-6-6-6')
  })

  it('draws a file with no chevron, a picture with the image icon', () => {
    const file = entryRow({ name: 'main.rs', status: null })
    expect(file).not.toContain('aria-expanded')
    expect(file).not.toContain('m9 18 6-6-6-6')
    expect(file).not.toContain('class="letter')
    expect(entryRow({ name: 'logo.png' })).toContain('<circle cx="9" cy="9" r="2"')
  })

  it('dims a hidden entry and marks a link', () => {
    expect(entryRow(ROOT_FOLDER.entries[1])).toMatch(/<button class="entry svelte-[\w-]+ hidden"/)
    expect(entryRow({ link: true })).toMatch(/<span class="tag svelte-[\w-]+">link<\/span>/)
    expect(entryRow({})).not.toContain('class="tag')
  })

  it('draws an entry that is neither a file nor a folder as a row that does not open', () => {
    const body = entryRow({ kind: 'other', name: 'socket' })
    expect(body).toMatch(/<div class="entry other svelte-[\w-]+" style="--depth: 0;">/)
    expect(body).not.toContain('<button')
  })

  it.each([
    ['modified', 'M'],
    ['added', 'A'],
    ['deleted', 'D'],
    ['renamed', 'R'],
    ['untracked', 'U'],
    ['other', '?'],
  ] as const)('shows a %s entry with the letter %s', (status, letter) => {
    expect(letters(entryRow({ status }))).toEqual([`${status} ${letter}`])
  })

  it('indents each level by 16 px', () => {
    expect(entryRow({}, { depth: 3 })).toContain('style="--depth: 3;"')
    expect(flat(rowSource)).toContain('padding: var(--gap) var(--inset) var(--gap) calc(var(--inset) + var(--depth) * 16px);')
  })

  it('toggles a folder and opens a file on a tap, with the 44 px touch target', () => {
    const source = flat(rowSource)
    expect(source).toContain('onclick={() => ontoggle(row.path)} ontouchstart={() => {}}')
    expect(source).toContain('onclick={() => onopen(row.path)} ontouchstart={() => {}}')
    expect(source).toContain('min-height: 44px;')
  })

  it('colours the git letters as the changes list does', () => {
    expect(flat(rowSource)).toContain(
      '.modified { color: var(--working); } .added, .untracked { color: var(--done); } .deleted { color: var(--failed); } .renamed { color: var(--accent); }',
    )
  })
})

describe('SearchResults', () => {
  it('draws each path with the characters it matched highlighted, counted as characters', () => {
    const body = results()
    expect(body).toContain('<span dir="ltr"><!--[--><span class="svelte-')
    expect(hits(body)).toEqual(['mai', 'é'])
    expect(body).toMatch(/>docs\/caf<\/span><span class="svelte-[\w-]+ hit">é<\/span><span class="svelte-[\w-]+">\.md</)
    expect(notes(body)).toEqual([])
  })

  it('says it found nothing', () => {
    const body = results({}, { names: [], matches: 0 })
    expect(notes(body)).toEqual(['Nothing found'])
    expect(body).not.toContain('<ul')
  })

  it('says it kept only the best 200 when the search was capped', () => {
    expect(notes(results({}, { capped: true }))).toEqual(['Only the best 200'])
  })

  it('spins while searching, keeping what it found before', () => {
    const body = results({ loading: true })
    expect(body).toMatch(/<p class="note svelte-[\w-]+"><span class="spinner[^]*?Searching…<\/p>/)
    expect(hits(body)).toEqual(['mai', 'é'])
    expect(results({ loading: true, found: null })).not.toContain('<ul')
  })

  it("shows why a search failed", () => {
    expect(notes(results({ error: 'IPC is gone' }))[0]).toBe('IPC is gone')
  })

  it('opens the file of a result on a tap', () => {
    expect(flat(resultsSource)).toContain(
      '<button class="result" type="button" onclick={() => onopen(name.path)} ontouchstart={() => {}}>',
    )
    expect(flat(resultsSource)).toContain('min-height: 44px;')
  })
})
