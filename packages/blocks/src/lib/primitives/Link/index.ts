import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import type { LinkSlots, LinkVariants } from './link.variants';

/**
 * @summary A word with an address — a link in prose, or a handle in a navigation strip.
 * @description The anchor voice of the Navigation family. Tailwind's preflight strips every
 * default from `<a>`, so an unstyled anchor carries no affordance at all; `Link` puts one back
 * in two voices: `inline` for running prose, where an underline (not a colour) marks the link,
 * and `standalone` for a handle in a `<nav>`, a filter row or a table header, where the text
 * rests at tertiary and steps up to document ink on hover.
 *
 * **Always an `<a>`, never polymorphic.** A single-box control does not swap its root element
 * (COMPONENT-API-CONVENTIONS.md § Polymorphic Elements), and `Link` is the member to reach for
 * where the whole component *is* the anchor. A link that should *look* like a button is still
 * the `LinkButton` wrapper recipe over `buttonVariants()` — that is a button look, not a link
 * look.
 *
 * `href` is opaque to the library: `resolve()`, internal-vs-external and prefetch are the
 * consumer's routing decisions, exactly as for `BreadcrumbItem.href`. `target`, `rel`,
 * `onclick` and every other anchor attribute travel through `restProps`, so an external link is
 * `<Link href="…" target="_blank" rel="noopener noreferrer">` and needs no `external` prop.
 *
 * Size is inherited, never chosen: a link takes the type scale of the text around it, so there
 * is no `size` axis. There is no `intent` either — a link is not a fill.
 *
 * `active` marks the current page (`aria-current="page"`) and lifts the link to document ink at
 * `font-medium`; `disabled` renders it inert (`aria-disabled="true"`, `tabindex="-1"`,
 * `pointer-events-none`) while keeping the `href` readable and copyable. Neither adds a
 * keyboard trap: a disabled link leaves the tab order rather than swallowing focus.
 *
 * @tag navigation
 * @related Breadcrumb
 * @related Pagination
 * @related Button
 *
 * @example A link in running prose
 * ```svelte
 * <p>
 *   Read the <Link href="/docs/tokens">token reference</Link> before changing a palette.
 * </p>
 * ```
 *
 * @example Route tabs — a nav of standalone handles, one of them current
 * ```svelte
 * <script lang="ts">
 *   import { Link } from '@urbicon-ui/blocks';
 *   import { page } from '$app/state';
 *
 *   const tabs = [
 *     { label: 'Overview', href: '/project/1' },
 *     { label: 'Settings', href: '/project/1/settings' }
 *   ];
 * </script>
 *
 * <nav aria-label="Project sections" class="flex gap-4">
 *   {#each tabs as tab (tab.href)}
 *     <Link variant="standalone" href={tab.href} active={page.url.pathname === tab.href}>
 *       {tab.label}
 *     </Link>
 *   {/each}
 * </nav>
 * ```
 */
export interface LinkProps
  extends LinkVariants,
    Omit<HTMLAnchorAttributes, 'children' | 'class' | 'href'> {
  /**
   * The address the link points at. Opaque to the library — it is written to the `href`
   * attribute unchanged, so `resolve()`, a base path and the internal-vs-external decision stay
   * in app code. Required: a Link without an address is not a Link.
   * @summary Where the link points. Written to href unchanged; resolve() stays yours.
   */
  href: string;
  /**
   * Link voice. `inline` sits in running prose and is marked by its underline; `standalone` is
   * a handle in a `<nav>`, a filter row or a table header and carries none.
   * @summary Underlined in prose, or a bare handle for a nav strip.
   * @default 'inline'
   */
  variant?: 'inline' | 'standalone';
  /**
   * Mark this link as the one the current page is at: it renders `aria-current="page"`, lifts
   * the link to document ink at `font-medium` and drops its hover state — you are already
   * there. `active` is the shorthand for the page case and wins where both are given, so the
   * other `aria-current` values (`"step"` in a wizard trail, `"true"` for a non-page target)
   * are reached by passing `aria-current` and leaving `active` unset.
   * @summary Marks the current page — aria-current="page", ink, medium weight, no hover.
   * @default false
   */
  active?: boolean;
  /**
   * Render the link inert: `aria-disabled="true"`, `tabindex="-1"` and `pointer-events-none`,
   * at reduced opacity. The `href` stays on the element — a disabled link keeps its address
   * readable and copyable, it just leaves the tab order and answers no click.
   * @summary Inert link — out of the tab order, no pointer events, href kept.
   * @default false
   */
  disabled?: boolean;
  /** The link text. Required — the anchor's accessible name is what it renders. */
  children: Snippet;
  /** Additional CSS class merged onto the root `<a>`. */
  class?: string;
  /** Strip all default styles; combine with slotClasses to rebuild from scratch. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base */
  slotClasses?: Partial<Record<LinkSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Link: {...} }}>`.
   * Prefer this over `class` overrides when a project wants one link look everywhere —
   * presets keep the hover and dark-mode logic coherent and reusable.
   */
  preset?: string;
}

export { default as Link } from './Link.svelte';
export { type LinkVariants, linkVariants } from './link.variants';
