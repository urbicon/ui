import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const paginationVariants = tv({
  slots: {
    base: ['flex items-center w-full', 'gap-1'],
    info: ['flex items-center', 'text-text-tertiary', 'text-sm', 'ml-3'],
    controls: ['flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center'],
    ellipsis: [
      'flex items-center justify-center',
      'min-w-8 h-8 sm:min-w-10 sm:h-10',
      'text-text-tertiary'
    ]
  },
  variants: {
    // Declared BEFORE `layout` so the layout-specific gaps (table `gap-4`,
    // minimal `gap-2`) win the gap bucket over the per-size default.
    size: {
      sm: {
        base: 'gap-1',
        ellipsis: 'min-w-8 h-8 text-sm'
      },
      md: {
        base: 'gap-1',
        ellipsis: 'min-w-10 h-10 text-base'
      },
      lg: {
        base: 'gap-2',
        ellipsis: 'min-w-12 h-12 text-lg'
      }
    },
    layout: {
      default: {
        base: 'flex-wrap justify-center'
      },
      navigation: {
        base: 'justify-between items-center'
      },
      table: {
        base: 'justify-between items-center flex-col sm:flex-row gap-4',
        info: 'ml-0'
      },
      minimal: {
        base: 'justify-center gap-2',
        info: 'ml-0'
      }
    },
    disabled: {
      true: {
        base: 'opacity-50 pointer-events-none'
      }
    },
    loading: {
      true: {
        base: 'opacity-75'
      }
    }
  },
  defaultVariants: {
    layout: 'default',
    size: 'md',
    disabled: false,
    loading: false
  }
});

/**
 * The `<a>` of a link-based pagination item. It carries no look of its own —
 * the `Button` inside paints it — only the inline box and the focus ring the
 * anchor needs because the inner button is `tabindex="-1"`.
 */
export const paginationLinkVariants = tv({
  base: [
    'inline-block no-underline',
    'focus-visible:rounded-md focus-visible:outline focus-visible:outline-2',
    'focus-visible:outline-offset-2 focus-visible:outline-primary/50'
  ]
});

export type PaginationLinkVariants = VariantProps<typeof paginationLinkVariants>;
export type PaginationVariants = VariantProps<typeof paginationVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type PaginationSlots = SlotNames<typeof paginationVariants>;
