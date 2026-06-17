import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { BreadcrumbVariants } from './breadcrumb.variants';

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
  /** Accessible label for the nav element @default 'Breadcrumb' */
  'aria-label'?: string;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides */
  slotClasses?: Partial<
    Record<'nav' | 'list' | 'item' | 'link' | 'currentPage' | 'separator', string>
  >;
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
