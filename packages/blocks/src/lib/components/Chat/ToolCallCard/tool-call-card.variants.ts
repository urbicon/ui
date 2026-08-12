import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toolCallCardVariants = tv({
  slots: {
    // The whole card header IS the collapsible trigger button. Collapsible's
    // card variant only styles the DEFAULT trigger; a custom trigger snippet
    // replaces it, so the horizontal padding / focus ring live here.
    trigger: [
      'group/toolcall items-center gap-2 text-left cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)] ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    // Status indicator + tool name; min-w-0 lets the mono name truncate.
    triggerLeft: 'flex items-center gap-2 min-w-0',
    // Status + chevron; never shrinks so the name gives way first.
    triggerRight: 'flex items-center gap-2 shrink-0',
    // Inline busy indicator (CoreSpinner wrapper) — tertiary tint via text-current.
    spinner: 'text-text-tertiary shrink-0',
    // The invoked tool's identifier, monospaced.
    toolName: 'font-mono text-sm truncate',
    // Plain-text status in the `quiet` header (the `card` header uses a Badge).
    statusText: 'text-xs text-text-tertiary',
    // Chevron mirrors Collapsible's own spin timing so both animate in sync.
    chevron: [
      'shrink-0 text-text-tertiary',
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    // Default body wrapper (input/output sections + error line).
    body: 'flex flex-col gap-3',
    // One payload block. The caption lives in the CodeBlock's own header (it is
    // passed as `label`), so this is a plain positioning wrapper — no heading row
    // of its own, which is what removed a whole chrome level from the card.
    section: 'flex flex-col',
    // Error message line shown above the sections.
    errorMessage: 'text-sm text-danger-text'
  },
  variants: {
    /**
     * `quiet` — the default. A tool call is machinery, not content: the reader
     * of a chat wants the answer, and only occasionally what produced it. So the
     * header is one muted line in the message flow — no outline, no surface, no
     * shadow, no coloured badge — sized to its own text rather than to the
     * message width, and it hovers by darkening its text (the same register as
     * ReasoningDisclosure, which sits next to it in the same stream).
     *
     * `card` — the framed header: outline, radius, shadow, status Badge, full
     * message width. The right pick where the call IS the content — an agent
     * trace, a tool-run log, a debugging view — and wrong wherever a reader is
     * following prose.
     */
    variant: {
      quiet: {
        // inline-flex + max-w-full: the row is as wide as its own text (up to
        // the container), so a tool call reads as an aside in the flow rather
        // than as a full-width band. `w-fit` keeps that width when a consumer
        // drops the row into a stretch-aligned flex column. The focus ring is
        // rounded here (the row has no radius of its own); the card header
        // rounds with the frame instead — see the trigger radius in the
        // component.
        trigger: [
          'inline-flex w-fit max-w-full py-1',
          'text-text-tertiary hover:text-text-secondary',
          'focus-visible:rounded-sm'
        ],
        toolName: 'text-text-secondary group-hover/toolcall:text-text-primary',
        chevron: 'w-3.5 h-3.5',
        body: 'pt-1'
      },
      card: {
        trigger: [
          'flex w-full justify-between px-4 py-2',
          'text-text-primary hover:bg-surface-hover'
        ],
        toolName: 'text-text-secondary',
        chevron: 'w-4 h-4'
      }
    }
  },
  defaultVariants: {
    variant: 'quiet'
  }
});

export type ToolCallCardVariants = VariantProps<typeof toolCallCardVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ToolCallCardSlots = SlotNames<typeof toolCallCardVariants>;
