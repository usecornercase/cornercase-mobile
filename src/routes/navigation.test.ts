import { describe, expect, it } from 'vitest'

const screens = import.meta.glob<string>('/src/routes/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const OLD = ['class="top"', 'class="back"', '>Back<', 'Back to the board']

const leftovers = (text: string) => OLD.filter((piece) => text.includes(piece))

const withBar = Object.entries(screens)
  .filter(([, text]) => text.includes('<NavBar'))
  .map(([path]) => path)

const FIXED_SCREENS = ['/src/routes/terminal/Terminal.svelte', '/src/routes/agent/Agent.svelte']

const SAFE_TOP = /(?:padding|margin)(?:-top)?:[^;]*safe-area-inset-top/

describe('the screens of src/routes', () => {
  it('reads every screen', () => {
    expect(Object.keys(screens)).toContain('/src/routes/terminal/Terminal.svelte')
    expect(Object.keys(screens).length).toBeGreaterThan(20)
  })

  it.each(Object.entries(screens))('%s keeps no old header', (_, text) => {
    expect(leftovers(text)).toEqual([])
  })

  it.each(withBar.filter((path) => !FIXED_SCREENS.includes(path)))(
    '%s leaves the safe area on top to the body, which pads it already',
    (path) => {
      expect(screens[path]).not.toMatch(SAFE_TOP)
    },
  )

  it.each(FIXED_SCREENS)('%s pads the safe area itself, as a fixed screen the body does not reach', (path) => {
    expect(screens[path]).toMatch(SAFE_TOP)
  })

  it('reach over the safe area only on the screens without the connection bar above', () => {
    expect(withBar.filter((path) => /<NavBar [^>]*\stopmost[\s/>]/.test(screens[path])).sort()).toEqual([
      '/src/routes/Machine.svelte',
      '/src/routes/Machines.svelte',
      '/src/routes/changes/Changes.svelte',
      '/src/routes/changes/Diff.svelte',
      '/src/routes/files/File.svelte',
      '/src/routes/files/Files.svelte',
      '/src/routes/issues/Issue.svelte',
      '/src/routes/issues/Issues.svelte',
      '/src/routes/start/Start.svelte',
    ])
  })

  it.each([
    ['/src/routes/changes/Changes.svelte', 'column', 'var(--gutter)'],
    ['/src/routes/files/Files.svelte', 'column', 'var(--gutter)'],
    ['/src/routes/issues/Issues.svelte', 'column', 'var(--gutter)'],
    ['/src/routes/issues/Issue.svelte', 'column', 'var(--gutter)'],
    ['/src/routes/start/Start.svelte', 'form', 'var(--gutter-form)'],
    ['/src/routes/Machines.svelte', 'form', 'var(--gutter-form)'],
    ['/src/routes/Machine.svelte', 'form', 'var(--gutter-form)'],
  ])('%s keeps its content in a %s, with its bar across the pane', (path, measure, gutter) => {
    expect(screens[path]).toContain(`measure="${measure}"`)
    expect(screens[path]).toContain(`padding: var(--gap) ${gutter} 40px;`)
    expect(screens[path]).not.toContain('max-width: 520px')
  })

  it.each(['/src/routes/changes/Diff.svelte', '/src/routes/files/File.svelte', '/src/routes/terminal/Terminal.svelte'])(
    '%s takes the whole pane, for code',
    (path) => {
      expect(screens[path]).not.toMatch(/measure=|var\(--gutter/)
    },
  )

  it('go back through the NavBar on every screen with a way back', () => {
    expect(withBar.sort()).toEqual([
      '/src/routes/Machine.svelte',
      '/src/routes/Machines.svelte',
      '/src/routes/agent/Agent.svelte',
      '/src/routes/agent/ChatHeader.svelte',
      '/src/routes/changes/Changes.svelte',
      '/src/routes/changes/Diff.svelte',
      '/src/routes/files/File.svelte',
      '/src/routes/files/Files.svelte',
      '/src/routes/issues/Issue.svelte',
      '/src/routes/issues/Issues.svelte',
      '/src/routes/start/Start.svelte',
      '/src/routes/terminal/Terminal.svelte',
    ])
  })
})

describe('the guard of the safe area', () => {
  it.each([
    ['a padding over it', 'padding-top: calc(env(safe-area-inset-top) + var(--gap));'],
    ['a padding of it alone', 'padding-top: env(safe-area-inset-top);'],
    ['a padding shorthand', 'padding: env(safe-area-inset-top) 0 0;'],
    ['a margin', 'margin-top: env(safe-area-inset-top);'],
  ])('finds %s', (_, text) => {
    expect(text).toMatch(SAFE_TOP)
  })

  it('leaves a height that takes it out', () => {
    expect('min-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));').not.toMatch(SAFE_TOP)
  })
})

describe('the guard', () => {
  it.each([
    ['a top bar', '<header class="top">', ['class="top"']],
    ['a back button', '<button class="back" onclick={onback}>', ['class="back"']],
    ['a back label', '<button>Back</button>', ['>Back<']],
    ['the board label', '<button aria-label="Back to the board">', ['Back to the board']],
    ['the NavBar', '<NavBar backTo="Studio" {onback} />', []],
  ])('finds %s', (_, text, found) => {
    expect(leftovers(text)).toEqual(found)
  })
})
