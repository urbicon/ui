import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const sankeyVariants = tv({
  slots: {
    wrapper: ['relative w-full'],
    svg: ['block w-full overflow-visible'],
    node: [
      'cursor-default outline-none',
      'transition-[opacity,filter] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none'
    ],
    nodeRect: ['transition-[fill] duration-[var(--blocks-duration-fast)]'],
    nodeLabel: [
      'pointer-events-none select-none',
      'fill-text-primary text-xs font-medium',
      'transition-[opacity] duration-[var(--blocks-duration-fast)]'
    ],
    nodeValue: ['pointer-events-none select-none', 'fill-text-tertiary text-3xs tabular-nums'],
    link: [
      'cursor-default fill-none',
      'transition-[opacity,stroke-opacity,stroke-width] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none'
    ],
    tooltip: [
      'pointer-events-none absolute z-[var(--z-tooltip)]',
      'min-w-max rounded-md px-2.5 py-1.5',
      'bg-surface-elevated text-text-primary text-xs',
      'shadow-[var(--blocks-shadow-md)] border border-border-hairline',
      'opacity-0 transition-[opacity] duration-[var(--blocks-duration-fast)]',
      'data-[visible=true]:opacity-100'
    ],
    tooltipLabel: ['font-medium'],
    tooltipDetail: ['block text-text-tertiary tabular-nums']
  },
  variants: {
    intent: {
      primary: {
        nodeRect: 'fill-primary',
        link: 'stroke-primary'
      },
      secondary: {
        nodeRect: 'fill-secondary',
        link: 'stroke-secondary'
      },
      success: {
        nodeRect: 'fill-success',
        link: 'stroke-success'
      },
      warning: {
        nodeRect: 'fill-warning',
        link: 'stroke-warning'
      },
      danger: {
        nodeRect: 'fill-danger',
        link: 'stroke-danger'
      },
      neutral: {
        nodeRect: 'fill-neutral',
        link: 'stroke-neutral'
      }
    }
  },
  defaultVariants: {
    intent: 'neutral'
  }
});

export type SankeyVariants = VariantProps<typeof sankeyVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SankeySlots = SlotNames<typeof sankeyVariants>;
