<script lang="ts">
  import type { Toast } from '../../lib/bindings'
  import type { Chat } from '../../lib/chat.svelte'
  import { sendOnKey } from '../../lib/keys'
  import Icon from '../../lib/ui/Icon.svelte'
  import Spinner from '../../lib/ui/Spinner.svelte'
  import TextArea from '../../lib/ui/TextArea.svelte'
  import KeyRow from './KeyRow.svelte'
  import Question from './Question.svelte'
  import Thumbnails from './Thumbnails.svelte'

  let {
    chat,
    agent,
    below = 0,
    seen = null,
    drop = 0,
    onfailed,
    ontoast,
  }: {
    chat: Chat
    agent: string
    below?: number
    seen?: number | null
    drop?: number
    onfailed: (reason: string) => void
    ontoast: (toast: Toast) => void
  } = $props()

  const attaching = $derived(chat.attachments.attaching)
  const resting = $derived(!chat.canSend && !chat.sending)

  const attach = async () => {
    const failed = await chat.attach()
    if (failed !== null) {
      onfailed(failed)
    }
  }

  const remove = async (id: number) => {
    const told = await chat.remove(id)
    if (told !== null) {
      ontoast(told)
    }
  }

  const choose = async (number: number) => {
    const failed = await chat.pressOption(number)
    if (failed !== null) {
      onfailed(failed)
    }
  }

  const openTab = async (index: number) => {
    const failed = await chat.openTab(index)
    if (failed !== null) {
      onfailed(failed)
    }
  }
</script>

<div
  class="composer"
  class:keyboard={seen !== null}
  class:leaving={drop > 0}
  style:--below="{below}px"
  style:--seen={seen === null ? undefined : `${seen}px`}
  style:transform={drop > 0 ? `translateY(${drop}px)` : undefined}
>
  {#if chat.question !== null}
    <Question
      question={chat.question}
      {agent}
      onoption={(number) => void choose(number)}
      ontab={(index) => void openTab(index)}
    />
  {:else if chat.asking}
    <p class="note">{agent} is asking you something on its screen; answer with the keys.</p>
  {/if}
  {#if chat.keysOpen}
    <KeyRow {chat} {onfailed} />
  {/if}
  {#if chat.attachments.chips.length > 0}
    <Thumbnails chips={chat.attachments.chips} onremove={(id) => void remove(id)} />
  {/if}
  <div class="capsule">
    <button
      class="icon"
      type="button"
      aria-label="Attach image"
      disabled={attaching || chat.attachments.full}
      aria-busy={attaching ? 'true' : undefined}
      onclick={attach}
      ontouchstart={() => {}}
    >
      {#if attaching}
        <Spinner />
      {:else}
        <Icon name="image-plus" size={22} />
      {/if}
    </button>
    <button
      class="icon"
      type="button"
      aria-label="Keys"
      aria-expanded={chat.keysOpen}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => chat.toggleKeys()}
      ontouchstart={() => {}}
    >
      <Icon name="keyboard" size={22} />
    </button>
    <div class="field">
      <TextArea bare label="Answer" placeholder="Answer {agent}" bind:value={chat.draft} onkeydown={(event) => sendOnKey(event, chat)} />
    </div>
    <button
      class="send"
      class:lit={chat.canSend}
      type="button"
      aria-label="Send"
      disabled={!chat.canSend}
      aria-disabled={resting ? 'true' : undefined}
      aria-busy={chat.sending ? 'true' : undefined}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => void chat.send()}
      ontouchstart={() => {}}
    >
      <span class="disc">
        {#if chat.sending}
          <Spinner />
        {:else}
          <Icon name="arrow-up" size={20} />
        {/if}
      </span>
    </button>
  </div>
</div>

<style>
  .composer {
    position: sticky;
    bottom: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    max-height: calc(var(--seen, 100dvh) - env(safe-area-inset-top) - var(--below) - var(--over-composer));
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 0 calc(-1 * var(--gutter)) calc(-1 * var(--inset-wide) - env(safe-area-inset-bottom));
    padding: var(--gap) var(--gutter) calc(var(--inset-wide) + env(safe-area-inset-bottom));
    background: var(--glass);
    --over-composer: 132px;
  }

  .keyboard {
    margin-bottom: calc(-1 * var(--inset-wide));
    padding-bottom: var(--inset-wide);
    will-change: transform;
  }

  .leaving :global(textarea) {
    caret-color: transparent;
  }

  .note {
    margin: 0;
    color: var(--muted);
  }

  .capsule {
    display: flex;
    flex: none;
    align-items: flex-end;
    border: 1px solid var(--edge);
    border-radius: var(--radius-sheet);
    background: var(--field);
  }

  .capsule:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 32%, transparent);
  }

  .field {
    flex: 1;
    min-width: 0;
  }

  .icon,
  .send {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    background: none;
  }

  .icon {
    border-radius: var(--radius-sheet);
    color: var(--muted);
  }

  .icon:not(:disabled):active {
    background: var(--hover);
  }

  :global(html.pointing) .icon:not(:disabled):hover {
    background: var(--hover);
  }

  .icon:disabled {
    color: var(--faint);
    opacity: 0.6;
  }

  .disc {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--hover);
    color: var(--faint);
  }

  .lit .disc {
    background: var(--brand);
    color: var(--on-brand);
  }

  .lit:active .disc {
    background: var(--brand-hover);
  }

  :global(html.pointing) .lit:hover:not(:active) .disc {
    filter: brightness(1.1);
  }
</style>
