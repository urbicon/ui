import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const sidebarVariants = tv({
  slots: {
    backdrop: [
      'fixed inset-0 z-[var(--z-overlay)]',
      'bg-surface-inverted/50 backdrop-blur-[var(--blocks-overlay-backdrop-blur)]'
    ],
    panel: [
      'fixed inset-y-0 z-[var(--z-sidebar)]',
      'flex flex-col',
      'bg-surface-elevated',
      'border-border-hairline'
    ],
    header: [
      'flex shrink-0 items-center justify-between',
      'border-border-hairline border-b',
      'px-5'
    ],
    content: ['flex-1 overflow-y-auto'],
    footer: ['shrink-0', 'border-border-hairline border-t']
  },
  variants: {
    side: {
      left: { panel: 'left-0 border-r' },
      right: { panel: 'right-0 border-l' }
    },
    mode: {
      responsive: { backdrop: 'lg:hidden' },
      collapsible: { backdrop: 'lg:hidden', panel: 'overflow-hidden' }
    }
  },
  defaultVariants: {
    side: 'left',
    mode: 'responsive'
  }
});

export type SidebarVariants = VariantProps<typeof sidebarVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SidebarSlots = SlotNames<typeof sidebarVariants>;
