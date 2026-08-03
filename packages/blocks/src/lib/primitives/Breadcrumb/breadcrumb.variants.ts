import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const breadcrumbVariants = tv({
  slots: {
    nav: 'flex items-center',
    list: 'flex items-center',
    item: 'inline-flex items-center',
    link: [
      'text-text-secondary hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'underline-offset-4 hover:underline truncate max-w-48',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-sm'
    ],
    currentPage: 'font-medium text-text-primary truncate max-w-48',
    // Per-item leading icon (`BreadcrumbItem.icon`). Sits *inside* the link /
    // current-page element as an inline box rather than turning that element
    // into a flex container: `link`/`currentPage` carry `truncate`, and
    // `text-overflow` never reaches the anonymous flex item a text child would
    // become. `align-middle` is the same inline-icon alignment Kbd uses.
    icon: 'inline-flex items-center justify-center shrink-0 align-middle mr-1.5',
    // Collapse affordance: the "…" button shown in place of the folded middle
    // items. Styled as a quiet link; expands the full trail on click.
    ellipsis: [
      'inline-flex items-center justify-center rounded-sm px-1',
      'text-text-tertiary hover:text-text-primary cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    separator: 'mx-2 text-text-tertiary select-none'
  },
  variants: {
    size: {
      sm: {
        list: 'text-xs gap-0.5',
        separator: 'mx-1.5',
        icon: 'size-3.5'
      },
      md: {
        list: 'text-sm gap-1',
        separator: 'mx-2',
        icon: 'size-4'
      },
      lg: {
        list: 'text-base gap-1',
        separator: 'mx-2',
        icon: 'size-5'
      }
    },
    // Overflow strategy when the trail runs out of horizontal room.
    // `wrap` (default): the trail wraps to multiple lines — the standard
    // free-flowing breadcrumb. `false`: the trail stays on one line and the
    // current page (always the last item) truncates while the ancestor links
    // hold their width — for tight single-line bars (sticky headers, toolbars)
    // where the page name is the part worth shortening. Pair with `maxItems`
    // to fold the middle into a "…" before the current page has to truncate.
    wrap: {
      true: {
        list: 'flex-wrap'
      },
      false: {
        nav: 'min-w-0',
        list: 'flex-nowrap min-w-0 [&>li:not(:last-child)]:shrink-0 [&>li:last-child]:min-w-0 [&>li:last-child]:shrink',
        // Let the current page consume the available width and truncate, rather
        // than capping at the wrap-mode max-width.
        currentPage: 'max-w-none'
      }
    }
  },
  defaultVariants: {
    size: 'md',
    wrap: true
  }
});

export type BreadcrumbVariants = VariantProps<typeof breadcrumbVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type BreadcrumbSlots = SlotNames<typeof breadcrumbVariants>;
