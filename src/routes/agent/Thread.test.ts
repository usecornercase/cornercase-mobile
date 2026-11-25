import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { HistoryEntry_Serialize as Entry } from '../../lib/bindings'
import { Chat, timers, type Outgoing } from '../../lib/chat.svelte'
import { message, ok } from '../../lib/chatFakes'
import { LATER, ROW, SINCE, chatWith, clockAt, flat, lineChat, still, unasked, unattached, unkept, unmarked, unpressed, unread, unsent } from './agentFakes'
import AgentLine from './AgentLine.svelte'
import agentLineSource from './AgentLine.svelte?raw'
import Sent from './Sent.svelte'
import sentSource from './Sent.svelte?raw'
import Thread from './Thread.svelte'
import threadSource from './Thread.svelte?raw'

type You = Extract<Entry, { kind: 'you' }>

const outgoing = (state: Outgoing['state'], fields: Partial<Outgoing> = {}): Outgoing => ({
  text: 'what is wrong here?',
  chips: [],
  state,
  reason: state === 'failed' ? 'nothing was sent' : null,
  ...fields,
})

const yours = (id: number, state: You['state'], fields: Partial<You> = {}): You => ({
  kind: 'you',
  id,
  text: 'what is wrong here?',
  chips: [],
  state,
  reason: state === 'failed' ? 'nothing was sent' : null,
  seen: SINCE,
  ...fields,
})

const bubble = (entry: You, chat: Chat | null = chatWith({ ...ROW, status: 'done' })) => {
  if (chat !== null) {
    chat.outgoing = outgoing(entry.state, { text: entry.text, reason: entry.reason })
  }
  return render(Sent, { props: { entry, chat } }).body
}

const action = (body: string, name: string) =>
  body.match(new RegExp(`<button class="([^"]*)" type="button"([^>]*)>((?:(?!</button>)[^])*)${name}(?:<!---->|\\s)*</button>`))

