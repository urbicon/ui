import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SidebarSlots, SidebarVariants } from './sidebar.variants';

/**
 * @summary A side panel: permanent on desktop, an overlay on a phone.
 * @description Sidebar primitive — fixed-position panel that is permanent on
 * desktop (≥1024px) and slides in as a backdropped overlay on mobile. Use
 * this directly for right-side detail panels or custom shells. For the
 * standard "permanent left rail + mobile hamburger" application chrome,
 * prefer the higher-level `<SidebarLayout>` component, which handles main
 * content offset and the mobile header for you.
 *
 * The component exposes `--sidebar-width` and `--sidebar-effective-width`
 * (0px when collapsed) as CSS variables on its `<aside>` element. CSS
 * custom properties only inherit to descendants, so these variables are
 * available **inside** the sidebar's subtree but not on its siblings — that
 * is precisely why `<SidebarLayout>` exists for app-shell layouts.
 *
 * @tag layout
 * @tag navigation
 * @related SidebarLayout
 * @related Drawer
 *
 * @example Right-side detail panel — opens as an overlay on click
 * ```svelte
 * <script>
 *   import { Sidebar, Button, CloseIcon, Badge } from '@urbicon-ui/blocks';
 *   let detailOpen = $state(false);
 * </script>
 *
 * <Button onclick={() => (detailOpen = true)}>Show details</Button>
 *
 * <Sidebar bind:open={detailOpen} side="right" width="20rem">
 *   {#snippet header()}
 *     <div class="flex items-center justify-between py-3">
 *       <span class="font-semibold">Item details</span>
 *       <Button variant="ghost" size="xs" onclick={() => (detailOpen = false)}>
 *         <CloseIcon class="h-4 w-4" />
 *       </Button>
 *     </div>
 *   {/snippet}
 *   <div class="space-y-3 p-4">
 *     <dt class="text-text-tertiary text-xs">Status</dt>
 *     <dd><Badge intent="success" size="sm">Active</Badge></dd>
 *   </div>
 * </Sidebar>
 * ```
 *
 * @example Collapsible — toggleable on all viewports (custom shell)
 * ```svelte
 * <Sidebar bind:open={sidebarOpen} mode="collapsible" width="16rem">
 *   {#snippet header()}<span class="font-semibold">App</span>{/snippet}
 *   <nav class="p-3"><!-- links --></nav>
 * </Sidebar>
 * ```
 */
export interface SidebarProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Controls sidebar visibility. In `responsive` mode (default) this only affects the mobile overlay — on desktop the sidebar is always visible. In `collapsible` mode this controls visibility at all viewports. Supports bind:open. */
  open?: boolean;

  /** Controls sidebar behavior across viewports.
   * - `responsive` (default): permanently visible on desktop (≥1024px), slide-in overlay on mobile.
   * - `collapsible`: toggleable via `open` at all viewports — width animation on desktop, overlay on mobile.
   * @default 'responsive' */
  mode?: SidebarVariants['mode'];

  /** Which edge the sidebar attaches to. @default 'left' */
  side?: SidebarVariants['side'];

  /**
   * CSS width of the sidebar panel. Also exposed as `--sidebar-width`
   * (constant) and `--sidebar-effective-width` (0px when collapsed) CSS
   * variables on the `<aside>`. These inherit only inside the sidebar's
   * own subtree — for the main content offset use `<SidebarLayout>`.
   * @default '16rem'
   * @summary How wide the panel is when open.
   */
  width?: string;

  /** Close the mobile overlay when pressing Escape. @default true */
  closeOnEscape?: boolean;

  /** Close the mobile overlay when clicking the backdrop. @default true */
  closeOnBackdropClick?: boolean;

  /** Fires when the open state changes (mobile overlay dismissed, or collapsible toggled). */
  onOpenChange?: (open: boolean) => void;

  /** Content rendered in the sidebar header (above the scrollable area). */
  header?: Snippet;

  /** Content rendered in the sidebar footer (below the scrollable area). */
  footer?: Snippet;

  /** Main scrollable content of the sidebar. */
  children?: Snippet;

  /** Additional CSS classes applied to the sidebar panel. */
  class?: string;

  /** Strip all default styles. Combine with slotClasses for custom appearance. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with variant styles. */
  slotClasses?: Partial<Record<SidebarSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Sidebar: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Sidebar } from './Sidebar.svelte';
export { type SidebarVariants, sidebarVariants } from './sidebar.variants';
