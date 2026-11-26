<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { elapsed } from '../../lib/board'
  import type { Chat, Outgoing } from '../../lib/chat.svelte'
  import { fromEnd, keepFromEnd } from '../../lib/fromEnd'
  import type { AgentEntry } from '../../lib/history'
  import { under } from '../../lib/reveal'
  import { atEnd, landingAfter, lastAnswer, readingNote, sentAnew, startTop, threadOf, type Landing } from '../../lib/thread'
  import Markdown from '../../lib/ui/Markdown.svelte'
  import AgentLine from './AgentLine.svelte'
  import Sent from './Sent.svelte'

  let {
    chat,
    now,
    boxed = false,
    drop = 0,
    bar = null,
  }: { chat: Chat; now: number; boxed?: boolean; drop?: number; bar?: HTMLElement | null } = $props()

  const bubbles = $derived(threadOf(chat.conversation, chat.outgoing !== null))
  const note = $derived(readingNote(chat.reading))

  let box = $state<HTMLElement>()
  let tall = $state(0)
  const messages: Record<number, HTMLElement | null> = {}

  const scroller = () => (boxed && box !== undefined ? box : document.documentElement)

  const toEnd = () => {
    const scrolling = scroller()
    scrolling.scrollTo({ top: scrolling.scrollHeight })
  }

  const ending = () => {
    const { scrollTop, clientHeight, scrollHeight } = scroller()
    return atEnd(scrollTop, clientHeight, scrollHeight)
  }

  const seenTop = () => {
    const view = boxed && box !== undefined ? box.getBoundingClientRect() : { top: 0, bottom: innerHeight }
    return under(view, bar?.getBoundingClientRect() ?? null).top
  }

  const toStart = (answer: AgentEntry) => {
    const message = messages[answer.id]
    if (message === undefined || message === null) {
      toEnd()
      return
    }
    const scrolling = scroller()
    const { scrollTop, scrollHeight, clientHeight } = scrolling
    const start = scrollTop + message.getBoundingClientRect().top - drop - seenTop()
    scrolling.scrollTo({ top: startTop(scrollTop, scrollHeight - clientHeight, start) })
  }

  const land = (landing: Landing, answer: AgentEntry | null) => {
    if (landing === 'end') {
      void tick().then(toEnd)
    } else if (landing === 'start' && answer !== null) {
      void tick().then(() => toStart(answer))
    }
  }

  let drawn = false
  let shownSend: Outgoing | null = null
  let shownAnswer: AgentEntry | null = null
  let wasBoxed = untrack(() => boxed)
  let pinned = true
  let left = 0

  const scrolled = () => {
    pinned = ending()
    left = fromEnd(scroller())
  }

  $effect.pre(() => {
    void chat.reading
    const outgoing = chat.outgoing
    const answer = lastAnswer(chat.conversation)
    const was = drawn
    drawn = chat.conversation.length > 0
    const sent = sentAnew(shownSend, outgoing)
    const fresh = answer !== null && answer !== shownAnswer
    shownSend = outgoing
    shownAnswer = answer
    if (drawn) {
      land(landingAfter({ opened: !was, sent, pinned: untrack(ending), fresh }), answer)
    }
  })

  $effect(() => {
    void tall
    if (boxed === wasBoxed && !(boxed && pinned)) return
    const closing = wasBoxed && !boxed
    wasBoxed = boxed
    if (closing && !pinned) keepFromEnd(scroller(), left)
    else toEnd()
  })
</script>

<div class="thread" class:boxed bind:this={box} bind:clientHeight={tall} onscroll={scrolled}>
  <div class="entries" style:transform={drop > 0 ? `translateY(${drop}px)` : undefined}>
    {#each bubbles as { entry, live, going } (entry.id)}
      {#if entry.kind === 'you'}
        <Sent {entry} chat={live ? chat : null} />
      {:else if entry.kind === 'agent'}
        {@const written = elapsed(entry.written, now)}
        <article class="message" bind:this={messages[entry.id]}>
          {#if written !== ''}
            <p class="written">{written}</p>
          {/if}
          <Markdown text={entry.text} />
          {#if going}
            <p class="going">More to come…</p>
          {/if}
        </article>
      {:else}
        <p class="gap">Earlier messages are on the machine</p>
      {/if}
    {/each}
    {#if note !== null}
      <p class="reason">{note}</p>
    {/if}
    <AgentLine {chat} {now} />
    {#if boxed}
      <div class="room"></div>
    {/if}
  </div>
</div>

<style>
  .thread {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: var(--inset-wide);
    min-width: 0;
  }

  .boxed {
    min-height: 0;
    margin-bottom: -100vh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .boxed .entries {
    will-change: transform;
  }

  .room {
    flex: none;
    height: calc(100vh - var(--inset-wide));
  }

  .message {
    min-width: 0;
  }

  .written,
  .going {
    color: var(--muted);
    font-size: 13px;
  }

  .written {
    margin: 0 0 var(--gap);
  }

  .going {
    margin: var(--gap) 0 0;
  }

  .reason {
    margin: 0;
    color: var(--muted);
  }

  .gap {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }
</style>
