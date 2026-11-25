import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { AgentClosing_Serialize as AgentClosing } from '../bindings'
import { NOTHING_DELETED } from '../closeAgent.svelte'
import Button from './Button.svelte'
import CloseConfirm from './CloseConfirm.svelte'
import CodeBox from './CodeBox.svelte'
import DemoOffer from './DemoOffer.svelte'
import Emblem from './Emblem.svelte'
import Field from './Field.svelte'
import Glass from './Glass.svelte'
import Icon from './Icon.svelte'
import Labelled from './Labelled.svelte'
import SearchField from './SearchField.svelte'
import Sheet from './Sheet.svelte'
import Spinner from './Spinner.svelte'
import TextArea from './TextArea.svelte'
import ToolButton from './ToolButton.svelte'
import buttonSource from './Button.svelte?raw'
import closeConfirmSource from './CloseConfirm.svelte?raw'
import codeBoxSource from './CodeBox.svelte?raw'
import demoOfferSource from './DemoOffer.svelte?raw'
import emblemSource from './Emblem.svelte?raw'
import fieldSource from './Field.svelte?raw'
import glassSource from './Glass.svelte?raw'
import labelledSource from './Labelled.svelte?raw'
import searchFieldSource from './SearchField.svelte?raw'
import sheetSource from './Sheet.svelte?raw'
import spinnerSource from './Spinner.svelte?raw'
import textAreaSource from './TextArea.svelte?raw'
import toolButtonSource from './ToolButton.svelte?raw'
import baseSource from '../theme/base.css?raw'

const html = (markup: string) => createRawSnippet(() => ({ render: () => markup }))

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('Glass', () => {
  it('draws its content under the top highlight', () => {
    const body = render(Glass, { props: { children: html('<p>inside</p>') } }).body
    expect(body).toMatch(/<div class="glass svelte-[\w-]+"><span class="highlight svelte-[\w-]+"><\/span> <p>inside<\/p>/)
  })

  it.each([
    'border: 1px solid var(--border);',
    'border-radius: var(--radius-card);',
    'background: linear-gradient(180deg, #1c1f24e0, #101215e8);',
    'box-shadow: 0 24px 60px rgb(0 0 0 / 0.5), 0 4px 12px rgb(0 0 0 / 0.3);',
    'left: var(--radius-card); right: var(--radius-card); height: 1px;',
    'background: linear-gradient(90deg, rgb(236 238 241 / 0.18), rgb(236 238 241 / 0.02));',
  ])('holds %s', (text) => {
    expect(flat(glassSource)).toContain(text)
  })

  it('blurs what is behind it with and without the prefix', () => {
    expect(glassSource).toContain('-webkit-backdrop-filter: blur(24px);')
    expect(glassSource).toContain('\n    backdrop-filter: blur(24px);')
  })
})

describe('Glass as a sheet', () => {
  it('rounds only its top corners with the sheet radius and drops its bottom edge', () => {
    const body = render(Glass, { props: { sheet: true, children: html('<p>inside</p>') } }).body
    expect(body).toMatch(/<div class="glass svelte-[\w-]+ sheet"><span class="highlight svelte-[\w-]+"><\/span>/)
    expect(flat(glassSource)).toContain(
      '.sheet { border-bottom: 0; border-radius: var(--radius-sheet) var(--radius-sheet) 0 0; }',
    )
    expect(flat(glassSource)).toContain('.sheet .highlight { left: var(--radius-sheet); right: var(--radius-sheet); }')
  })
})

