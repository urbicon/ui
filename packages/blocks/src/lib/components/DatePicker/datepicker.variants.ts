import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Both pickers are a positioning context around an `Input`, plus the two icon
 * buttons that ride in the field's right-icon area. The look of the field
 * itself belongs to `Input` and the overlay's to `Calendar`; what is here is
 * what the pickers paint themselves.
 *
 * `iconButton` exists because a class string written straight onto the
 * `<button>` cannot be stripped by anything — not `unstyled`, not a colliding
 * consumer class. A slot is what puts those elements on the ladder.
 */
export const datePickerVariants = tv({
  slots: {
    /** Positioning context around the field; the popover anchors to it. */
    base: ['relative w-full'],
    /** Clear + open-calendar buttons inside the field's right-icon area. */
    iconButton: [
      'text-text-tertiary hover:text-text-primary hover:bg-surface-hover',
      'focus-visible:ring-primary/50 rounded-modify inline-flex cursor-pointer',
      'items-center justify-center p-0.5 transition-colors',
      'duration-[var(--blocks-duration-fast)] focus-visible:ring-2 focus-visible:outline-none'
    ]
  }
});

export type DatePickerVariants = VariantProps<typeof datePickerVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type DatePickerSlots = SlotNames<typeof datePickerVariants>;
