import { FIELD_ICON_BUTTON, FIELD_ICON_BUTTON_PADDING } from '#lib/internal/field-chrome.js';
import { resolveClassChain, type SlotNames, tv, type VariantProps } from '#lib/utils/variants.js';

/**
 * Both pickers are a positioning context around an `Input`, plus the two icon
 * buttons that ride in the field's right-icon area. The look of the field
 * itself belongs to `Input` and the overlay's to `Calendar`; what is here is
 * what the pickers paint themselves.
 *
 * `iconButton` exists because a class string written straight onto the
 * `<button>` cannot be stripped by anything — not `unstyled`, not a colliding
 * consumer class. A slot is what puts those elements on the ladder. It is
 * Input's own icon-button recipe; the per-size padding that goes with it is
 * folded in by `datePickerIconButtonClass` below, because this config declares
 * no axes.
 */
export const datePickerVariants = tv({
  slots: {
    /** Positioning context around the field; the popover anchors to it. */
    base: ['relative w-full'],
    /** Clear + open-calendar buttons inside the field's right-icon area. */
    iconButton: [FIELD_ICON_BUTTON]
  }
});

export type DatePickerVariants = VariantProps<typeof datePickerVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type DatePickerSlots = SlotNames<typeof datePickerVariants>;

/**
 * The `iconButton` classes both pickers render. Input's padding for `size` is
 * the first `class` source, so a padding in `slotClass` (the picker's resolved
 * `slotClasses.iconButton`) strips it; `unstyled` drops it with the rest of the
 * library classes.
 */
export function datePickerIconButtonClass(
  slotClass: string | undefined,
  size: keyof typeof FIELD_ICON_BUTTON_PADDING,
  unstyled: boolean
): string {
  if (unstyled) return resolveClassChain(slotClass);
  return datePickerVariants().iconButton({
    class: resolveClassChain(FIELD_ICON_BUTTON_PADDING[size], slotClass)
  });
}