describe('Sheet', () => {
  const body = render(Sheet, { props: { label: 'Close it?', oncancel: () => {}, children: html('<p>inside</p>') } }).body

  it('draws a named modal dialog of glass over a veil that is no target for VoiceOver', () => {
    expect(body).toMatch(
      /<div class="layer svelte-[\w-]+"><button class="scrim svelte-[\w-]+" type="button" tabindex="-1" aria-hidden="true"><\/button> <div class="sheet svelte-[\w-]+" role="dialog" aria-modal="true" aria-label="Close it\?" tabindex="-1"><div class="glass svelte-[\w-]+ sheet">/,
    )
    expect(body).toMatch(/<div class="body svelte-[\w-]+"><p>inside<\/p>/)
  })

  it('cancels on a tap outside it, on the veil', () => {
    expect(flat(sheetSource)).toContain('aria-hidden="true" onclick={oncancel} in:veilIn out:veilOut></button>')
  })

  it('sits over the whole page, out of the screens that slide, and takes the focus', () => {
    expect(sheetSource).toContain('{@attach overPage}')
    expect(sheetSource).toContain('{@attach focused}')
    expect(sheetSource).toContain('node.focus({ preventScroll: true })')
  })

  it.each([
    '.layer { position: fixed; inset: 0; z-index: 8; display: flex; flex-direction: column; justify-content: flex-end; }',
    '.scrim { position: absolute; inset: 0; padding: 0; border: 0; background: var(--veil); touch-action: none; }',
    '.sheet { position: relative; width: 100%; max-width: 520px; margin: 0 auto;',
    'padding: var(--inset-wide) var(--inset-wide) calc(env(safe-area-inset-bottom) + var(--inset-wide));',
    '{@attach focused} in:sheetIn out:sheetOut>',
  ])('holds %s', (text) => {
    expect(flat(sheetSource)).toContain(text)
  })
})

describe('CloseConfirm', () => {
  const PLAN: AgentClosing = {
    pane: 4,
    agent: 'codex',
    project: 2,
    workspace: 3,
    tabs: [5],
    stops: [{ pane: 4, tab: 5, workspace: 3, project: 2, agent: 'codex' }],
    keeps: [],
    run: null,
    closed: false,
    warning: 'Its worktree has changes',
  }
  const confirm = (rechecking?: boolean, plan = PLAN) =>
    render(CloseConfirm, { props: { plan, label: 'codex · api', rechecking, oncancel: () => {}, onconfirm: () => {} } })
      .body

  it('titles the sheet with the agent, then says each line of the plan', () => {
    const body = confirm()
    expect(body).toContain('aria-label="Close codex · api?"')
    expect(body).toMatch(/<h2 class="title svelte-[\w-]+">Close codex · api\?<\/h2>/)
    const lines = [...body.matchAll(/<p class="line svelte-[\w-]+">([^<]*)<\/p>/g)].map((match) => match[1])
    expect(lines).toEqual([NOTHING_DELETED, 'Its worktree has changes'])
  })

  it('offers Cancel plain and Close danger', () => {
    const body = confirm()
    expect(body).toMatch(/<button class="button plain svelte-[\w-]+" type="button">(<!--[^>]*-->| )*Cancel/)
    expect(body).toMatch(/<button class="button danger svelte-[\w-]+" type="button">(<!--[^>]*-->| )*Close/)
  })

  it('spins on Close and rests Cancel while it checks again', () => {
    const body = confirm(true)
    expect(body).toMatch(/<button class="button plain svelte-[\w-]+ resting" type="button" disabled="" aria-disabled="true">/)
    expect(body).toMatch(
      /<button class="button danger svelte-[\w-]+ busy" type="button" disabled="" aria-busy="true">(<!--[^>]*-->)*<span class="spinner /,
    )
  })

  it('says the plan it is given, so a plan that grew shows its new lines', () => {
    const grown = { ...PLAN, stops: [...PLAN.stops, { ...PLAN.stops[0], pane: 6 }], warning: null }
    expect(confirm(false, grown)).toMatch(/<p class="line svelte-[\w-]+">Also stops 1 subagent<\/p>/)
    expect(closeConfirmSource).toContain('const text = $derived(confirmationText(plan, label))')
  })

  it('passes its buttons on to what it was given', () => {
    expect(closeConfirmSource).toContain('<Sheet label={text.title} {oncancel}>')
    expect(closeConfirmSource).toContain('onclick={oncancel}>Cancel</Button>')
    expect(closeConfirmSource).toContain('onclick={onconfirm}>Close</Button>')
  })

  it.each([
    '.title { margin: 0 0 4px; color: var(--text); font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }',
    '.line { margin: 0; color: var(--soft); font-size: 15px; line-height: 20px; }',
    '.actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-top: var(--inset); }',
  ])('holds %s', (text) => {
    expect(flat(closeConfirmSource)).toContain(text)
  })
})

