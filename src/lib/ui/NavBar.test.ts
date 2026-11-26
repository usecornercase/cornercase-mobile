import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { Platform } from '../platform'
import NavBar from './NavBar.svelte'
import barSource from './NavBar.svelte?raw'

type Props = {
  backTo?: string | null
  title?: string
  center?: string
  right?: string
  below?: number
  fixed?: boolean
  topmost?: boolean
  rooted?: boolean
  measure?: 'full' | 'column' | 'form'
  edge?: boolean
  variant?: Platform
}

const html = (markup: string) => createRawSnippet(() => ({ render: () => markup }))

const bar = ({ backTo = null, center, right, ...props }: Props) =>
  render(NavBar, {
    props: {
      ...props,
      backTo,
      onback: () => {},
      center: center === undefined ? undefined : html(center),
      right: right === undefined ? undefined : html(right),
    },
  }).body

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('NavBar', () => {
  it('hands out its element, for what is measured under it', () => {
    expect(barSource).toContain('bar = $bindable(null),')
    expect(flat(barSource)).toContain('<div bind:this={bar} class="bar {variant}"')
  })

  it.each<[string, string | null, string]>([
    ['the title below', 'Agents', 'Back to Agents'],
    ['no title below', null, 'Back'],
  ])('names the back button after %s', (_, backTo, name) => {
    expect(bar({ backTo, variant: 'ios' })).toMatch(new RegExp(`<button class="back svelte-[\\w-]+" type="button" aria-label="${name}">`))
  })

  it('shows the chevron and the title below on iOS', () => {
    const body = bar({ backTo: 'Machines', variant: 'ios' })
    expect(body).toContain('<path d="m15 18-6-6 6-6">')
    expect(body).toMatch(/<span class="label svelte-[\w-]+[^"]*">Machines<\/span>/)
  })

  it('shows only the chevron when no title is known', () => {
    const body = bar({ variant: 'ios' })
    expect(body).toContain('<path d="m15 18-6-6 6-6">')
    expect(body).not.toContain('class="label')
  })

  it('hides the title below until it is measured to fit', () => {
    expect(bar({ backTo: 'Machines', variant: 'ios' })).toMatch(/<span class="label svelte-[\w-]+ hidden">Machines/)
  })

  it('shows the arrow without the title below on Android', () => {
    const body = bar({ backTo: 'Agents', variant: 'android' })
    expect(body).toMatch(/<div class="bar android svelte-[\w-]+ fixed"/)
    expect(body).toContain('aria-label="Back to Agents"')
    expect(body).not.toContain('<path d="m15 18-6-6 6-6">')
    expect(body).not.toContain('class="label')
    expect(barSource).toMatch(/\.android \.center \{\s*text-align: left;\s*\}/)
  })

  it('draws the left arrow on Android', () => {
    expect(bar({ variant: 'android' })).toMatch(/<path d="m12 19-7-7 7-7"><\/path>(<!--[^>]*-->)*<path d="M19 12H5">/)
  })

  it('puts the title in a centred h1', () => {
    expect(bar({ title: 'Machines', variant: 'ios' })).toMatch(
      /<div class="center svelte-[\w-]+">(<!--[^>]*-->)*<h1 class="title svelte-[\w-]+">Machines<\/h1>/,
    )
    expect(barSource).toMatch(/\.center \{\s*min-width: 0;\s*overflow: hidden;\s*text-align: center;\s*\}/)
  })

  it('has no h1 without a title', () => {
    expect(bar({ variant: 'ios' })).not.toContain('<h1')
  })

  it('shows no back button when rooted, keeping the start so the centre stays in place', () => {
    const body = bar({ rooted: true, title: 'tests', variant: 'ios' })
    expect(body).not.toContain('class="back')
    expect(body).toMatch(/<div class="start svelte-[\w-]+">(<!--[^>]*-->)*<\/div> <div class="center/)
  })

  it('draws the center and right snippets in their places', () => {
    const body = bar({ title: 'tests', center: '<p>tab · place</p>', right: '<button>Fit</button>', variant: 'ios' })
    expect(body).toMatch(/<div class="center [^"]*">.*<h1[^>]*>tests<\/h1>.*<p>tab · place<\/p>.*<\/div>/s)
    expect(body).toMatch(/<div class="end svelte-[\w-]+">(<!--[^>]*-->)*<button>Fit<\/button>/)
  })

  it.each<[string, Props, RegExp]>([
    ['sticks by default, under whatever is above it', {}, /<div class="bar ios svelte-[\w-]+ fixed" style="--below: 0px;">/],
    ['reaches over the safe area when topmost', { topmost: true }, /<div class="bar ios svelte-[\w-]+ fixed topmost" style="--below: 0px;">/],
    ['stays in place when not fixed', { fixed: false }, /<div class="bar ios svelte-[\w-]+" style="--below: 0px;">/],
    ['stays in place when not fixed, even topmost', { fixed: false, topmost: true }, /<div class="bar ios svelte-[\w-]+" style="--below: 0px;">/],
    ['draws its edge', { edge: true, topmost: true }, /<div class="bar ios svelte-[\w-]+ fixed topmost edge" style="--below: 0px;">/],
    ['sits below a bar', { below: 32 }, /<div class="bar ios svelte-[\w-]+ fixed" style="--below: 32px;">/],
    ['spans a column screen', { measure: 'column', topmost: true }, /<div class="bar ios svelte-[\w-]+ fixed topmost column" style="--below: 0px;">/],
    ['spans a form screen', { measure: 'form' }, /<div class="bar ios svelte-[\w-]+ fixed form" style="--below: 0px;">/],
  ])('%s', (_, props, root) => {
    expect(bar({ ...props, variant: 'ios' })).toMatch(root)
  })

  it.each([
    'grid-template-columns: 1fr auto 1fr;',
    'background: var(--veil);',
    'position: sticky; top: calc(env(safe-area-inset-top) + var(--below));',
    '.fixed.topmost { top: 0; margin-top: calc(-1 * var(--gap) - env(safe-area-inset-top)); padding-top: calc(var(--gap) + env(safe-area-inset-top)); }',
    '.edge { border-bottom-color: var(--border); }',
    'margin: calc(-1 * var(--gap)) calc(-1 * var(--inset-wide)); padding: var(--gap) calc(var(--inset-wide) - var(--inset));',
    '.fixed.column { margin-right: calc(-1 * var(--gutter)); margin-left: calc(-1 * var(--gutter)); }',
    '.fixed.form { margin-right: calc(-1 * var(--gutter-form)); margin-left: calc(-1 * var(--gutter-form)); }',
    'min-width: 44px; min-height: 44px;',
    'color: var(--accent);',
    '.back:active { background: var(--hover); }',
    'text-overflow: ellipsis;',
  ])('holds %s', (text) => {
    expect(flat(barSource)).toContain(text)
  })

  it('blurs what is behind it with and without the prefix', () => {
    expect(barSource).toContain('-webkit-backdrop-filter: blur(24px);')
    expect(barSource).toContain('\n    backdrop-filter: blur(24px);')
  })

  it('answers touches so :active shows', () => {
    expect(barSource).toContain('ontouchstart={() => {}}')
  })
})
