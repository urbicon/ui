import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const collapsibleVariants = tv({
  slots: {
    base: 'w-full',
    trigger: [
      'flex w-full items-center justify-between text-left font-medium cursor-pointer',
      'text-text-primary',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]',
      'hover:text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:rounded-sm',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    chevron: [
      'shrink-0 text-text-tertiary',
      // Collapse tokens (ACC-3) so `transitionDuration`/`transitionEasing` can retune the spin
      // in sync with the content. `motion-reduce` guards the inline-override path (an inline
      // duration bypasses the token that reduced-motion collapses to 1ms).
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    content: [
      'overflow-hidden',
      'transition-[grid-template-rows] duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    contentInner: 'text-text-secondary'
  },
  variants: {
    variant: {
      default: {},
      card: {
        base: 'border border-border-hairline rounded-contain shadow-[var(--blocks-shadow-sm)]',
        trigger: 'px-4',
        contentInner: 'px-4'
      },
      ghost: {
        trigger: 'px-4 rounded-contain hover:bg-surface-hover'
      }
    },
    size: {
      sm: {
        trigger: 'py-2 text-sm',
        contentInner: 'pb-2 text-sm',
        chevron: 'w-4 h-4'
      },
      md: {
        trigger: 'py-3 text-base',
        contentInner: 'pb-3 text-sm',
        chevron: 'w-5 h-5'
      },
      lg: {
        trigger: 'py-4 text-lg',
        contentInner: 'pb-4 text-base',
        chevron: 'w-5 h-5'
      }
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'md'
  }
});

export type CollapsibleVariants = VariantProps<typeof collapsibleVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type CollapsibleSlots = SlotNames<typeof collapsibleVariants>;
