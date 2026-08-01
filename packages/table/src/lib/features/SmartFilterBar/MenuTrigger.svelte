<script lang="ts">
  import { Button, Tooltip } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';

  /**
   * The shared shell of the five filter-bar triggers. They differ in icon,
   * label, lit hue and counter — not in shape — and they have to change shape
   * together: in the capsule each is an icon with a tooltip, in the narrow
   * bar's stacked panel each is a full-width row that reads its own name.
   *
   * A tooltip on a row that already carries its label would just repeat it, so
   * `stacked` drops it. Everything else stays the caller's business.
   */
  let {
    label,
    stacked = false,
    active = false,
    disabled = false,
    triggerClass = undefined,
    expanded = false,
    haspopup = 'listbox',
    icon,
    counter,
    onclick = undefined,
    testId = undefined
  }: {
    /** Human name of the tool — the tooltip in the capsule, the row's text when stacked. */
    label: string;
    stacked?: boolean;
    active?: boolean;
    disabled?: boolean;
    /** The lit-state classes of this particular tool. */
    triggerClass?: string;
    expanded?: boolean;
    haspopup?: 'listbox' | 'true' | 'dialog';
    icon: Snippet;
    /** Badge shown after the label — a count of what this tool is doing. */
    counter?: Snippet;
    onclick?: () => void;
    testId?: string;
  } = $props();
</script>

{#snippet button()}
  <Button
    variant="ghost"
    intent="neutral"
    size="sm"
    {active}
    {disabled}
    class={[triggerClass, stacked && 'w-full justify-start gap-2'].filter(Boolean).join(' ') ||
      undefined}
    aria-expanded={expanded}
    aria-haspopup={haspopup}
    {onclick}
    data-testid={testId}
  >
    {@render icon()}
    {#if stacked}
      <span class="flex-1 text-left">{label}</span>
    {/if}
    {@render counter?.()}
  </Button>
{/snippet}

{#if stacked}
  {@render button()}
{:else}
  <Tooltip {label}>
    {@render button()}
  </Tooltip>
{/if}
