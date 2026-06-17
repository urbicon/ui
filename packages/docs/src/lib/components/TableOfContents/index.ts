import type { TableOfContentsVariantProps } from './tableofcontents.variants';

/**
 * Sticky sidebar navigation that tracks scroll position and highlights the active section.
 * Hidden on mobile (DocsLayout provides a collapsible mobile alternative).
 *
 * @example
 * ```svelte
 * <TableOfContents
 *   navigation={[
 *     { id: 'usage', title: 'Usage' },
 *     { id: 'api', title: 'API', children: [{ id: 'props', title: 'Props' }] }
 *   ]}
 * />
 * ```
 */
export interface RelatedLink {
  label: string;
  href: string;
}

export interface TableOfContentsProps extends TableOfContentsVariantProps {
  /** Heading rendered above the nav links. */
  title?: string;
  /** Navigation items with optional nested children. */
  navigation: Array<{
    id: string;
    title: string;
    order?: number;
    href?: string;
    children?: Array<{ id: string; title: string; order?: number; href?: string }>;
  }>;
  /** Enable scroll-based active section tracking. */
  trackScroll?: boolean;
  /**
   * Optional Editorial `// RELATED` block rendered below the main nav.
   * Each entry needs a pre-resolved `href` (the TOC does not call
   * `resolve()`, mirroring the existing nav behaviour). When omitted,
   * the related block does not render at all.
   */
  related?: RelatedLink[];
  /**
   * Render the Editorial `// CODE` block at the bottom of the TOC,
   * hosting the global show-/hide-all-code toggle. Requires a host
   * page that provided a `CodeVisibilityStore` via context — the
   * block silently skips itself if no store is found, so callers
   * outside of `DocsLayout` don't have to know about it.
   * @default true
   */
  showCodeToggle?: boolean;
  /** Extra classes merged onto the root aside element. */
  class?: string;
  /** Remove all default tv styles. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      | 'aside'
      | 'title'
      | 'nav'
      | 'relatedTitle'
      | 'relatedNav'
      | 'relatedLink'
      | 'codeTitle'
      | 'codeToggle',
      string
    >
  >;
}

export { default } from './TableOfContents.svelte';
export {
  type TableOfContentsVariantProps,
  tableOfContentsVariants
} from './tableofcontents.variants.js';
