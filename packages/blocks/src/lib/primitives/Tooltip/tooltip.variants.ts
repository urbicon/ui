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
      // Tooltip fade tokens (ACC-3 follow-up) so `transitionDuration`/
      // `transitionEasing` can retune the opacity fade per instance. `motion-reduce`
      // guards the inline-override path (an inline duration bypasses the token that
      // reduced-motion collapses to 1ms). The default easing token resolves to
      // Tailwind's implicit transition curve, so the resting fade is unchanged.
      //
      // display/overlay + `transition-discrete` and the `starting:` before-state
      // are what make the fade actually PLAY in top-layer mode (same mechanism
      // as popoverMotion): without them, showPopover() reveals the chip with no
      // before-state (enter pops to opacity 1) and hidePopover() yanks it to
      // display:none in the same recalc (exit never paints). Verified 2026-07-14
      // — the original transition-opacity fade only ever ran in the rare
      // in-dialog fallback, where visibility is purely opacity-driven.
      'transition-[opacity,display,overlay] transition-discrete',
      'duration-[var(--blocks-tooltip-duration)] ease-[var(--blocks-tooltip-easing)]',
      'motion-reduce:duration-[1ms]',
      'bg-surface-inverted text-text-inverted'
    ],
    arrow: ['absolute w-2 h-2', 'bg-inherit transform rotate-45']
  },
  variants: {
    open: {
      // `starting:` supplies the @starting-style before-state for the frame
      // showPopover() first renders the chip — the enter half of the fade.
      true: { base: 'opacity-100 starting:opacity-0' },
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
    open: false,
    intent: 'neutral',
    size: 'md'
  }
});

// `open` is excluded from the public variants type — it is a real prop on
// TooltipProps (bindable state), not a style knob.
export type TooltipVariants = Omit<VariantProps<typeof tooltipVariants>, 'open'>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TooltipSlots = SlotNames<typeof tooltipVariants>;
