import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const tableOfContentsVariants = tv({
  slots: {
    aside: ['max-lg:hidden sticky top-20 shrink-0 self-start'],
    // `text-text-tertiary` and uppercase are kept as fallback for pages
    // without the editorial scope; `meta-marker` (in editorial.css)
    // overrides font + colour when the host root has `docs-editorial`.
    title: ['mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    // No left rail — the editorial active indicator is a pipe glyph
    // rendered via ::before on the active link, matching the page-title
    // and section-title accent.
    nav: ['flex flex-col'],
    link: ['relative py-1.5 pl-4 text-sm', 'transition-colors duration-(--blocks-duration-fast)'],
    // The pipe sits at left-1 (4 px from the element edge) so it reads
    // as part of the indent column rather than glued to the container.
    // inset-y-0 + flex items-center centers the glyph vertically against
    // the line-height of the link text.
    linkActive: [
      'font-medium text-primary',
      'before:absolute before:inset-y-0 before:left-1 before:flex before:items-center',
      'before:text-primary before:content-["|"]'
    ],
    linkInactive: ['text-text-tertiary hover:text-text-secondary'],
    childLink: [
      'relative py-1 pl-8 text-xs',
      'transition-colors duration-(--blocks-duration-fast)'
    ],
    // Child pipe sits at left-5 (20 px) so it indents under the parent
    // pipe instead of crowding the container edge.
    childLinkActive: [
      'font-medium text-primary',
      'before:absolute before:inset-y-0 before:left-5 before:flex before:items-center',
      'before:text-primary before:content-["|"]'
    ],
    childLinkInactive: ['text-text-tertiary hover:text-text-tertiary'],
    // Editorial `// RELATED` block —
    // mirrors the `// ON THIS PAGE` kicker above the main nav, with a
    // top-margin separating the two sections visually.
    relatedTitle: ['mt-6 mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    relatedNav: ['flex flex-col'],
    relatedLink: [
      'relative py-1.5 pl-4 text-sm text-text-tertiary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-secondary'
    ],
    // Editorial `// CODE` block — hosts the global show/hide-all-code
    // toggle. Same kicker spacing as RELATED; the toggle itself is a
    // muted text-link with icon + label, no chrome, mirroring the
    // editorial vocabulary (action = text, not button surface).
    codeTitle: ['mt-6 mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    codeToggle: [
      'relative flex items-center gap-2 py-1.5 pl-4 text-sm text-text-tertiary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-primary',
      'focus-visible:outline-none focus-visible:text-text-primary',
      'cursor-pointer w-full text-left'
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
