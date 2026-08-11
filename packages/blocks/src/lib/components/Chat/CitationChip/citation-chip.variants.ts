import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const citationChipVariants = tv({
  slots: {
    // Compact inline chip in the Badge soft-primary idiom. `align-baseline`
    // + `leading-none` keep it seated on the text baseline so an inline
    // citation marker never bumps the surrounding line height.
    trigger: [
      'inline-flex items-center justify-center align-baseline',
      'bg-primary-subtle text-primary-emphasis',
      'text-xs font-medium leading-none tabular-nums',
      'rounded-full px-1.5 py-0.5 cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-primary/15',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
    ],
    // Content wrapper INSIDE the Popover panel — the panel itself already
    // supplies surface / border / shadow / padding, so this only lays out.
    popover: 'flex flex-col gap-1.5 max-w-xs',
    title: 'font-medium text-text-primary text-sm',
    snippet: 'text-text-secondary text-sm line-clamp-3',
    link: [
      'inline-flex items-center gap-1 self-start',
      'text-sm text-primary-text rounded-modify',
      'hover:underline',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
    ],
    linkIcon: 'h-3.5 w-3.5 shrink-0'
  },
  variants: {
    citationStyle: {
      // Numeric marker — a fixed-width numeric pill; no truncation.
      numeric: {},
      // Label marker — carries the source title, capped so a long title
      // can't stretch the chip across the line. The ellipsis itself lives on
      // an inner span (truncate doesn't render on the inline-flex trigger).
      label: { trigger: 'max-w-[16ch]' }
    }
  },
  defaultVariants: {
    citationStyle: 'numeric'
  }
});

export type CitationChipVariants = VariantProps<typeof citationChipVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type CitationChipSlots = SlotNames<typeof citationChipVariants>;
