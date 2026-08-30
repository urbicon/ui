import { tv, type VariantProps } from '$lib/utils/variants';

/**
 * Both pickers are a positioning context around an `Input` — the look belongs
 * to the Input and to the Calendar in the popover. The two classes here are
 * that context, and they live in a config so a consumer's `class` strips them
 * instead of racing them in the stylesheet.
 */
export const datePickerVariants = tv({
  base: ['relative w-full']
});

export type DatePickerVariants = VariantProps<typeof datePickerVariants>;
