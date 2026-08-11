import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const reasoningDisclosureVariants = tv({
  slots: {
    // The whole header row is the toggle. Muted (secondary) tone — reasoning is
    // meta-content, subordinate to the answer. `size="sm"` rhythm, matching the
    // Collapsible small size the disclosure sits on.
    trigger: [
      'flex w-full items-center justify-between gap-2 text-left',
      'cursor-pointer py-2 text-sm font-medium text-text-secondary',
      'transition-[color] duration-[var(--blocks-duration-fast)]',
      'hover:text-primary-text',
      'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'disabled:cursor-not-allowed disabled:opacity-50'
    ],
    // State label ("Thinking" / "Reasoning" / "Thought for Xs"). The streaming
    // pulse is toggled in the component (animate-pulse motion-reduce:animate-none)
    // so it stays off the dead-token guard.
    label: 'min-w-0 truncate',
    // Chevron shares the collapse motion tokens so the spin stays in sync with
    // the panel; rotate-180 is applied in the component when open.
    chevron: [
      'h-4 w-4 shrink-0 text-text-tertiary',
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    // Wrapper around StreamingMarkdown. `text-text-tertiary` is the damped
    // reasoning tone; the markdown body inherits it (its base color override is
    // `text-inherit`), while link/blockquote slots keep their own intents.
    content: 'text-text-tertiary'
  }
});

export type ReasoningDisclosureVariants = VariantProps<typeof reasoningDisclosureVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ReasoningDisclosureSlots = SlotNames<typeof reasoningDisclosureVariants>;
