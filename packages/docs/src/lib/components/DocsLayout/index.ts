import type { Snippet } from 'svelte';
import type { RelatedLink, TocNavigationItem } from '../TableOfContents/index.js';
import type { DocsLayoutVariantProps } from './docslayout.variants';

export type { RelatedLink, TocNavigationItem };

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Standard documentation page layout with optional table of contents.
 * Provides a responsive two-column layout with a mobile ToC fallback.
 *
 * When `breadcrumbs` is provided, the layout uses a collapsing-hero pattern:
 * a unified sticky bar shows breadcrumbs + code toggle initially, then
 * transitions to a compact bar with title + scrollspy when the header
 * scrolls out of view.
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
 */
export interface DocsLayoutProps extends DocsLayoutVariantProps {
  /** Page title rendered as an h1 in the header area. */
  title?: string;
  /** Short description rendered below the title. */
  description?: string;
  /** Show a sticky table of contents sidebar on desktop and a collapsible one on mobile. */
  showToc?: boolean;
  /** Navigation items for the table of contents (nested children supported). */
  navigation?: TocNavigationItem[];
  /**
   * Structured breadcrumb trail (ancestors only, title is appended automatically).
   * Enables the collapsing-hero sticky bar layout.
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
  /** Remove all default tv styles. */
  unstyled?: boolean;
  /** Show the global code-visibility toggle for collapsing all code examples. Default: true. */
  showCodeToggle?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      | 'container'
      | 'wrapper'
      | 'main'
      | 'header'
      | 'headerInner'
      | 'title'
      | 'subtitle'
      | 'content'
      | 'stickyBar'
      | 'stickyBarInner'
      | 'pageToolbar',
      string
    >
  >;
}

export { default } from './DocsLayout.svelte';
export { type DocsLayoutVariantProps, docsLayoutVariants } from './docslayout.variants';
export { setPageNav as setDocsPageNav } from './page-nav';
