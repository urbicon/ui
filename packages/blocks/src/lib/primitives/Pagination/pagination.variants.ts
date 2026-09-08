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
 * The anchor form of a pagination item, which wears `buttonVariants` — this
 * config carries only what a `<button>`'s config cannot say about an `<a>`:
 *
 * - `disabled:` matches a form control, so the inert look keys on the attribute
 *   the anchor actually carries;
 * - a link inherits whatever `text-decoration` the surrounding page gives `a`;
 * - `loading` on a button fades the label out behind an overlay spinner, and
 *   the link form draws no spinner — so the label stays lit.
 *
 * A tv() config rather than a string in the markup: `variants:lint` reads
 * `*.variants.ts`, and a class it never sees is a class the dead-token and
 * bucket-agreement passes cannot check.
 */
export const paginationLinkVariants = tv({
  slots: {
    base: [
      'no-underline',
      'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none'
    ],
    content: ''
  },
  variants: {
    loading: {
      true: { content: 'opacity-100' }
    }
  },
  defaultVariants: {
    loading: false
  }
});

export type PaginationLinkVariants = VariantProps<typeof paginationLinkVariants>;
export type PaginationVariants = VariantProps<typeof paginationVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type PaginationSlots = SlotNames<typeof paginationVariants>;
