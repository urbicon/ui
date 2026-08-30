import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const formFieldVariants = tv({
  slots: {
    /** Label + control + message column. */
    wrapper: ['flex w-full flex-col gap-1.5'],
    /** The <label> above the control. */
    label: ['text-text-secondary block text-sm font-medium'],
    /** Required marker inside the label. */
    requiredMark: ['text-danger-text ml-0.5'],
    /** Error message below the control. */
    message: ['text-danger-text text-xs'],
    /** Helper text below the control. */
    helper: ['text-text-tertiary text-xs']
  }
});

export type FormFieldVariants = VariantProps<typeof formFieldVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type FormFieldSlots = SlotNames<typeof formFieldVariants>;
