<script lang="ts">
  import { untrack } from 'svelte';
  import { Badge, Collapsible } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import CoreSpinner from '$lib/internal/core/CoreSpinner.svelte';
  import CodeBlock from '../CodeBlock/CodeBlock.svelte';
  import { toolCallCardVariants, type ToolCallCardVariants } from './tool-call-card.variants';
  import type { ToolCallCardProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    toolCall,
    variant = 'quiet',
    open = $bindable(),
    defaultOpen,
    onOpenChange,
    children,
    pendingLabel = 'Pending',
    runningLabel = 'Running',
    completeLabel = 'Done',
    errorLabel = 'Failed',
    inputLabel = 'Input',
    outputLabel = 'Output',
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ToolCallCardProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Forward arbitrary root attributes onto the underlying Collapsible without
  // re-deriving its (very wide) props union: spreading the typed `HTMLDivElement`
  // rest here makes svelte-check try to reconcile HTMLAttributes' nullable
  // `title` against Collapsible's narrowed one and blows the union-complexity
  // budget. A plain record spread carries the attributes through cleanly.
  const rootProps = $derived(restProps as Record<string, unknown>);

  const variantProps: ToolCallCardVariants = $derived({ variant });
  const styles = $derived(toolCallCardVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ToolCallCard', preset, variantProps, slotClassesProp)
  );

  function cls(name: keyof typeof slotClasses, extra?: string | (string | undefined)[]) {
    const extras = Array.isArray(extra) ? extra : [extra];
    if (unstyled) {
      return [slotClasses?.[name], ...extras].filter(Boolean).join(' ');
    }
    const slotFns = styles as Record<string, (args: { class?: unknown }) => string>;
    return slotFns[name]({ class: [slotClasses?.[name], ...extras] });
  }

  // Uncontrolled seed: expanded by default only for an already-failed call.
  // svelte-ignore state_referenced_locally
  let internalOpen = $state(defaultOpen ?? toolCall.state === 'error');
  const isOpen = $derived(open !== undefined ? open : internalOpen);

  // Tracks whether the user has toggled the card. Once they have, auto-open is
  // disabled — a manual choice always wins.
  let userToggled = $state(false);

  function toggle() {
    userToggled = true;
    const next = !isOpen;
    if (open !== undefined) {
      open = next;
    } else {
      internalOpen = next;
    }
    onOpenChange?.(next);
  }

  // Auto-open on a GENUINE transition to `error` while mounted — unless the
  // user has toggled. A call that is already failed at mount is covered by the
  // seed above (so an explicit defaultOpen={false} wins there), and the open
  // runs through the same notification path as a manual toggle so a
  // controlled-without-bind consumer can mirror it (review findings, P3 wave).
  // svelte-ignore state_referenced_locally
  let prevState = toolCall.state;
  $effect(() => {
    const state = toolCall.state;
    const wasError = prevState === 'error';
    prevState = state;
    if (state !== 'error' || wasError) return;
    untrack(() => {
      if (userToggled || isOpen) return;
      if (open !== undefined) open = true;
      else internalOpen = true;
      onOpenChange?.(true);
    });
  });

  const statusLabel = $derived(
    {
      pending: pendingLabel,
      running: runningLabel,
      complete: completeLabel,
      error: errorLabel
    }[toolCall.state]
  );

  const badgeIntent = $derived(
    toolCall.state === 'complete' ? 'success' : toolCall.state === 'error' ? 'danger' : 'neutral'
  );

  const isBusy = $derived(toolCall.state === 'pending' || toolCall.state === 'running');

  // A failure is the one state allowed to raise its voice in the quiet header —
  // everything else stays tertiary. The card header carries the intent in its
  // Badge instead.
  const statusTone = $derived(toolCall.state === 'error' ? 'text-danger-text' : undefined);

  // The card header is a rectangle sitting inside a rounded, un-clipped frame,
  // so its hover fill has to carry the frame's radius itself — otherwise the
  // fill squares off the corners it sits in, which is invisible at the default
  // 2px `--radius-contain` and glaring in a theme that rounds containers. Only
  // the top corners while open: the body continues the same fill area below.
  // Clipping the frame instead (`overflow-hidden`) would eat both the focus
  // ring and anything a `children` snippet pops out of the body.
  const cardTriggerRadius = $derived(
    variant === 'card' ? (isOpen ? 'rounded-t-contain' : 'rounded-contain') : undefined
  );

  // JSON.stringify can throw on circular structures, or return `undefined` for
  // a non-serializable value (function, symbol) — fall back to String() so the
  // CodeBlock always receives a string.
  function stringify(value: unknown): string {
    try {
      const json = JSON.stringify(value, null, 2);
      return json ?? String(value);
    } catch {
      return String(value);
    }
  }
</script>

<Collapsible
  variant={variant === 'card' ? 'card' : 'default'}
  size="sm"
  open={isOpen}
  class={className}
  {...rootProps}
>
  {#snippet trigger({ triggerId, contentId })}
    <button
      id={triggerId}
      type="button"
      class={cls('trigger', cardTriggerRadius)}
      aria-expanded={isOpen}
      aria-controls={contentId}
      onclick={toggle}
    >
      <span class={cls('triggerLeft')}>
        {#if isBusy}
          <span aria-hidden="true" class="inline-flex">
            <CoreSpinner size="xs" class={cls('spinner')} />
          </span>
        {/if}
        {#if variant === 'card'}
          <!-- CoreSpinner and Badge carry no ARIA (the badge is aria-hidden chrome),
               so this sr-only line is the single textual status for assistive tech.
               The quiet header needs none — its status is visible text. -->
          <span class="sr-only">{statusLabel}</span>
        {/if}
        <span class={cls('toolName')}>{toolCall.name}</span>
      </span>
      <span class={cls('triggerRight')}>
        {#if variant === 'card'}
          <Badge intent={badgeIntent} variant="soft" aria-hidden="true">{statusLabel}</Badge>
        {:else}
          <span class={cls('statusText', statusTone)}>{statusLabel}</span>
        {/if}
        <ChevronDownIcon class={cls('chevron', isOpen ? 'rotate-180' : undefined)} />
      </span>
    </button>
  {/snippet}

  {#if children}
    {@render children(toolCall)}
  {:else}
    <!--
      The payloads render as `plain` CodeBlocks: in `card` the frame is already
      drawn one level up, so a bordered child would stack a second outline at the
      same radius inside the first; in `quiet` the whole point is that nothing
      here draws a box. The section caption moved into the block's own header
      too — "Input" above a header reading "json" was one chrome row and one
      label too many for a single payload.
    -->
    <div class={cls('body')}>
      {#if toolCall.errorMessage}
        <p class={cls('errorMessage')}>{toolCall.errorMessage}</p>
      {/if}
      {#if toolCall.input !== undefined}
        <div class={cls('section')}>
          <CodeBlock variant="plain" label={inputLabel} code={stringify(toolCall.input)} />
        </div>
      {/if}
      {#if toolCall.output !== undefined}
        <div class={cls('section')}>
          <CodeBlock variant="plain" label={outputLabel} code={stringify(toolCall.output)} />
        </div>
      {/if}
    </div>
  {/if}
</Collapsible>