describe('Sent', () => {
  it('shows the text in a bubble while it is sending, named as your message, with no actions', () => {
    const body = bubble(yours(1, 'sending'))
    expect(body).toMatch(/<article class="sent svelte-[\w-]+" aria-label="Your message, sending">/)
    expect(body).toMatch(/<p class="text svelte-[\w-]+">what is wrong here\?<\/p>/)
    expect(body).toMatch(/<p class="state svelte-[\w-]+"><span class="spinner[^]*?<\/span>(?:<!---->)?Sending…<\/p>/)
    expect(body).not.toContain('Retry')
    expect(body).not.toContain('Edit')
    expect(body).not.toContain('<ul')
  })

  it('says it was sent with a check, and offers nothing', () => {
    const body = bubble(yours(1, 'sent'))
    expect(body).toContain('aria-label="Your message, sent"')
    expect(body).toMatch(/<p class="state svelte-[\w-]+"><svg[^]*?<path d="M20 6 9 17l-5-5"><\/path>[^]*?<\/svg>(?:<!---->)?Sent<\/p>/)
    expect(body).not.toContain('class="spinner')
    expect(body).not.toContain('<button')
  })

  it('says why it was not sent and offers Retry and Edit, of 44 px, with their icons', () => {
    const body = bubble(yours(1, 'failed', { reason: 'it may have been sent, but no answer came back' }))
    expect(body).toContain('aria-label="Your message, not sent"')
    expect(body).toMatch(
      /<p class="state failed svelte-[\w-]+"><svg[^]*?<circle cx="12" cy="12" r="10"><\/circle>[^]*?<\/svg>(?:<!---->)?Not sent: it may have been sent, but no answer came back<\/p>/,
    )
    expect(action(body, 'Retry')?.[1]).toMatch(/^button plain svelte-[\w-]+$/)
    expect(action(body, 'Retry')?.[2]).toBe('')
    expect(action(body, 'Retry')?.[3]).toContain('<path d="M3 3v5h5"></path>')
    expect(action(body, 'Edit')?.[1]).toMatch(/^button plain svelte-[\w-]+$/)
    expect(action(body, 'Edit')?.[3]).toContain('<path d="m15 5 4 4"></path>')
    expect(body.indexOf('Not sent')).toBeLessThan(body.indexOf('Retry'))
    expect(body.indexOf('Retry')).toBeLessThan(body.indexOf('Edit'))
  })

  it('rests Retry while it cannot go, and leaves Edit', () => {
    const body = bubble(yours(1, 'failed'), chatWith(ROW))
    expect(action(body, 'Retry')?.[1]).toMatch(/^button plain svelte-[\w-]+ resting$/)
    expect(action(body, 'Retry')?.[2]).toBe(' disabled="" aria-disabled="true"')
    expect(action(body, 'Edit')?.[2]).toBe('')
  })

  it('shows the names of the images that went with it, even the same name twice', () => {
    const body = bubble(yours(1, 'sent', { chips: ['IMG_0042.jpg', 'pasted.png', 'pasted.png'] }))
    const names = [...body.matchAll(/<li class="chip svelte-[\w-]+">([^<]*)<\/li>/g)].map((found) => found[1])
    expect(names).toEqual(['IMG_0042.jpg', 'pasted.png', 'pasted.png'])
    expect(body.indexOf('what is wrong here?')).toBeLessThan(body.indexOf('IMG_0042.jpg'))
  })

  it('shows only the chips when only an image went', () => {
    const body = bubble(yours(1, 'sending', { text: '', chips: ['IMG_0042.jpg'] }))
    expect(body).not.toContain('class="text')
    expect(body).toMatch(/<div class="bubble svelte-[\w-]+">(?:<!--[^>]*-->|\s)*<ul class="chips svelte-[\w-]+">/)
    expect(body).toContain('IMG_0042.jpg')
  })

  it('says why an earlier message was not sent, with nothing to do about it', () => {
    const body = bubble(yours(1, 'failed', { reason: 'pane 12 is waiting' }), null)
    expect(body).toContain('aria-label="Your message, not sent"')
    expect(body).toMatch(/<p class="state failed svelte-[\w-]+"><svg[^]*?<\/svg>(?:<!---->)?Not sent: pane 12 is waiting<\/p>/)
    expect(body).not.toContain('<button')
  })

  it('says a message not sent for no known reason is not sent', () => {
    expect(bubble(yours(1, 'failed', { reason: null }), null)).toMatch(/(?:<!---->)?Not sent<\/p>/)
  })

  it('says a message the chat closed on while sending was not confirmed, with no spinner and nothing to do', () => {
    const body = bubble(yours(1, 'sending'), null)
    expect(body).toContain('aria-label="Your message, not confirmed"')
    expect(body).toMatch(
      /<p class="state svelte-[\w-]+"><svg[^]*?<circle cx="12" cy="12" r="10"><\/circle>[^]*?<\/svg>(?:<!---->)?Not confirmed: the chat closed before an answer came back<\/p>/,
    )
    expect(body).not.toContain('class="spinner')
    expect(body).not.toContain('<button')
  })

  it('shows an earlier message that went as sent', () => {
    expect(bubble(yours(1, 'sent'), null)).toContain('aria-label="Your message, sent"')
  })

  it('retries and edits through the chat, keeping the text as it was written', () => {
    expect(flat(sentSource)).toContain('resting={!chat.canRetry} onclick={() => void chat.retry()}>')
    expect(flat(sentSource)).toContain('onclick={() => chat.edit()}>')
    expect(flat(sentSource)).toContain('.text { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }')
  })

  it('sits on the right', () => {
    expect(flat(sentSource)).toContain('align-items: flex-end;')
    expect(flat(sentSource)).toContain('align-self: flex-end;')
  })
})

const line = (chat: Chat, now = LATER) => render(AgentLine, { props: { chat, now } }).body

const region = (body: string) => body.match(/<p class="said svelte-[\w-]+" aria-live="polite">([^]*?)<\/p>/)?.[1]

const phrase = (text: string) => `<span class="phrase">${text}</span>`

describe('AgentLine', () => {
  it('says a working agent works, with its orbit and the time since it started outside the region', () => {
    const body = line(lineChat('working'))
    expect(body).toMatch(/<div class="line working svelte-[\w-]+">/)
    expect(body).toContain('aria-label="Working"')
    expect(body).toMatch(/<g class="orbit svelte-[\w-]+">/)
    expect(region(body)).toContain(phrase('claude is working…'))
    expect(region(body)).not.toContain('3 min')
    expect(body).toMatch(/<\/p> (?:<!--[^>]*-->)*<span class="time svelte-[\w-]+">· 3 min<\/span>/)
  })

  it('says a shell agent waits for a background command, timed and orbiting too', () => {
    const body = line(lineChat('shell'))
    expect(body).toMatch(/<g class="orbit svelte-[\w-]+">/)
    expect(region(body)).toContain(phrase('claude is waiting for a background command…'))
    expect(body).toMatch(/<span class="time svelte-[\w-]+">· 3 min<\/span>/)
  })

  it('shows no time when the start is not known', () => {
    const body = line(lineChat('working', null))
    expect(region(body)).toContain(phrase('claude is working…'))
    expect(body).not.toContain('class="time')
  })

  it('says a waiting agent waits for your answer, untimed', () => {
    const body = line(lineChat('waiting'))
    expect(body).toMatch(/<div class="line waiting svelte-[\w-]+">/)
    expect(region(body)).toContain(phrase('claude is waiting for your answer'))
    expect(body).not.toContain('class="time')
  })

  it('says a failed agent stopped, in the failure tone', () => {
    const body = line(lineChat('failed'))
    expect(body).toMatch(/<div class="line failed svelte-[\w-]+">/)
    expect(body).toContain('aria-label="Failed"')
    expect(region(body)).toContain(phrase('claude stopped with an error'))
    expect(flat(agentLineSource)).toContain('.failed { color: var(--failed); }')
  })

  it('mutes a working agent with no news for two minutes, and keeps the minutes out of the region', () => {
    const body = line(lineChat('working', ROW.since, clockAt(SINCE).clock), SINCE + 2 * 60_000)
    expect(body).toMatch(/<div class="line muted svelte-[\w-]+">/)
    expect(region(body)).toContain(phrase('claude is working… · no news'))
    expect(region(body)).not.toContain('min')
    expect(body).toMatch(/<span class="time svelte-[\w-]+">for 2 min · Ctrl-C interrupts<\/span>/)
    expect(flat(agentLineSource)).toContain('.muted, .muted .time { color: var(--muted); }')
  })

  it('keeps working one moment before two minutes without news', () => {
    expect(line(lineChat('working', ROW.since, clockAt(SINCE).clock), SINCE + 2 * 60_000 - 1)).toMatch(/<div class="line working svelte-[\w-]+">/)
  })

  it.each(['done', 'idle', 'pending', null])('draws nothing for a %o agent but keeps the region, hidden', (status) => {
    const body = line(lineChat(status))
    expect(body).toMatch(/<div class="line {2}svelte-[\w-]+ spoken">/)
    expect(body).not.toContain('<svg')
    expect(body).not.toContain('class="phrase"')
    expect(region(body)).toBe('<span class="spoken"></span> <!--[-1--><!--]-->')
  })

  it('keeps the region while the agent is not seen yet', () => {
    const chat = new Chat(1, ROW.pane, unread, unsent, unpressed, unmarked, unattached, still, timers, unasked, unkept)
    expect(region(line(chat))).toBe('<span class="spoken"></span> <!--[-1--><!--]-->')
  })

  it.each([
    [outgoing('sending'), 'Sending'],
    [outgoing('sent'), 'Sent'],
    [outgoing('failed', { reason: 'the agent is gone' }), 'Not sent: the agent is gone'],
  ])('says what happened to your message in the same region', (shown, news) => {
    const chat = lineChat('working')
    chat.outgoing = shown
    expect(region(line(chat))).toContain(`<span class="spoken">${news}</span> <!--[0-->${phrase('claude is working…')}`)
  })
})

const agentSaid = (id: number, text: string, fields: Partial<AgentEntry> = {}): AgentEntry => ({
  kind: 'agent',
  id,
  text,
  written: null,
  turn_over: true,
  seen: SINCE,
  ...fields,
})

type AgentEntry = Extract<Entry, { kind: 'agent' }>

const GAP: Entry = { kind: 'gap', id: 0, seen: SINCE }

const ASKED = agentSaid(1, 'Shall I run the migration?', { written: '2026-11-09T11:30:00.000Z' })

const threadChat = (conversation: Entry[], sent: Outgoing | null = null, reading: Chat['reading'] = { kind: 'message', message: message('Migrated.') }) => {
  const chat = lineChat('working')
  chat.conversation = conversation
  chat.outgoing = sent
  chat.reading = reading
  return chat
}

const thread = (chat: Chat) => render(Thread, { props: { chat, now: LATER } }).body

const at = (body: string, mark: string) => {
  expect(body).toContain(mark)
  return body.indexOf(mark)
}

const count = (body: string, mark: string) => body.split(mark).length - 1

describe('Thread', () => {
  it('shows the conversation in the order the phone saw it, then the line', () => {
    const conversation = [GAP, ASKED, yours(2, 'sent', { text: 'yes, run it' }), agentSaid(3, 'Migrated.')]
    const body = thread(threadChat(conversation))
    const marks = [
      'Earlier messages are on the machine',
      'Shall I run the migration?',
      'yes, run it',
      'Migrated.',
      '<p class="said',
    ]
    const places = marks.map((mark) => at(body, mark))
    expect(places).toEqual([...places].sort((one, other) => one - other))
    expect(count(body, '<article class="message')).toBe(2)
    expect(count(body, '<article class="sent')).toBe(1)
  })

  it('draws the gap as a muted line of its own', () => {
    const body = thread(threadChat([GAP, ASKED]))
    expect(body).toMatch(/<p class="gap svelte-[\w-]+">Earlier messages are on the machine<\/p>/)
    expect(flat(threadSource)).toContain('.gap { margin: 0; color: var(--muted); font-size: 13px; text-align: center; }')
  })

  it('draws each message of the agent as markdown, each with the time it was written', () => {
    const conversation = [GAP, ASKED, agentSaid(2, 'Tests **pass**.', { written: '2026-11-09T11:38:00.000Z' })]
    const body = thread(threadChat(conversation))
    expect([...body.matchAll(/<p class="written svelte-[\w-]+">([^<]*)<\/p>/g)].map((found) => found[1])).toEqual([
      '13 min',
      '5 min',
    ])
    expect(body).toContain('<strong')
  })

  it('marks only the last message of the agent whose turn is not over, quietly, after its text', () => {
    const conversation = [GAP, { ...ASKED, turn_over: false }, agentSaid(2, 'Writing it', { turn_over: false })]
    const body = thread(threadChat(conversation))
    expect(count(body, 'More to come…')).toBe(1)
    expect(body).toMatch(/<p class="going svelte-[\w-]+">More to come…<\/p>/)
    expect(at(body, 'Writing it')).toBeLessThan(at(body, 'More to come…'))
    expect(flat(threadSource)).toContain('.written, .going { color: var(--muted); font-size: 13px; }')
  })

  it.each([true, null])('leaves the mark out when the last turn is %o', (turnOver) => {
    const body = thread(threadChat([GAP, { ...ASKED, turn_over: false }, agentSaid(2, 'Done.', { turn_over: turnOver })]))
    expect(body).not.toContain('More to come')
  })

  it('offers Retry and Edit only on your last message, while the chat sent it', () => {
    const conversation = [GAP, yours(1, 'failed'), ASKED, yours(3, 'failed')]
    expect(count(thread(threadChat(conversation, outgoing('failed'))), 'Retry')).toBe(1)
    expect(thread(threadChat(conversation))).not.toContain('Retry')
  })

  it('shows a send the chat closed on as not confirmed', () => {
    expect(thread(threadChat([GAP, ASKED, yours(2, 'sending')]))).toContain(
      'Not confirmed: the chat closed before an answer came back',
    )
  })

  it('shows your message sending while the chat sends it', () => {
    expect(thread(threadChat([GAP, ASKED, yours(2, 'sending')], outgoing('sending')))).toContain('Sending…')
  })

  it.each<[string, Chat['reading'], string]>([
    ['that it is reading', { kind: 'loading' }, 'Reading its last message…'],
    ['why it cannot read', { kind: 'unreadable', reason: 'no message yet' }, 'no message yet'],
  ])('says %s after the conversation, muted, above the line', (_, reading, text) => {
    const body = thread(threadChat([GAP, ASKED, yours(2, 'sent', { text: 'yes, run it' })], null, reading))
    expect(body).toMatch(new RegExp(`<p class="reason svelte-[\\w-]+">${text}</p>`))
    expect(at(body, 'yes, run it')).toBeLessThan(at(body, text))
    expect(at(body, text)).toBeLessThan(at(body, '<p class="said'))
  })

  it('says nothing of the reading once a message is read', () => {
    expect(thread(threadChat([GAP, ASKED]))).not.toContain('class="reason')
  })

  it('replaces a growing message in its place, without reading it again from the start', async () => {
    const said = ['Reading thread.ts', 'Reading thread.ts and chat.svelte.ts']
    const chat = new Chat(1, ROW.pane, () => Promise.resolve(ok({ ...message(said.shift() ?? ''), turn_over: false })), unsent, unpressed, unmarked, unattached, still, timers, unasked, unkept)
    chat.see(1, [{ ...ROW, status: 'working' }])
    await chat.refresh()
    expect(thread(chat)).toContain('Reading thread.ts')
    await chat.refresh()
    const body = thread(chat)
    expect(body).toContain('Reading thread.ts and chat.svelte.ts')
    expect(count(body, '<article class="message')).toBe(1)
    expect(body).not.toContain('Reading its last message…')
    expect(threadSource).not.toContain('{#key')
  })

  it('keys each entry by its id, so a growing message keeps its place', () => {
    expect(flat(threadSource)).toContain('{#each bubbles as { entry, live, going } (entry.id)}')
  })

  it("lands once drawn by the change: the end on opening and after a send, a new answer's start at the end, else the end, or nowhere away from it", () => {
    const source = flat(threadSource)
    expect(source).toContain(
      '$effect.pre(() => { void chat.reading const outgoing = chat.outgoing const answer = lastAnswer(chat.conversation) const was = drawn drawn = chat.conversation.length > 0 const sent = sentAnew(shownSend, outgoing) const fresh = answer !== null && answer !== shownAnswer shownSend = outgoing shownAnswer = answer if (drawn) { land(landingAfter({ opened: !was, sent, pinned: untrack(ending), fresh }), answer) } })',
    )
    expect(source).toContain(
      "const land = (landing: Landing, answer: AgentEntry | null) => { if (landing === 'end') { void tick().then(toEnd) } else if (landing === 'start' && answer !== null) { void tick().then(() => toStart(answer)) } }",
    )
    expect(source).toContain('const toEnd = () => { const scrolling = scroller() scrolling.scrollTo({ top: scrolling.scrollHeight }) }')
    expect(source).toContain(
      'const ending = () => { const { scrollTop, clientHeight, scrollHeight } = scroller() return atEnd(scrollTop, clientHeight, scrollHeight) }',
    )
  })

  it("puts a message's start under the bar, or the box's top, never past the end nor back up, and goes to the end without it", () => {
    const source = flat(threadSource)
    expect(source).toContain(
      'const seenTop = () => { const view = boxed && box !== undefined ? box.getBoundingClientRect() : { top: 0, bottom: innerHeight } return under(view, bar?.getBoundingClientRect() ?? null).top }',
    )
    expect(source).toContain(
      'const toStart = (answer: AgentEntry) => { const message = messages[answer.id] if (message === undefined || message === null) { toEnd() return } const scrolling = scroller() const { scrollTop, scrollHeight, clientHeight } = scrolling const start = scrollTop + message.getBoundingClientRect().top - drop - seenTop() scrolling.scrollTo({ top: startTop(scrollTop, scrollHeight - clientHeight, start) }) }',
    )
    expect(source).toContain('<article class="message" bind:this={messages[entry.id]}>')
  })

  it('draws without the bar, which it only measures', () => {
    expect(flat(threadSource)).toContain('bar = null,')
    expect(thread(chatWith(ROW))).toMatch(/<div class="thread svelte-[\w-]+">/)
  })

  it('scrolls the page while the keyboard is closed, and itself while it is open', () => {
    expect(flat(threadSource)).toContain(
      'const scroller = () => (boxed && box !== undefined ? box : document.documentElement)',
    )
    expect(flat(threadSource)).toContain('.boxed { min-height: 0; margin-bottom: -100vh; overflow-y: auto; overscroll-behavior: contain; }')
    expect(thread(chatWith(ROW))).toMatch(/<div class="thread svelte-[\w-]+">/)
    expect(render(Thread, { props: { chat: chatWith(ROW), now: LATER, boxed: true } }).body).toMatch(
      /<div class="thread svelte-[\w-]+ boxed">/,
    )
  })

  it('goes to its end as the keyboard opens, and as its box changes height while open only if it was at its end', () => {
    const source = flat(threadSource)
    expect(source).toContain('let wasBoxed = untrack(() => boxed) let pinned = true let left = 0')
    expect(source).toContain(
      '$effect(() => { void tall if (boxed === wasBoxed && !(boxed && pinned)) return const closing = wasBoxed && !boxed wasBoxed = boxed if (closing && !pinned) keepFromEnd(scroller(), left) else toEnd() })',
    )
  })

  it('keeps the place of a reader who scrolled up as the keyboard closes, by the distance from the end', () => {
    expect(flat(threadSource)).toContain('const scrolled = () => { pinned = ending() left = fromEnd(scroller()) }')
    expect(flat(threadSource)).toContain(
      '<div class="thread" class:boxed bind:this={box} bind:clientHeight={tall} onscroll={scrolled}>',
    )
  })

  it('stacks your bubble on the right of the column', () => {
    expect(flat(threadSource)).toContain('.thread { display: flex; flex: 1; flex-direction: column;')
    expect(flat(threadSource)).toContain('.entries { display: flex; flex-direction: column; gap: var(--inset-wide); min-width: 0; }')
  })

  it('reaches behind the composer and the keys while the keyboard is open, with room at its end, so its end still sits above the composer', () => {
    const source = flat(threadSource)
    expect(source).toContain('.room { flex: none; height: calc(100vh - var(--inset-wide)); }')
    expect(source).toContain('{#if boxed} <div class="room"></div> {/if}')
    expect(thread(chatWith(ROW))).not.toContain('class="room')
    expect(render(Thread, { props: { chat: chatWith(ROW), now: LATER, boxed: true } }).body).toMatch(/<div class="room svelte-[\w-]+">/)
  })

  it('moves its messages down with the composer by a transform while a finger takes the keys down, showing older ones above', () => {
    const props = { chat: chatWith(ROW), now: LATER, boxed: true }
    expect(render(Thread, { props: { ...props, drop: 190 } }).body).toMatch(/<div class="entries svelte-[\w-]+" style="transform: translateY\(190px\);">/)
    expect(render(Thread, { props }).body).not.toContain('transform')
    expect(flat(threadSource)).toContain('.boxed .entries { will-change: transform; }')
  })
})