describe('CodeBox', () => {
  it('draws its lines inside a box as wide as the longest of them, their numbers as wide as the longest', () => {
    const body = render(CodeBox, { props: { digits: 3, children: html('<div>a line</div>') } }).body
    expect(body).toMatch(
      /<div class="box svelte-[\w-]+"><div class="lines svelte-[\w-]+" style="--digits: 3ch;"> ?<div>a line<\/div>/,
    )
  })

  it.each([
    'overflow-x: auto; overscroll-behavior-x: contain;',
    '.lines { width: max-content; min-width: 100%; }',
    ':global(.code-line) { --tint: transparent; display: flex; background: var(--tint);',
    'font-family: var(--font-mono); font-size: 13px; line-height: 20px; white-space: pre; }',
    ':global(.code-gutter) { position: sticky; left: 0;',
    'background: linear-gradient(var(--tint), var(--tint)), var(--raised);',
    ':global(.code-number) { box-sizing: content-box; width: var(--digits);',
  ])('holds %s, the line rules global so that the lines of any screen take them', (text) => {
    expect(flat(codeBoxSource)).toContain(text)
  })
})

describe('Button', () => {
  type Props = { tone?: 'primary' | 'plain' | 'danger' | 'link'; type?: 'button' | 'submit'; quiet?: boolean; resting?: boolean; busy?: boolean }
  const button = (props: Props, label = 'Add machine') =>
    render(Button, { props: { ...props, children: html(label) } }).body

  it('is disabled for every reader while resting', () => {
    expect(button({ resting: true })).toMatch(
      /<button class="button primary svelte-[\w-]+ resting" type="button" disabled="" aria-disabled="true">(<!--[^>]*-->)* Add machine/,
    )
  })

  it('is an enabled primary button otherwise', () => {
    const body = button({})
    expect(body).toMatch(/<button class="button primary svelte-[\w-]+" type="button">(<!--[^>]*-->)* Add machine/)
    expect(body).not.toMatch(/disabled|aria-busy|spinner/)
  })

  it('takes the plain tone and the submit type', () => {
    expect(button({ tone: 'plain' }, 'Cancel')).toMatch(/<button class="button plain svelte-[\w-]+" type="button">/)
    expect(button({ type: 'submit' }, 'Add')).toMatch(/<button class="button primary svelte-[\w-]+" type="submit">/)
  })

  it('takes the danger tone', () => {
    expect(button({ tone: 'danger' }, 'Remove')).toMatch(/<button class="button danger svelte-[\w-]+" type="button">/)
  })

  it('takes the link tone: accent text with no fill or edge, in the size of the text around it', () => {
    expect(button({ tone: 'link' }, 'Try a demo')).toMatch(/<button class="button link svelte-[\w-]+" type="button">/)
    expect(flat(buttonSource)).toContain(
      '.link { padding: 0 6px; border: 1px solid transparent; background: none; color: var(--accent); font-size: inherit; }',
    )
    expect(flat(buttonSource)).toContain('.link:not(.resting):active { opacity: 0.7; }')
  })

  it('goes quiet as text in its tone, with no fill or edge, its label still on the line of the text beside it', () => {
    expect(button({ tone: 'danger', quiet: true }, 'Close agent')).toMatch(
      /<button class="button danger svelte-[\w-]+ quiet" type="button">/,
    )
    expect(flat(buttonSource)).toContain(
      '.quiet { margin-left: calc(-1 * var(--inset)); padding: 0 var(--inset); border-color: transparent; background: none; }',
    )
    expect(flat(buttonSource)).toContain('.quiet:not(.resting):active { border-color: transparent; }')
  })

  it('shows the spinner before its label and stops answering while busy', () => {
    const body = button({ busy: true, type: 'submit' }, 'Adding…')
    expect(body).toMatch(
      /<button class="button primary svelte-[\w-]+ busy" type="submit" disabled="" aria-busy="true">(<!--[^>]*-->)*<span class="spinner [^>]*>.*<\/span>(<!--[^>]*-->)* Adding…/,
    )
    expect(body).not.toMatch(/aria-disabled|resting/)
    expect(buttonSource).toMatch(/\.busy \{\s*pointer-events: none;\s*\}/)
  })

  it.each([
    'gap: 6px;',
    'border-radius: var(--radius-control);',
    '.primary { border: 1px solid rgb(43 123 255 / 0.7); background: linear-gradient(180deg, var(--brand), var(--brand-hover)); box-shadow: 0 0 10px rgb(0 95 255 / 0.28); color: var(--on-brand); font-weight: 500; }',
    '.plain { border: 1px solid var(--border); background: var(--hover); color: var(--soft); }',
    '.danger { border: 1px solid color-mix(in srgb, var(--failed) 35%, transparent); background: color-mix(in srgb, var(--failed) 10%, transparent); color: var(--failed); }',
  ])('holds %s', (text) => {
    expect(flat(buttonSource)).toContain(text)
  })

  it('is big enough to touch and shows a press only when it can be pressed', () => {
    expect(buttonSource).toContain('min-height: 44px;')
    expect(flat(buttonSource)).toContain('.primary:not(.resting):active { background: var(--brand-hover); }')
    expect(flat(buttonSource)).toContain(
      '.plain:not(.resting):active { border-color: var(--edge); background: var(--selected); }',
    )
    expect(flat(buttonSource)).toContain(
      '.danger:not(.resting):active { border-color: color-mix(in srgb, var(--failed) 70%, transparent); background: color-mix(in srgb, var(--failed) 18%, transparent); }',
    )
    expect(buttonSource).toMatch(/\.resting \{\s*opacity: 0\.4;\s*pointer-events: none;\s*\}/)
  })

  it('names itself and says whether what it opens is open', () => {
    const named = (expanded?: boolean) =>
      render(Button, { props: { tone: 'plain', label: 'Digits', expanded, children: html('0–9') } }).body
    expect(named()).toMatch(/<button class="button plain svelte-[\w-]+" type="button" aria-label="Digits">/)
    expect(named(false)).toContain('aria-label="Digits" aria-expanded="false">')
    expect(named(true)).toContain('aria-label="Digits" aria-expanded="true">')
  })

  it('marks itself as the current one, for the eye and for VoiceOver', () => {
    const body = render(Button, { props: { tone: 'plain', current: true, children: html('1. Yes') } }).body
    expect(body).toMatch(/<button class="button plain svelte-[\w-]+ current" type="button" aria-current="true">/)
    expect(button({ tone: 'plain' })).not.toContain('current')
    expect(flat(buttonSource)).toContain('.plain.current { border-color: var(--edge); background: var(--selected); color: var(--text); }')
  })

  it('narrows to a square of 44 px when compact', () => {
    const body = render(Button, { props: { tone: 'plain', compact: true, children: html('Esc') } }).body
    expect(body).toMatch(/<button class="button plain svelte-[\w-]+ compact" type="button">/)
    expect(flat(buttonSource)).toContain('.compact { min-width: 44px; padding: 0 var(--inset); }')
  })

  it('passes its click on and listens to touches so that WebKit on iOS shows the press', () => {
    expect(buttonSource).toContain('{onclick}')
    expect(buttonSource).toContain('ontouchstart={() => {}}')
  })
})

