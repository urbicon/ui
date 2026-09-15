import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import type { LinkSlots, LinkVariants } from './link.variants';

/**
 * @summary A word with an address — a link in prose, or a handle in a navigation strip.
 * @description The anchor voice of the Navigation family. Tailwind's preflight strips every
 * default from `<a>`, so an unstyled anchor carries no affordance at all; `Link` puts one back
 * in two voices: `inline` for running prose, which paints `--color-text-link` and underlines it —
 * two cues, and that token is the lever for restyling every link in a project without touching
 * the primary intent — and `standalone` for a handle in a `<nav>`, a filter row or a table
 * header, which carries no underline and rests at tertiary, stepping up to document ink on hover.
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
 * `font-medium`; `disabled` renders it inert — `aria-disabled="true"`, `tabindex="-1"`,
 * `pointer-events-none` and a click handler that cancels the navigation, so an
 * assistive-technology activation and Enter on a focused link answer nothing either — while
 * keeping the `href` readable and copyable. Neither adds a keyboard trap: a disabled link leaves
 * the tab order rather than swallowing focus.
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
   * Link voice. `inline` sits in running prose, painted in `--color-text-link` and underlined;
   * `standalone` is a handle in a `<nav>`, a filter row or a table header — no underline, and it
   * takes its colour from the ink ramp rather than the link token.
   * @summary Link ink and an underline for prose, or a bare handle for a nav strip.
   * @default 'inline'
   */
  variant?: 'inline' | 'standalone';
  /**
   * Mark this link as the one the current page is at: it renders `aria-current="page"`, lifts
   * the link to document ink at `font-medium` and drops its hover state — you are already
   * there. Written for the `standalone` voice, where a current handle in a strip is the point;
   * on an `inline` link it also changes the weight mid-sentence, so where only the attribute is
   * wanted pass `aria-current="page"` directly instead. `active` is the shorthand for the page
   * case and wins where both are given, so the other `aria-current` values (`"step"` in a wizard
   * trail, `"true"` for a non-page target) are reached by passing `aria-current` and leaving
   * `active` unset.
   * @summary Marks the current handle — aria-current="page", ink, medium weight, no hover.
   * @default false
   */
  active?: boolean;
  /**
   * Render the link inert: `aria-disabled="true"`, `tabindex="-1"`, `pointer-events-none` and a
   * click handler that cancels the navigation — so a pointer, Enter on a focused link and an
   * assistive-technology activation all do nothing, and a consumer's own `onclick` is not called
   * either. Drawn at reduced opacity. The `href` stays on the element: a disabled link keeps its
   * address readable and copyable, it just leaves the tab order and answers nothing.
   * @summary Inert link — out of the tab order, answers no activation, href kept.
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
