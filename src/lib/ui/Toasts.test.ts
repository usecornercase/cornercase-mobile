import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { Shown } from '../toasts'
import Toasts from './Toasts.svelte'
import toastsSource from './Toasts.svelte?raw'

const INFO: Shown = { id: 1, level: 'info', message: 'Machine added', count: 1, at: 0 }
const ERROR: Shown = { id: 2, level: 'error', message: 'Could not reach the machine', count: 3, at: 0 }

const toasts = (items: Shown[], below?: number) =>
  render(Toasts, { props: { items, ondismiss: () => {}, below } }).body

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('Toasts', () => {
  it('draws each toast as a glass card filled by one button with its bar and text', () => {
    const body = toasts([INFO, ERROR])
    expect(body).toMatch(
      /<div class="toast info svelte-[\w-]+"><div class="glass [^"]+"><span class="highlight [^"]+"><\/span> <button class="body svelte-[\w-]+" type="button"><span class="bar svelte-[\w-]+"><\/span> <span class="text svelte-[\w-]+">Machine added<\/span>/,
    )
    expect(body).toMatch(/<div class="toast error svelte-[\w-]+">.*?<button class="body [^"]+" type="button">.*?>Could not reach the machine<\/span>/)
  })

  it('puts no block inside a button', () => {
    expect(toasts([INFO, ERROR])).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*<div/)
  })

  it('shows the count only when a toast has merged', () => {
    const body = toasts([INFO, ERROR])
    expect(body).toMatch(/<span class="count svelte-[\w-]+">×3<\/span>/)
    expect(body.match(/class="count/g)).toHaveLength(1)
  })

  it('announces new toasts politely', () => {
    expect(toasts([])).toMatch(/<div class="toasts svelte-[\w-]+" aria-live="polite" style="--below: 0px;">/)
  })

  it('sits below the connection bar when it shows', () => {
    expect(toasts([INFO], 40)).toContain('style="--below: 40px;"')
  })

  it('dismisses the toast tapped and gives :active to touches', () => {
    expect(toastsSource).toContain('onclick={() => ondismiss(toast.id)}')
    expect(toastsSource).toContain('ontouchstart={() => {}}')
  })

  it('drops each toast in and fades it out', () => {
    expect(toastsSource).toContain('{#each items as toast (toast.id)}')
    expect(toastsSource).toContain('<div class="toast {toast.level}" in:dropIn out:fadeOut>')
  })

  it.each([
    'position: fixed; top: 0; left: var(--pane-left); right: 0;',
    'padding: calc(env(safe-area-inset-top) + var(--below) + var(--gap)) var(--inset-wide) 0; pointer-events: none;',
    'width: 100%; max-width: 520px; pointer-events: auto;',
    'width: 100%; min-height: 44px; padding: 10px 14px; border: 0; background: none;',
    'font: inherit; text-align: left;',
    'width: 3px; height: 18px; border-radius: 999px;',
    '.info .bar { background: var(--accent); box-shadow: 0 0 8px rgb(116 163 255 / 0.6); }',
    '.error .bar { background: var(--failed); box-shadow: 0 0 8px rgb(255 107 139 / 0.6); }',
    'border-radius: var(--radius-chip); background: var(--selected); color: var(--muted);',
  ])('holds %s', (text) => {
    expect(flat(toastsSource)).toContain(text)
  })
})
