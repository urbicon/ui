import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { BreadcrumbSlots, BreadcrumbVariants } from './breadcrumb.variants';

/** Single breadcrumb item definition */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Navigation URL (omit for current page) */
  href?: string;
  /**
   * Click handler. Use alongside or instead of `href` when navigation
   * happens through a client-side router or shouldn't follow the link
   * (e.g. demos with non-existent routes — call `event.preventDefault()`).
   */
  onclick?: (event: MouseEvent) => void;
  /** Accessible label override */
  'aria-label'?: string;
}

/**
 * Props interface for Breadcrumb component
 *
 * @description Navigation aid showing the current page's location in a hierarchy.
 * Renders an accessible nav with structured items and customizable separators.
 *
 * @tag navigation
 * @related Tab
 * @related Stepper
 *
 * @example
 * ```svelte
 * <Breadcrumb items={[
 *   { label: 'Home', href: '/' },
 *   { label: 'Products', href: '/products' },
 *   { label: 'Widget' }
 * ]} />
 * ```
 *
 * @example
 * ```svelte
 * <Breadcrumb items={breadcrumbs} size="sm">
 *   {#snippet separator()}<ChevronRight size={14} />{/snippet}
 * </Breadcrumb>
 * ```
 *
 * @example Collapse a long trail — middle items fold into an expandable "…"
 * ```svelte
 * <Breadcrumb items={deepTrail} maxItems={4} />
 * ```
 */
export interface BreadcrumbProps
  extends BreadcrumbVariants,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Ordered breadcrumb items (last item is current page) */
  items: BreadcrumbItem[];
  /** Size @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Custom separator snippet (default: "/") */
  separator?: Snippet;
  /**
   * Collapse the trail when it has more than this many items: the middle items
   * fold into a single "…" button that expands the full trail on click. The
   * first `itemsBeforeCollapse` and last `itemsAfterCollapse` items stay
   * visible (the current page is always kept). Omit to never collapse.
   */
  maxItems?: number;
  /** Leading items kept visible when collapsed. @default 1 */
  itemsBeforeCollapse?: number;
  /** Trailing items kept visible when collapsed; the current page is always included. @default 1 */
  itemsAfterCollapse?: number;
  /** Accessible label for the "…" button that expands a collapsed trail. @default 'Show all breadcrumb items' */
  expandLabel?: string;
  /** Accessible label for the nav element @default 'Breadcrumb' */
  'aria-label'?: string;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides */
  slotClasses?: Partial<Record<BreadcrumbSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Breadcrumb: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Breadcrumb } from './Breadcrumb.svelte';
export { type BreadcrumbVariants, breadcrumbVariants } from './breadcrumb.variants';

/** Re-export as BreadcrumbItemType for barrel-level consumption */
export type { BreadcrumbItem as BreadcrumbItemType };
