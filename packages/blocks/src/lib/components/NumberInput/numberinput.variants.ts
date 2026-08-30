import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * NumberInput paints nothing of its own except the stepper: the field, its
 * label and its messages are `Input`'s and stay addressable under that name.
 *
 * The two slots exist because a class string written straight onto the
 * `<button>` cannot be stripped by anything — not `unstyled`, not a colliding
 * consumer class. A slot is what puts those elements on the ladder.
 */
export const numberInputVariants = tv({
  slots: {
    /** Column holding the two stepper buttons, inside Input's right-icon area. */
    stepper: ['pointer-events-auto -my-1 flex flex-col justify-center'],
    /** One stepper button (increment / decrement). */
    stepperButton: [
      'text-text-tertiary hover:text-text-primary flex items-center justify-center',
      'px-0.5 transition-colors disabled:pointer-events-none disabled:opacity-30',
      'focus-visible:outline-none'
    ]
  }
});

export type NumberInputVariants = VariantProps<typeof numberInputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type NumberInputSlots = SlotNames<typeof numberInputVariants>;
