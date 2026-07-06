import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const accordionVariants = tv({
  slots: {
    // divide-border-hairline instead of subtle — a quieter divider.
    base: 'w-full divide-y divide-border-hairline',
    item: 'w-full',
    trigger: [
      'flex w-full items-center justify-between py-4 text-left font-medium cursor-pointer',
      'text-text-primary',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]',
      'hover:text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:rounded-sm',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    chevron: [
      'shrink-0 text-text-tertiary',
      // Collapse tokens (ACC-3) — retuned by Accordion's `transitionDuration`/`transitionEasing`
      // via CSS-variable inheritance; `motion-reduce` guards the inline-override path.
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    content: [
      'overflow-hidden',
      'transition-[grid-template-rows] duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    contentInner: 'pb-4 text-text-secondary'
  },
  // Variant contract (see docs/MIGRATION-v5.md §2):
  //   default   → hairlines between items (divide-y)
  //   separated → items as standalone blocks with spacing, no borders
  //   ghost     → no separators, hover-tint per item
  variants: {
    variant: {
      default: {},
      separated: {
        base: 'divide-y-0 space-y-2',
        item: 'rounded-contain bg-surface-quiet px-4'
      },
      ghost: {
        base: 'divide-y-0',
        item: 'rounded-contain',
        trigger: 'px-4 hover:bg-surface-hover rounded-contain'
      }
    },
    size: {
      sm: {
        trigger: 'py-2.5 text-sm',
        contentInner: 'pb-2.5 text-sm',
        chevron: 'w-4 h-4'
      },
      md: {
        trigger: 'py-4 text-base',
        contentInner: 'pb-4 text-sm',
        chevron: 'w-5 h-5'
      },
      lg: {
        trigger: 'py-5 text-lg',
        contentInner: 'pb-5 text-base',
        chevron: 'w-5 h-5'
      }
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'md'
  }
});

export type AccordionVariants = VariantProps<typeof accordionVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type AccordionSlots = SlotNames<typeof accordionVariants>;
