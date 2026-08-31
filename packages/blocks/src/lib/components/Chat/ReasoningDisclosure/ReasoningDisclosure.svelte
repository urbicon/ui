<script lang="ts">
  import { Collapsible } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import StreamingMarkdown from '../StreamingMarkdown/StreamingMarkdown.svelte';
  import { reasoningDisclosureVariants } from './reasoning-disclosure.variants';
  import type { ReasoningDisclosureProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    reasoning,
    streaming = false,
    open = $bindable(),
    defaultOpen = false,
    onOpenChange,
    urlPolicy,
    thinkingLabel = 'Thinking',
    reasoningLabel = 'Reasoning',
    formatDuration = (s: number) => `Thought for ${s}s`,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ReasoningDisclosureProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Forward arbitrary root attributes onto the underlying Collapsible without
  // re-deriving its (very wide) props union: spreading the typed rest makes
  // svelte-check reconcile HTMLAttributes' nullable `title` against
  // Collapsible's narrowed one and blows the union-complexity budget (same
  // workaround as ToolCallCard).
  const rootProps = $derived(restProps as Record<string, unknown>);

  const styles = $derived(reasoningDisclosureVariants());
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ReasoningDisclosure', preset, {}, slotClassesProp)
  );

  // Header label: streaming → thinking; settled with a duration → "Thought for
  // Xs" (whole seconds); settled without one → the neutral reasoning label.
  const stateLabel = $derived.by(() => {
    if (streaming) return thinkingLabel;
    if (reasoning.durationMs != null) {
      return formatDuration(Math.round(reasoning.durationMs / 1000));
    }
    return reasoningLabel;
  });

  // The pulse lives here (not in the tv() config) so the dead-token guard never
  // flags it; `motion-reduce:animate-none` respects prefers-reduced-motion.
  const pulse = $derived(streaming ? 'animate-pulse motion-reduce:animate-none' : '');
</script>

<Collapsible
  {unstyled}
  variant="default"
  size="sm"
  bind:open
  {defaultOpen}
  {onOpenChange}
  class={className}
  {...rootProps}
>
  {#snippet trigger({ open: isOpen, toggle, disabled, triggerId, contentId })}
    <button
      id={triggerId}
      type="button"
      class={unstyled
        ? (slotClasses?.trigger ?? '')
        : styles.trigger({ class: slotClasses?.trigger })}
      aria-expanded={isOpen}
      aria-controls={contentId}
      {disabled}
      onclick={toggle}
    >
      <span
        class={unstyled
          ? resolveClassChain(pulse, slotClasses?.label)
          : styles.label({ class: [pulse, slotClasses?.label] })}
      >
        {stateLabel}
      </span>
      <ChevronDownIcon
        class={unstyled
          ? resolveClassChain(isOpen ? 'rotate-180' : '', slotClasses?.chevron)
          : styles.chevron({ class: [isOpen ? 'rotate-180' : '', slotClasses?.chevron] })}
      />
    </button>
  {/snippet}
  <div
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
  >
    <StreamingMarkdown
      {unstyled}
      content={reasoning.text}
      {streaming}
      {urlPolicy}
      size="sm"
      slotClasses={{ base: 'text-inherit' }}
    />
  </div>
</Collapsible>