describe('DemoOffer', () => {
  const body = render(DemoOffer, { props: { ondemo: () => {} } }).body

  it('says No machine nearby? in grey, then Try a demo as a link', () => {
    expect(body).toMatch(
      /^<!--\[--><p class="offer svelte-[\w-]+">No machine nearby\? <button class="button link svelte-[\w-]+" type="button">(?:<!--[^>]*-->| )*Try a demo<!----><\/button>/,
    )
    expect(flat(demoOfferSource)).toContain(
      '.offer { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; margin: 0; color: var(--muted); font-size: 15px; }',
    )
  })

  it('asks for the demo on Try a demo', () => {
    expect(flat(demoOfferSource)).toContain('<Button tone="link" onclick={ondemo}>Try a demo</Button>')
  })

  it('keeps the link 44 px tall and its keyboard focus ring', () => {
    expect(buttonSource).toContain('min-height: 44px;')
    expect(flat(baseSource)).toContain(
      ":where(button, a, summary, input[type='checkbox']):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }",
    )
    expect(`${buttonSource}${demoOfferSource}`).not.toMatch(/outline/)
  })
})

describe('ToolButton', () => {
  const tool = (disabled?: boolean) =>
    render(ToolButton, { props: { label: 'Whole file', icon: 'file-text', size: 22, disabled, onclick: () => {} } }).body

  it('is an icon named for VoiceOver, at the size asked', () => {
    expect(tool()).toMatch(/<button class="tool svelte-[\w-]+" type="button" aria-label="Whole file">(?:<!--[^>]*-->| )*<svg [^>]*width="22"/)
  })

  it('takes no tap while disabled, faint', () => {
    expect(tool(true)).toMatch(/<button class="tool svelte-[\w-]+" type="button" aria-label="Whole file" disabled="">/)
    expect(flat(toolButtonSource)).toContain('.tool:disabled { color: var(--faint); background: none; }')
  })

  it('is a target of 44 by 44 px in the accent, shaded while pressed', () => {
    const source = flat(toolButtonSource)
    expect(source).toContain('width: 44px; height: 44px; padding: 0; border: 0;')
    expect(source).toContain('background: none; color: var(--accent); }')
    expect(source).toContain('.tool:active { background: var(--hover); }')
  })
})

describe('Field', () => {
  type Props = { label: string; value?: string; error?: string | null; url?: boolean; disabled?: boolean }
  const field = (props: Props) => render(Field, { props }).body
  const input = (body: string) => body.match(/<input [^>]*>/)?.[0] ?? ''

  it('labels its input and keeps an empty slot for the error', () => {
    const body = field({ label: 'Name', value: 'studio' })
    const id = body.match(/<label class="label svelte-[\w-]+" for="([\w-]+)">Name<\/label>/)?.[1]
    expect(input(body)).toContain(`id="${id}"`)
    expect(input(body)).toContain('value="studio"')
    expect(input(body)).not.toMatch(/aria-invalid|aria-describedby|inputmode|disabled/)
    expect(body).toMatch(/<p class="error svelte-[\w-]+" id="[\w-]+"><\/p>/)
  })

  it('points its input at the error it shows', () => {
    const body = field({ label: 'Machine code', error: 'Start it with ws://' })
    const id = body.match(/<p class="error svelte-[\w-]+" id="([\w-]+)">Start it with ws:\/\/<\/p>/)?.[1]
    expect(input(body)).toContain(`aria-invalid="true" aria-describedby="${id}"`)
  })

  it('passes input attributes on', () => {
    expect(input(render(Field, { props: { label: 'Name', placeholder: 'studio', disabled: true } }).body)).toMatch(
      /placeholder="studio" disabled=""/,
    )
  })

  it('stops iOS from correcting a URL', () => {
    expect(input(field({ label: 'Machine code', url: true }))).toContain(
      'autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url"',
    )
  })

  it.each([
    'min-height: 44px;',
    'border: 1px solid var(--edge);',
    'border-radius: var(--radius-control);',
    'background: var(--field);',
    'font-size: 16px;',
    '-webkit-user-select: text; user-select: text;',
    '.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 32%, transparent); }',
  ])('holds %s', (text) => {
    expect(flat(fieldSource)).toContain(text)
  })
})

describe('SearchField', () => {
  const body = render(SearchField, { props: { label: 'Search issues', value: 'pay' } }).body

  it('draws the search icon before a search input named and hinted by its label', () => {
    expect(body).toMatch(/<label class="search svelte-[\w-]+"><svg [^>]*width="18"[^]*?<\/svg>(?:<!--[^>]*-->| )*<input /)
    expect(body).toMatch(
      /<input class="query svelte-[\w-]+" type="search" aria-label="Search issues" placeholder="Search issues"/,
    )
    expect(body).toContain('value="pay"')
  })

  it('stops iOS from correcting or completing the query, and offers Search on the return key', () => {
    expect(body).toContain(
      'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"',
    )
  })

  it('binds its value and passes each input on', () => {
    expect(searchFieldSource).toContain("value = $bindable('')")
    expect(flat(searchFieldSource)).toContain('bind:this={field} bind:value {oninput}')
  })

  it('offers no Cancel without oncancel, even with text', () => {
    expect(body).not.toContain('Cancel')
  })

  it('offers a text Cancel beside the field when it can be cancelled', () => {
    const cancelled = render(SearchField, { props: { label: 'Search agents', value: 'pay', oncancel: () => {} } }).body
    expect(cancelled).toMatch(/<\/label> (?:<!--[^>]*-->)*<button class="cancel svelte-[\w-]+" type="button">Cancel<\/button>/)
  })

  it.each([
    'min-height: 44px; padding: 0 12px; border: 1px solid var(--edge);',
    '.search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 32%, transparent); }',
    'font-size: 16px;',
    '-webkit-user-select: text; user-select: text;',
    '.query::placeholder { color: var(--muted); }',
    '.bar { display: flex; align-items: center; gap: var(--gap); }',
    '.cancel { flex: none; min-height: 44px; padding: 0 4px; border: none; background: none; color: var(--accent);',
  ])('holds %s', (text) => {
    expect(flat(searchFieldSource)).toContain(text)
  })
})

describe('Labelled', () => {
  const labelled = (control: boolean) =>
    render(Labelled, { props: { id: 'f', label: 'Agent', error: 'Choose one', control, children: html('<i>x</i>') } })
      .body

  it('labels its control above it and shows the error under it', () => {
    expect(labelled(true)).toMatch(
      /<div class="field svelte-[\w-]+"><!--\[0--><label class="label svelte-[\w-]+" for="f-input">Agent<\/label><!--]--> <i>x<\/i><!----> <p class="error svelte-[\w-]+" id="f-error">Choose one<\/p><\/div>/,
    )
  })

  it('names what is there without a label when there is no control to point at', () => {
    expect(labelled(false)).toMatch(/<p class="label svelte-[\w-]+">Agent<\/p><!--]--> <i>x<\/i>/)
  })

  it.each([
    '.field { display: flex; flex-direction: column; gap: 6px; }',
    '.label { margin: 0; color: var(--soft); font-size: 13px; font-weight: 500; }',
    '.error { min-height: 16px; margin: 0; color: var(--failed); font-size: 13px; line-height: 16px; }',
  ])('holds %s', (text) => {
    expect(flat(labelledSource)).toContain(text)
  })
})

