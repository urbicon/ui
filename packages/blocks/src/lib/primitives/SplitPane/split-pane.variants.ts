import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const splitPaneVariants = tv({
  slots: {
    // Flex container. `h-full`/`w-full` inherit the consumer's box; the panes
    // size via flex-basis so the divider can sit at any ratio.
    root: ['relative flex w-full h-full min-w-0 min-h-0'],
    // Panes clip their own overflow and let long content scroll internally —
    // min-w-0/min-h-0 defeats flexbox's default min-content floor so a pane can
    // actually shrink below its content size.
    startPane: ['overflow-hidden min-w-0 min-h-0'],
    endPane: ['overflow-hidden min-w-0 min-h-0'],
    // The divider is a thin visible line (bg-border-default) that is itself the
    // role="separator". It is positioned (`relative`) with no z-index, so — like
    // Slider's rail thumb — it and its transparent `::before` hit-expander paint
    // above the statically-flowed panes. The `::before` swells the grab target
    // to ≥24px (WCAG 2.5.8 AA) without widening the visible gutter.
    handle: [
      'relative shrink-0 touch-none select-none',
      'bg-border-default',
      'transition-[background-color] duration-[var(--blocks-duration-fast)]',
      'hover:bg-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-base',
      "before:content-[''] before:absolute"
    ]
  },
  variants: {
    orientation: {
      horizontal: {
        root: 'flex-row',
        // Vertical rule between side-by-side panes. Hit area: 4px + 2×10px = 24px.
        handle: 'self-stretch w-1 cursor-col-resize before:inset-y-0 before:-inset-x-2.5'
      },
      vertical: {
        root: 'flex-col',
        // Horizontal rule between stacked panes.
        handle: 'w-full h-1 cursor-row-resize before:inset-x-0 before:-inset-y-2.5'
      }
    },
    // State axes last (house order): a state must dominate the resting look.
    dragging: {
      true: { handle: 'bg-primary' }
    },
    // Declared after `dragging` so its hover-neutralising override wins the
    // `hover:bg` bucket even if a stale `dragging` were ever set together.
    disabled: {
      true: {
        handle: 'cursor-default pointer-events-none hover:bg-border-default'
      }
    }
  },
  defaultVariants: {
    orientation: 'horizontal',
    dragging: false,
    disabled: false
  }
});

export type SplitPaneVariants = VariantProps<typeof splitPaneVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SplitPaneSlots = SlotNames<typeof splitPaneVariants>;
