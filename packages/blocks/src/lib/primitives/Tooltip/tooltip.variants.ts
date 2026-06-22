import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const tooltipVariants = tv({
  slots: {
    // Position + inset are set inline in Tooltip.svelte so the native
    // `popover="manual"` top-layer rendering works correctly. The base
    // slot only carries visual chrome.
    //
    // `overflow-visible` overrides the UA stylesheet default of
    // `overflow: auto` on `[popover]` — without it the arrow (which
    // sits at `bottom: -4px`, i.e. outside the padding box) is clipped
    // and the absolute-positioned arrow triggers a scrollbar when
    // hovered. See: Chrome/Firefox UA stylesheet for [popover].
    // tier: contain — floating chrome.
    //
    // `max-w-xs` + `whitespace-normal` lets long descriptions wrap onto
    // multiple lines instead of overflowing the chip. Single-word labels
    // render visually unchanged (the chip shrinks to fit). Consumers who
    // need a strict one-line label can override with
    // `class="whitespace-nowrap max-w-none"`.
    base: [
      'z-[var(--z-tooltip)] overflow-visible',
      'font-medium text-center whitespace-normal max-w-xs',
      'rounded-contain pointer-events-none',
      'transition-opacity duration-[var(--blocks-duration-fast)]',
      'bg-surface-inverted text-text-inverted'
    ],
    arrow: ['absolute w-2 h-2', 'bg-inherit transform rotate-45']
  },
  variants: {
    visible: {
      true: { base: 'opacity-100' },
      false: { base: 'opacity-0' }
    },
    intent: {
      primary: { base: 'bg-primary text-text-on-primary' },
      secondary: { base: 'bg-secondary text-text-on-primary' },
      info: { base: 'bg-info text-text-on-primary' },
      success: { base: 'bg-success text-text-on-primary' },
      warning: { base: 'bg-warning text-text-on-surface' },
      danger: { base: 'bg-danger text-text-on-primary' },
      neutral: { base: 'bg-surface-inverted text-text-inverted' }
    },
    size: {
      sm: { base: 'px-1.5 py-0.5 text-xs' },
      md: { base: 'px-2.5 py-1 text-sm' },
      lg: { base: 'px-3 py-1.5 text-base' }
    }
  },
  defaultVariants: {
    visible: false,
    intent: 'neutral',
    size: 'md'
  }
});

export type TooltipVariants = Omit<VariantProps<typeof tooltipVariants>, 'visible'>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TooltipSlots = SlotNames<typeof tooltipVariants>;
