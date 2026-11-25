import { describe, expect, it } from 'vitest'
import base from './base.css?raw'
import tokens from './tokens.css?raw'

const sources = import.meta.glob<string>(['/src/**/*.{svelte,css,ts}', '!/src/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const value = (name: string) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]

const names = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map((match) => match[1]))

const defined = (text: string) =>
  new Set([...names(text, /(--[\w-]+)\s*:/g), ...names(text, /style:(--[\w-]+)/g)])

const undefinedVars = (text: string) => {
  const own = defined(text)
  const shared = defined(tokens)
  return [...names(text, /var\(\s*(--[\w-]+)/g)].filter((name) => !own.has(name) && !shared.has(name))
}

describe('custom properties', () => {
  it('reads the text of the stylesheets', () => {
    expect(tokens).toContain('--brand: #005fff;')
    expect(sources['/src/lib/theme/base.css']).toContain('var(--glass)')
  })

  it.each(Object.entries(sources))('%s uses only defined custom properties', (_, text) => {
    expect(undefinedVars(text)).toEqual([])
  })

  it.each([
    ['a misspelt token', 'a { color: var(--brnad) }', ['--brnad']],
    ['a local property used before its definition', 'a { width: var(--unit); --unit: 4px }', []],
    ['a property set with style:', '<div style:--unit={unit}></div><style>div { width: var(--unit) }</style>', []],
    ['a shared token', 'a { color: var(--brand) }', []],
  ])('finds %s', (_, text, missing) => {
    expect(undefinedVars(text)).toEqual(missing)
  })

  it('holds no Tokyo Night colour', () => {
    expect(tokens.toLowerCase()).not.toContain('#1a1b26')
  })
})

describe('tokens', () => {
  it.each([
    ['--glass', '#0b0c0e'],
    ['--raised', '#1d2025'],
    ['--surface', '#2a2e354d'],
    ['--panel', '#ffffff0a'],
    ['--field', '#0506088c'],
    ['--veil', '#0a0b109e'],
    ['--border', '#ffffff17'],
    ['--edge', '#ffffff2b'],
    ['--hover', '#ffffff0f'],
    ['--selected', '#ffffff1a'],
    ['--text', '#eceef1'],
    ['--soft', '#b6bcc4'],
    ['--muted', '#8b929b'],
    ['--faint', '#6b727c'],
    ['--brand', '#005fff'],
    ['--brand-hover', '#0050d8'],
    ['--brand-light', '#2b7bff'],
    ['--on-brand', '#f7f8fa'],
    ['--accent', '#74a3ff'],
    ['--accent-soft', '#005fff2e'],
    ['--selection', '#005fff47'],
    ['--working', '#f5d76e'],
    ['--waiting', '#ff8700'],
    ['--done', '#58e6a0'],
    ['--failed', '#ff6b8b'],
    ['--merged', '#875fff'],
    ['--diff-added', '#58e6a01a'],
    ['--diff-added-strong', '#58e6a052'],
    ['--diff-removed', '#ff6b8b1a'],
    ['--diff-removed-strong', '#ff6b8b52'],
    ['--radius-chip', '5px'],
    ['--radius-control', '8px'],
    ['--radius-card', '12px'],
    ['--radius-sheet', '16px'],
    ['--inset-card', '28px'],
    ['--side', 'calc(clamp(320px, 30vw, 380px) + env(safe-area-inset-left))'],
    ['--column', '760px'],
    ['--form', '520px'],
    ['--pane-left', '0px'],
    ['--pane-width', '100vw'],
    ['--pane-safe-left', 'env(safe-area-inset-left)'],
    ['--gutter', 'max(var(--inset-wide), calc((var(--pane-width) - var(--column)) / 2))'],
    ['--gutter-form', 'max(var(--inset-wide), calc((var(--pane-width) - var(--form)) / 2))'],
  ])('%s is %s', (name, expected) => {
    expect(value(name)).toBe(expected)
  })

  it('names a UI and a mono font family', () => {
    expect(value('--font-ui')).toContain('system-ui')
    expect(value('--font-mono')).toContain('ui-monospace')
  })
})

describe('base styles', () => {
  it.each([
    'background: var(--glass);',
    'color-scheme: dark;',
    'font-family: var(--font-ui);',
    '-webkit-tap-highlight-color: transparent;',
    '-webkit-user-select: none;',
    'user-select: none;',
    '-webkit-touch-callout: none;',
    '-webkit-text-size-adjust: 100%;',
    'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)',
    'env(safe-area-inset-left)',
  ])('holds %s', (text) => {
    expect(base.replace(/\s+/g, ' ')).toContain(text)
  })

  it('pulses from 1 to 0.3 and back over --pulse, for every component, and not with reduced motion', () => {
    const style = base.replace(/\s+/g, ' ')
    expect(style).toContain('.pulsing { animation: pulse var(--pulse) ease-in-out infinite; }')
    expect(style).toContain('@keyframes pulse { 50% { opacity: 0.3; } }')
    expect(style).toContain('@media (prefers-reduced-motion: reduce) { .pulsing { animation: none; } }')
    expect(Object.values(sources).filter((text) => text.includes('@keyframes pulse'))).toHaveLength(1)
  })

  it('hides the text only screen readers read, for every component', () => {
    expect(base.replace(/\s+/g, ' ')).toContain(
      '.spoken { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }',
    )
    expect(Object.values(sources).filter((text) => text.includes('.spoken {'))).toHaveLength(1)
  })

  it('moves the pane right of the side in two panes, on the root so the gutters follow', () => {
    const style = base.replace(/\s+/g, ' ')
    expect(style).toContain(
      'html.split { --pane-left: var(--side); --pane-width: calc(100vw - var(--side)); --pane-safe-left: 0px; }',
    )
    expect(style).toContain('html.split body { padding-left: 0; }')
  })

  it('keeps the brand wash fixed, 180 px tall, fading from 12 % to 0', () => {
    const wash = base.match(/body::before \{([^}]*)\}/)?.[1].replace(/\s+/g, ' ')
    expect(wash).toContain('position: fixed;')
    expect(wash).toContain('height: 180px;')
    expect(wash).toContain('linear-gradient(180deg, rgb(0 95 255 / 0.12), rgb(0 95 255 / 0))')
  })
})
