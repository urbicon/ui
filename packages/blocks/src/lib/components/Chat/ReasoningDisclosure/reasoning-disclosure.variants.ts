import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const reasoningDisclosureVariants = tv({
  slots: {
    // The whole header row is the toggle. Muted (tertiary) tone — reasoning is
    // meta-content, subordinate to the answer — and one row wide rather than one
    // column wide: this and ToolCallCard's plain header are the two parts that
    // report HOW an answer came about, they sit in the same stream, and a reader
    // should be able to tell at a glance that they are the same kind of thing.
    // Both are `inline-flex w-fit`, tertiary ink hovering to `primary-text`,
    // `py-1`, 14px chevron. Change one, change the other.
    trigger: [
      'inline-flex w-fit max-w-full items-center justify-between gap-2 text-left',
      'cursor-pointer py-1 text-sm text-text-tertiary',
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
    // the panel; rotate-180 is applied in the component when open. No colour of
    // its own — it inherits the trigger's, so the hover moves the whole row.
    chevron: [
      'h-3.5 w-3.5 shrink-0',
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    // Wrapper around StreamingMarkdown. `text-text-tertiary` is the damped
    // reasoning tone; the markdown body inherits it (its base color override is
    // `text-inherit`), while link/blockquote slots keep their own intents. The
    // indent is the same one ToolCallCard's body uses: it says where the aside
    // starts and where the answer resumes, without drawing a box to say it.
    content: 'pl-3 text-text-tertiary'
  }
});

export type ReasoningDisclosureVariants = VariantProps<typeof reasoningDisclosureVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ReasoningDisclosureSlots = SlotNames<typeof reasoningDisclosureVariants>;
