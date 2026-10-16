import { FIELD_REQUIRED_MARK } from '#lib/internal/field-chrome.js';
import { type SlotNames, tv, type VariantProps } from '#lib/utils/variants.js';

export const formFieldVariants = tv({
  slots: {
    /** Label + control + message column. */
    wrapper: ['flex w-full flex-col gap-1.5'],
    /** The <label> above the control. */
    label: ['text-text-secondary block text-sm font-medium'],
    /** Required marker inside the label. */
    requiredMark: [],
    /** Error message below the control. */
    message: ['text-danger-text text-xs'],
    /** Helper text below the control. */
    helper: ['text-text-tertiary text-xs']
  },
  variants: {
    required: {
      true: {
        requiredMark: FIELD_REQUIRED_MARK
      }
    }
  },
  defaultVariants: {
    required: false
  }
});

export type FormFieldVariants = VariantProps<typeof formFieldVariants>;
/** The slot names `slotClasses` accepts. */
export type FormFieldSlots = SlotNames<typeof formFieldVariants>;
