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
    // Wrapper for a per-item leading icon (`BreadcrumbItem.icon`) — layout and
    // spacing only, no box size. The glyph carries its own absolute size (see
    // `glyphSize` in Breadcrumb.svelte), because an `unstyled` trail empties
    // this slot down to whatever the consumer passed: a glyph sized off its
    // wrapper would then resolve against the crumb link instead (measured at
    // 96×96 for a 16px icon). Same split as Menu's `indicator` slot, which is
    // likewise layout-only against a hardcoded `h-4 w-4` on the icon.
    //
    // It sits *inside* link/currentPage as an inline box rather than turning
    // either into a flex container: both carry `truncate`, and `text-overflow`
    // never reaches the anonymous flex item a bare text child would become —
    // breadcrumb.variants.test.ts pins that. No `shrink-0`: the parent here is
    // always a block (`<a>` / the current-page `<span>`), never a flex
    // container, so `flex-shrink` has nothing to act on.
    icon: 'inline-flex items-center justify-center align-middle',
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
      // The icon's gap to its label scales with the glyph — a fixed margin sits
      // proportionally wrong at `sm` and `lg`. It lives per size rather than as
      // a base token an override would strip in every branch (a dead token by
      // variants-lint's definition).
      sm: {
        list: 'text-xs gap-0.5',
        separator: 'mx-1.5',
        icon: 'mr-1'
      },
      md: {
        list: 'text-sm gap-1',
        separator: 'mx-2',
        icon: 'mr-1.5'
      },
      lg: {
        list: 'text-base gap-1',
        separator: 'mx-2',
        icon: 'mr-2'
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
