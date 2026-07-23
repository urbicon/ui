import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const chatVariants = tv({
  slots: {
    // Fills its parent's height as a flex column. `min-h-0` is the discipline
    // that lets the body child own the scroll instead of overflowing the page.
    root: ['flex h-full min-h-0 w-full flex-col bg-surface-base'],
    // Pinned header — never scrolls.
    header: ['shrink-0 border-b border-border-subtle'],
    // The conversation area. Flexes to fill and clamps to min-h-0 so its own
    // scrollable child (ChatMessageList) can scroll; the container never does.
    body: ['min-h-0 min-w-0 flex-1'],
    // Pinned composer at the bottom.
    composer: ['shrink-0 border-t border-border-subtle bg-surface-base']
  }
});

export type ChatVariants = VariantProps<typeof chatVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ChatSlots = SlotNames<typeof chatVariants>;
