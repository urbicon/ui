import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const chatMessageListVariants = tv({
  slots: {
    // Positioning context for the floating new-messages button; fills the
    // parent (Chat's body region) and delegates all scrolling to the viewport.
    root: ['relative flex h-full min-h-0 flex-col'],
    // The one scrolling element. Browser scroll anchoring is disabled — the
    // engine does its own deterministic prepend anchoring (Safari has no
    // overflow-anchor support, so we correct manually everywhere).
    viewport: [
      'min-h-0 flex-1 overflow-y-auto overscroll-contain',
      '[overflow-anchor:none]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
    ],
    // The log element whose children are the messages.
    content: ['flex flex-col gap-4 p-4'],
    empty: ['flex h-full items-center justify-center p-6'],
    // Floating pill centered over the bottom edge of the viewport.
    newButton: [
      'absolute bottom-3 left-1/2 -translate-x-1/2',
      'inline-flex items-center gap-1.5',
      'rounded-full border border-border-default bg-surface-overlay',
      'px-3 py-1.5 text-sm text-text-primary',
      'shadow-[var(--blocks-shadow-md)]',
      'cursor-pointer select-none',
      'transition-[background-color,color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
    ]
  },
  variants: {}
});

export type ChatMessageListVariants = VariantProps<typeof chatMessageListVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ChatMessageListSlots = SlotNames<typeof chatMessageListVariants>;
