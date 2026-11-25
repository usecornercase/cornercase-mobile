<script lang="ts">
  import type { AgentClosing_Serialize as AgentClosing } from '../bindings'
  import { confirmationText } from '../closeAgent.svelte'
  import Button from './Button.svelte'
  import Sheet from './Sheet.svelte'

  let {
    plan,
    label,
    rechecking = false,
    anchor = null,
    oncancel,
    onconfirm,
  }: {
    plan: AgentClosing
    label: string
    rechecking?: boolean
    anchor?: HTMLElement | null
    oncancel: () => void
    onconfirm: () => void
  } = $props()

  const text = $derived(confirmationText(plan, label))
</script>

<Sheet label={text.title} {anchor} {oncancel}>
  <h2 class="title">{text.title}</h2>
  {#each text.lines as line (line)}
    <p class="line">{line}</p>
  {/each}
  <div class="actions">
    <Button tone="plain" resting={rechecking} onclick={oncancel}>Cancel</Button>
    <Button tone="danger" busy={rechecking} onclick={onconfirm}>Close</Button>
  </div>
</Sheet>

<style>
  .title {
    margin: 0 0 4px;
    color: var(--text);
    font-size: 17px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .line {
    margin: 0;
    color: var(--soft);
    font-size: 15px;
    line-height: 20px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap);
    margin-top: var(--inset);
  }
</style>
