import type { TableOfContentsSlots, TableOfContentsVariantProps } from './tableofcontents.variants';

export interface RelatedLink {
  label: string;
  href: string;
}

/**
 * One page section in the on-this-page nav — shared by TableOfContents and
 * DocsLayout so both speak the same navigation shape (the layout hands the
 * array through to the TOC).
 */
/**
 * A single entry in the table of contents.
 *
 * The list renders in array order. There is deliberately no `order` field: one
 * existed until 2026-08, was never read by anything, and 119 pages maintained
 * it — 660 entries — the Button reference page had drifted to `api: 7` / `installation: 6`
 * while rendering them the other way round, and nobody noticed because nothing
 * sorts. Order the array; that is the order.
 */
export interface TocNavigationItem {
  id: string;
  title: string;
  href?: string;
  children?: Array<{ id: string; title: string; href?: string }>;
}

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
 * @summary Sticky page navigation that tracks scroll position and links on to related pages.
 * @tag navigation
 */
export interface TableOfContentsProps extends TableOfContentsVariantProps {
  /** Heading rendered above the nav links. Defaults to the localized "On this page". */
  title?: string;
  /** Navigation items with optional nested children. */
  navigation: TocNavigationItem[];
  /** Enable scroll-based active section tracking. */
  trackScroll?: boolean;
  /**
   * Controlled active-section id. When provided (DocsLayout does this with
   * its layout-wide scrollspy), the TOC renders the active marker from it
   * and never starts its own scroll listener; leave undefined for
   * standalone use, where the TOC tracks scroll itself (`trackScroll`).
   */
  activeSection?: string;
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
  slotClasses?: Partial<Record<TableOfContentsSlots, string>>;
}

export { default } from './TableOfContents.svelte';
export {
  type TableOfContentsSlots,
  type TableOfContentsVariantProps,
  tableOfContentsVariants
} from './tableofcontents.variants.js';
