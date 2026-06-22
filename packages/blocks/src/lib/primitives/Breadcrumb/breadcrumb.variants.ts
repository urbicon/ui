import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const breadcrumbVariants = tv({
  slots: {
    nav: 'flex items-center',
    list: 'flex items-center flex-wrap',
    item: 'inline-flex items-center',
    link: [
      'text-text-secondary hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'underline-offset-4 hover:underline truncate max-w-48',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-sm'
    ],
    currentPage: 'font-medium text-text-primary truncate max-w-48',
    separator: 'mx-2 text-text-tertiary select-none'
  },
  variants: {
    size: {
      sm: {
        list: 'text-xs gap-0.5',
        separator: 'mx-1.5'
      },
      md: {
        list: 'text-sm gap-1',
        separator: 'mx-2'
      },
      lg: {
        list: 'text-base gap-1',
        separator: 'mx-2'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type BreadcrumbVariants = VariantProps<typeof breadcrumbVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type BreadcrumbSlots = SlotNames<typeof breadcrumbVariants>;
