import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toolCallCardVariants = tv({
  slots: {
    // The whole card header IS the collapsible trigger button. Collapsible's
    // card variant only styles the DEFAULT trigger; a custom trigger snippet
    // replaces it, so the horizontal padding / focus ring live here.
    trigger: [
      'flex w-full items-center justify-between gap-2 px-4 py-2 text-left cursor-pointer',
      'text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-sm',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    // Status indicator + tool name; min-w-0 lets the mono name truncate.
    triggerLeft: 'flex items-center gap-2 min-w-0',
    // Status badge + chevron; never shrinks so the name gives way first.
    triggerRight: 'flex items-center gap-2 shrink-0',
    // Inline busy indicator (CoreSpinner wrapper) — tertiary tint via text-current.
    spinner: 'text-text-tertiary shrink-0',
    // The invoked tool's identifier, monospaced.
    toolName: 'font-mono text-sm text-text-secondary truncate',
    // Chevron mirrors Collapsible's own spin timing so both animate in sync.
    chevron: [
      'shrink-0 w-4 h-4 text-text-tertiary',
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    // Default body wrapper (input/output sections + error line).
    body: 'flex flex-col gap-3',
    // One labelled block (heading + CodeBlock).
    section: 'flex flex-col gap-1',
    // Small tertiary heading above each code block.
    sectionLabel: 'text-xs font-medium text-text-tertiary',
    // Error message line shown above the sections.
    errorMessage: 'text-sm text-danger'
  }
});

export type ToolCallCardVariants = VariantProps<typeof toolCallCardVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ToolCallCardSlots = SlotNames<typeof toolCallCardVariants>;
