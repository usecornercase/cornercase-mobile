<script lang="ts">
  import type { InputEvent, StickyCtrl } from './keys'
  import { SENTINEL, Typing, type Step } from './typing'

  let {
    ctrl,
    send,
    disabled = false,
  }: {
    ctrl: StickyCtrl
    send: (events: InputEvent[]) => void
    disabled?: boolean
  } = $props()

  const PLAIN = {
    autocapitalize: 'off',
    autocorrect: 'off',
    autocomplete: 'off',
    spellcheck: false,
  } as const

  const typing = $derived(new Typing(ctrl))

  let textarea: HTMLTextAreaElement | undefined

  export const focus = () => textarea?.focus({ preventScroll: true })

  export const take = (event: KeyboardEvent) => {
    focus()
    run(event, typing.stray(event))
  }

  const restore = (field: HTMLTextAreaElement) => {
    field.value = SENTINEL
    field.setSelectionRange(SENTINEL.length, SENTINEL.length)
  }

  const run = (event: Event, step: Step) => {
    if (step.prevent) event.preventDefault()
    if (!disabled && step.send.length > 0) send(step.send)
    if (step.restore && event.currentTarget instanceof HTMLTextAreaElement) restore(event.currentTarget)
  }
</script>

<textarea
  bind:this={textarea}
  class="typist"
  aria-label="Terminal input"
  rows="1"
  value={SENTINEL}
  {...PLAIN}
  {disabled}
  onkeydown={(event) => run(event, typing.keydown(event))}
  onkeyup={() => typing.keyup()}
  onbeforeinput={(event) => run(event, typing.beforeinput(event))}
  oncompositionstart={() => typing.compositionstart()}
  oncompositionend={(event) => run(event, typing.compositionend(event.data))}
></textarea>

<style>
  .typist {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    resize: none;
    opacity: 0;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    font-size: 16px;
    pointer-events: none;
    -webkit-user-select: text;
    user-select: text;
  }
</style>
