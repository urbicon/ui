import type { Snippet } from 'svelte';
import type { RelatedLink, TocNavigationItem } from '../TableOfContents/index.js';
import type { DocsLayoutSlots, DocsLayoutVariantProps } from './docslayout.variants';

export type { RelatedLink, TocNavigationItem };

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Standard documentation page layout with optional table of contents.
 * Provides a responsive two-column layout: a rail on desktop, a popover in the
 * pinned strip below it.
 *
 * The strip renders whenever it has something to carry — a title or
 * `breadcrumbs` (shown as a trail), a `sourceHref`, or the mobile table of
 * contents. It stays pinned for the whole scroll, and the hero title morphs
 * into its last crumb once the header scrolls out of view.
 *
 * Anchor jumps land clear of it: the strip publishes its height, and every
 * `<Section>` reads the resulting `--docs-anchor-offset` as its scroll margin.
 *
 * @example
 * ```svelte
 * <DocsLayout
 *   title="Badge"
 *   description="Status and labels"
 *   breadcrumbs={[
 *     { label: 'Blocks', href: '/blocks' },
 *     { label: 'Primitives', href: '/blocks/primitives' }
 *   ]}
 *   showToc
 *   navigation={nav}
 * >
 *   <Section id="examples">...</Section>
 * </DocsLayout>
 * ```
 * @summary Page shell for documentation, with a hero header, breadcrumb strip, table of contents and content column.
 * @tag layout
 *
 */
export interface DocsLayoutProps extends DocsLayoutVariantProps {
  /** Page title rendered as an h1 in the header area. */
  title?: string;
  /** Short description rendered below the title. */
  description?: string;
  /**
   * Show a table of contents: the sticky rail on desktop, a popover in the
   * pinned strip below `lg`. Both halves follow this one prop, so switching it
   * off leaves neither behind. Needs `navigation` to have entries.
   * @default false
   */
  showToc?: boolean;
  /**
   * Navigation items for the table of contents (nested children supported).
   * @default []
   */
  navigation?: TocNavigationItem[];
  /**
   * Structured breadcrumb trail (ancestors only, title is appended
   * automatically). A top-level page needs none — the strip then shows the
   * title alone.
   */
  breadcrumbs?: BreadcrumbItem[];
  /**
   * Editorial stability badge — drives the `[STABLE]` / `[BETA]` / etc.
   * stamp above the page title. When omitted, no badge renders; the
   * default is applied upstream in docs-gen, so component pages
   * receive `'stable'` automatically via `componentData?.stability`.
   */
  stability?: 'experimental' | 'beta' | 'stable' | 'deprecated';
  /**
   * GitHub blob URL for the component's source file — rendered as a
   * `source ↗` link next to the stability badge when present.
   */
  sourceHref?: string;
  /**
   * Optional related-links list — passed through to the TableOfContents
   * as a `// RELATED` block below the page sections. Each entry needs a
   * pre-resolved `href`; the layout does not call `resolve()` on it.
   */
  related?: RelatedLink[];
  /** Page body content. */
  children?: Snippet;
  /** Extra classes merged onto the root container. */
  class?: string;
  /**
   * Remove all default tv styles.
   * @default false
   */
  unstyled?: boolean;
  /**
   * Show the global code-visibility toggle for collapsing all code examples.
   * @default true
   */
  showCodeToggle?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<DocsLayoutSlots, string>>;
}

export { default } from './DocsLayout.svelte';
export {
  type DocsLayoutSlots,
  type DocsLayoutVariantProps,
  docsLayoutVariants
} from './docslayout.variants';
export { setPageNav as setDocsPageNav } from './page-nav';
