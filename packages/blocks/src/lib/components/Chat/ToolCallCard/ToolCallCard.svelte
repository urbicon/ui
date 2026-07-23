<script lang="ts">
  import { untrack } from 'svelte';
  import { Badge, Collapsible } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import CoreSpinner from '$lib/internal/core/CoreSpinner.svelte';
  import CodeBlock from '../CodeBlock/CodeBlock.svelte';
  import { toolCallCardVariants } from './tool-call-card.variants';
  import type { ToolCallCardProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    toolCall,
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

  const styles = toolCallCardVariants();
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ToolCallCard', preset, {}, slotClassesProp)
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

  // Auto-open when the call transitions to `error` while mounted — unless the
  // user has already toggled it. Only ever opens (never force-closes); reads of
  // the open state are untracked so the write can't re-trigger this effect.
  $effect(() => {
    const failed = toolCall.state === 'error';
    const toggled = userToggled;
    if (failed && !toggled) {
      untrack(() => {
        if (open !== undefined) {
          if (open !== true) open = true;
        } else if (internalOpen !== true) {
          internalOpen = true;
        }
      });
    }
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

<Collapsible variant="card" size="sm" open={isOpen} class={className} {...rootProps}>
  {#snippet trigger({ triggerId, contentId })}
    <button
      id={triggerId}
      type="button"
      class={cls('trigger')}
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
        <!-- CoreSpinner and Badge carry no ARIA (the badge is aria-hidden chrome),
             so this sr-only line is the single textual status for assistive tech. -->
        <span class="sr-only">{statusLabel}</span>
        <span class={cls('toolName')}>{toolCall.name}</span>
      </span>
      <span class={cls('triggerRight')}>
        <Badge intent={badgeIntent} variant="soft" aria-hidden="true">{statusLabel}</Badge>
        <ChevronDownIcon class={cls('chevron', isOpen ? 'rotate-180' : undefined)} />
      </span>
    </button>
  {/snippet}

  {#if children}
    {@render children(toolCall)}
  {:else}
    <div class={cls('body')}>
      {#if toolCall.errorMessage}
        <p class={cls('errorMessage')}>{toolCall.errorMessage}</p>
      {/if}
      {#if toolCall.input !== undefined}
        <div class={cls('section')}>
          <span class={cls('sectionLabel')}>{inputLabel}</span>
          <CodeBlock lang="json" code={stringify(toolCall.input)} />
        </div>
      {/if}
      {#if toolCall.output !== undefined}
        <div class={cls('section')}>
          <span class={cls('sectionLabel')}>{outputLabel}</span>
          <CodeBlock lang="json" code={stringify(toolCall.output)} />
        </div>
      {/if}
    </div>
  {/if}
</Collapsible>