describe('TextArea', () => {
  type Props = {
    label: string
    value?: string
    error?: string | null
    disabled?: boolean
    placeholder?: string
    bare?: boolean
  }
  const area = (props: Props) => render(TextArea, { props }).body
  const textarea = (body: string) => body.match(/<textarea [^>]*>/)?.[0] ?? ''

  it('shows its value, one line high, named for readers', () => {
    expect(area({ label: 'Message', value: 'two\nlines' })).toMatch(
      /<div class="grow svelte-[\w-]+ framed" data-value="two\nlines"><textarea class="area svelte-[\w-]+" rows="1" aria-label="Message">two\nlines<\/textarea><\/div>/,
    )
  })

  it('passes textarea attributes on', () => {
    expect(area({ label: 'Reply', placeholder: 'Write to codex', disabled: true })).toMatch(
      /<textarea [^>]*aria-label="Reply" placeholder="Write to codex" disabled="">/,
    )
  })

  it('binds its value', () => {
    expect(textAreaSource).toContain('value = $bindable(\'\')')
    expect(flat(textAreaSource)).toContain('bind:value ></textarea>')
  })

  it('shows its label above it and keeps an empty slot for the error in a form', () => {
    const body = area({ label: 'Prompt', value: 'fix it', error: null })
    const id = body.match(/<label class="label svelte-[\w-]+" for="([\w-]+)">Prompt<\/label>/)?.[1]
    expect(textarea(body)).toContain(`id="${id}"`)
    expect(textarea(body)).not.toMatch(/aria-label|aria-invalid|aria-describedby/)
    expect(body).toMatch(/data-value="fix it"><textarea [^>]*>fix it<\/textarea>/)
    expect(body).toMatch(/<\/div><!----> <p class="error svelte-[\w-]+" id="[\w-]+"><\/p><\/div>/)
  })

  it('points the textarea at the error it shows', () => {
    const body = area({ label: 'Prompt', error: 'Write what the agent should do' })
    const id = body.match(/<p class="error svelte-[\w-]+" id="([\w-]+)">Write what the agent should do<\/p>/)?.[1]
    expect(textarea(body)).toContain(`aria-invalid="true" aria-describedby="${id}"`)
  })

  it('shows no label and no error outside a form', () => {
    expect(area({ label: 'Answer' })).not.toMatch(/<label|<p class="error/)
  })

  it('leaves Return to the textarea, which adds a line, and sends nothing on a key', () => {
    expect(textAreaSource).not.toMatch(/keydown|keyup|keypress|submit/i)
  })

  it.each([
    '.grow { display: grid;',
    "content: attr(data-value) ' '; visibility: hidden; overflow: hidden; white-space: pre-wrap;",
    'grid-area: 1 / 1;',
    'min-height: 44px; max-height: 152px;',
    'overflow-y: auto; resize: none;',
    'font-size: 16px;',
    '-webkit-user-select: text; user-select: text;',
    '.area:focus { border-color: var(--accent);',
  ])('holds %s', (text) => {
    expect(flat(textAreaSource)).toContain(text)
  })

  it('drops its frame when bare, and still grows from its value', () => {
    expect(area({ label: 'Answer', value: 'hi', bare: true })).toMatch(
      /<div class="grow svelte-[\w-]+" data-value="hi"><textarea class="area svelte-[\w-]+" rows="1" aria-label="Answer">/,
    )
  })

  it.each([
    '.area, .grow::after { grid-area: 1 / 1; box-sizing: border-box; min-height: 44px; max-height: 152px; padding: 11px 4px; border: none; font: inherit; font-size: 16px;',
    '.framed .area, .framed::after { padding: 10px 12px; border: 1px solid var(--edge); }',
    '.area { overflow-y: auto; resize: none; outline: none; background: none;',
    '.framed .area { border-radius: var(--radius-control); background: var(--field); }',
    '.framed .area:focus { border-color: var(--accent); box-shadow:',
  ])('keeps its border, fill and focus ring to the framed field, with %s', (text) => {
    expect(flat(textAreaSource)).toContain(text)
  })
})

describe('Emblem', () => {
  const body = render(Emblem, {
    props: { icon: 'server', title: 'No machines yet', lines: ['First line.', 'Second line.'] },
  }).body

  it('draws the icon in its disc', () => {
    expect(body).toMatch(/<div class="disc svelte-[\w-]+"><svg [^>]*width="24" height="24"/)
    expect(emblemSource).toMatch(/\.disc \{[^}]*width: 52px;\s*height: 52px;/)
  })

  it('writes the title and each line', () => {
    expect(body).toMatch(/<h2 class="title svelte-[\w-]+">No machines yet<\/h2>/)
    const lines = [...body.matchAll(/<p class="line svelte-[\w-]+">([^<]*)<\/p>/g)].map((match) => match[1])
    expect(lines).toEqual(['First line.', 'Second line.'])
  })

  it.each([
    'border: 1px solid rgb(43 123 255 / 0.35);',
    'background: rgb(0 95 255 / 0.16);',
    'color: var(--accent);',
    'gap: 10px;',
    'padding: 40px var(--inset-card) var(--inset-card);',
    'max-width: 470px;',
    'color: var(--muted);',
  ])('holds %s', (text) => {
    expect(flat(emblemSource)).toContain(text)
  })
})

describe('Spinner', () => {
  it('draws the loader circle at 12 px, hidden from readers', () => {
    const body = render(Spinner).body
    expect(body).toMatch(/<span class="spinner svelte-[\w-]+" aria-hidden="true"><svg [^>]*width="12" height="12"/)
    expect(body).toContain('<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>')
  })

  it.each([
    'animation: turn 900ms linear infinite;',
    '@keyframes turn { to { transform: rotate(360deg); } }',
    '@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }',
  ])('holds %s', (text) => {
    expect(flat(spinnerSource)).toContain(text)
  })
})

describe('Icon', () => {
  it.each([
    ['scan-qr-code', 'M17 12v4a1 1 0 0 1-1 1h-4', '<rect x="7" y="7" width="5" height="5" rx="1"></rect>'],
    ['chevron-left', 'm15 18-6-6 6-6', ''],
    ['chevron-up', 'm18 15-6-6-6 6', ''],
    ['chevron-down', 'm6 9 6 6 6-6', ''],
    ['chevron-right', 'm9 18 6-6-6-6', ''],
    ['trash-2', 'M3 6h18', '<line x1="14" y1="11" x2="14" y2="17"></line>'],
    ['check', 'M20 6 9 17l-5-5', ''],
    ['plus', 'M5 12h14', '<path d="M12 5v14"></path>'],
    ['pencil', 'm15 5 4 4', ''],
    ['rotate-ccw', 'M3 3v5h5', ''],
    ['smartphone', 'M12 18h.01', '<rect x="5" y="2" width="14" height="20" rx="2"></rect>'],
    ['maximize-2', 'M15 3h6v6', '<line x1="3" y1="21" x2="10" y2="14"></line>'],
    ['square-check', 'm9 12 2 2 4-4', '<rect x="3" y="3" width="18" height="18" rx="2"></rect>'],
    ['square-terminal', 'm7 11 2-2-2-2', '<rect x="3" y="3" width="18" height="18" rx="2"></rect>'],
    ['git-compare', 'M13 6h3a2 2 0 0 1 2 2v7', '<circle cx="18" cy="18" r="3"></circle>'],
    ['x', 'M18 6 6 18', '<path d="m6 6 12 12"></path>'],
    ['keyboard', 'M7 16h10', '<rect x="2" y="4" width="20" height="16" rx="2"></rect>'],
  ] as const)('draws %s', (name, path, other) => {
    const body = render(Icon, { props: { name } }).body
    expect(body).toContain(`<path d="${path}"></path>`)
    expect(body).toContain(other)
  })

  it('draws circle-alert with a circle and two lines, and no path', () => {
    const body = render(Icon, { props: { name: 'circle-alert' } }).body
    expect(body).toContain('<circle cx="12" cy="12" r="10"></circle>')
    expect(body).toContain('<line x1="12" y1="8" x2="12" y2="12"></line>')
    expect(body).toContain('<line x1="12" y1="16" x2="12.01" y2="16"></line>')
    expect(body).not.toContain('<path')
  })
})

describe('scanning', () => {
  it('lets the camera show through the page and drops the top glow', () => {
    expect(flat(baseSource)).toContain('html.scanning, html.scanning body { background: transparent; }')
    expect(flat(baseSource)).toContain('html.scanning body::before { display: none; }')
  })

  it('hides the app while scanning, so only the layer over the camera shows', () => {
    expect(flat(baseSource)).toContain('html.scanning #app { visibility: hidden; }')
  })
})
