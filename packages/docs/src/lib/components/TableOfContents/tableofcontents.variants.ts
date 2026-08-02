import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const tableOfContentsVariants = tv({
  slots: {
    // Desktop-only (max-lg:hidden), so no mobile-header offset applies:
    // top-20 = the pinned breadcrumb strip (~2.6rem) + breathing room,
    // roughly matching the wrapper's pt-8 content edge.
    aside: ['max-lg:hidden sticky top-20 shrink-0 self-start'],
    // `text-text-tertiary` and uppercase are kept as fallback for pages
    // without the rooms scope; `meta-marker` (in rooms-docs.css) overrides
    // font + colour when the host root has `docs-rooms`.
    title: ['mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    // No left rail — the active indicator is a small room-accent SQUARE
    // rendered via ::before on the active link: the rooms block-cursor
    // signature (favicon, sidebar wordmark), not the editorial pipe.
    nav: ['flex flex-col'],
    link: ['relative py-1.5 pl-4 text-sm', 'transition-colors duration-(--blocks-duration-fast)'],
    // The square sits at left-1 (4 px from the element edge) so it reads
    // as part of the indent column rather than glued to the container;
    // top-1/2 + -translate centers it against the link's line-height.
    linkActive: [
      'font-medium text-primary',
      'before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2',
      "before:size-1.5 before:bg-primary before:content-['']"
    ],
    linkInactive: ['text-text-tertiary hover:text-text-secondary'],
    childLink: [
      'relative py-1 pl-8 text-xs',
      'transition-colors duration-(--blocks-duration-fast)'
    ],
    // Child square sits at left-5 (20 px), one step smaller to match the
    // xs child text, indenting under the parent marker.
    childLinkActive: [
      'font-medium text-primary',
      'before:absolute before:left-5 before:top-1/2 before:-translate-y-1/2',
      "before:size-1 before:bg-primary before:content-['']"
    ],
    childLinkInactive: ['text-text-tertiary hover:text-text-tertiary'],
    // `RELATED` kicker — mirrors the `ON THIS PAGE` kicker above the main
    // nav, with a top-margin separating the two sections visually.
    relatedTitle: ['mt-6 mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    relatedNav: ['flex flex-col'],
    // Related links leave the page — a quiet underline separates them from
    // the in-page anchors above (which never underline). No pl-4: the
    // indent column exists only for the active marker of the section nav.
    relatedLink: [
      'py-1.5 text-sm text-text-tertiary',
      'underline underline-offset-4 decoration-text-quaternary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-secondary hover:decoration-current'
    ],
    // `CODE` kicker — hosts the global show/hide-all-code toggle. Same
    // kicker spacing as RELATED; the toggle itself is a muted text-link
    // with icon + label, no chrome (action = text, not button surface).
    codeTitle: ['mt-6 mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    codeToggle: [
      'group relative flex items-center gap-2 py-1.5 text-sm text-text-tertiary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-primary',
      'focus-visible:outline-none focus-visible:text-text-primary',
      'cursor-pointer w-full text-left'
    ],
    // Underline lives on the label span — text-decoration does not
    // propagate into flex items, so the flex button itself can't carry it.
    codeToggleLabel: [
      'underline underline-offset-4 decoration-text-quaternary',
      'group-hover:decoration-current'
    ]
  },
  variants: {
    position: {
      left: { aside: 'order-first' },
      right: {}
    },
    width: {
      sm: { aside: 'w-48' },
      md: { aside: 'w-52' },
      lg: { aside: 'w-60' }
    }
  },
  defaultVariants: {
    position: 'right',
    width: 'md'
  }
});

export type TableOfContentsVariantProps = VariantProps<typeof tableOfContentsVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TableOfContentsSlots = SlotNames<typeof tableOfContentsVariants>;
