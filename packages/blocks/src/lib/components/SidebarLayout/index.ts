import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SidebarLayoutVariants } from './sidebar-layout.variants';

/**
 * Snippet payload for the `mobileHeader` slot. Receives an opener for the
 * sidebar overlay so the consumer can wire a hamburger button without
 * threading state through the layout.
 */
export interface MobileHeaderContext {
  /** Open the sidebar (mobile overlay or collapsible panel). */
  openSidebar: () => void;
  /** Current open state of the sidebar. */
  sidebarOpen: boolean;
}

type SidebarLayoutSlot =
  | 'root'
  | 'mobileHeader'
  | 'main'
  | 'inner'
  | 'sidebar'
  | 'sidebarBackdrop'
  | 'sidebarHeader'
  | 'sidebarContent'
  | 'sidebarFooter';

/**
 * @description App-shell layout that wires a `<Sidebar>` to a main content
 * region and an optional mobile header. Use this whenever you want a
 * permanent sidebar on desktop with a hamburger overlay on mobile — it
 * resolves the CSS-variable scoping so the main content offset works without
 * boilerplate.
 *
 * The component renders the sidebar internally; consumers configure it via
 * `sidebarHeader`, `sidebar`, and `sidebarFooter` snippets and bind `open`
 * for the mobile overlay (or for collapsible mode at all viewports).
 *
 * For non-shell sidebars (right-side detail panels, drawers inside a page),
 * keep using the `<Sidebar>` primitive directly.
 *
 * @tag layout
 * @tag navigation
 * @related Sidebar
 *
 * @example Default app shell with mobile header
 * ```svelte
 * <script>
 *   import { SidebarLayout, Button, MenuIcon } from '@urbicon-ui/blocks';
 *   let sidebarOpen = $state(false);
 * </script>
 *
 * <SidebarLayout bind:open={sidebarOpen} sidebarWidth="16rem">
 *   {#snippet sidebarHeader()}
 *     <a href="/" class="font-semibold">My App</a>
 *   {/snippet}
 *
 *   {#snippet sidebar()}
 *     <nav class="flex flex-col gap-1 p-3">
 *       <a href="/dashboard">Dashboard</a>
 *       <a href="/settings">Settings</a>
 *     </nav>
 *   {/snippet}
 *
 *   {#snippet mobileHeader({ openSidebar })}
 *     <Button variant="ghost" size="sm" onclick={openSidebar} aria-label="Open menu">
 *       <MenuIcon />
 *     </Button>
 *     <span class="font-semibold">My App</span>
 *   {/snippet}
 *
 *   <h1>Page content</h1>
 * </SidebarLayout>
 * ```
 *
 * @example Collapsible — toggleable on all viewports
 * ```svelte
 * <SidebarLayout bind:open={sidebarOpen} mode="collapsible" sidebarWidth="16rem">
 *   {#snippet sidebarHeader()}<span class="font-semibold">App</span>{/snippet}
 *   {#snippet sidebar()}<nav class="p-3"><!-- … --></nav>{/snippet}
 *
 *   <Button onclick={() => (sidebarOpen = !sidebarOpen)}>Toggle</Button>
 *   <!-- main content -->
 * </SidebarLayout>
 * ```
 */
export interface SidebarLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Sidebar visibility. In `responsive` mode this only affects the mobile
   * overlay. In `collapsible` mode it controls visibility at all viewports.
   * Supports `bind:open`.
   * @default false
   */
  open?: boolean;

  /**
   * Sidebar mode.
   * - `responsive` (default): permanent on desktop (≥1024px), slide-in overlay on mobile.
   * - `collapsible`: toggleable at all viewports — width animation on desktop, overlay on mobile.
   * @default 'responsive'
   */
  mode?: 'responsive' | 'collapsible';

  /** Which edge the sidebar attaches to. @default 'left' */
  side?: SidebarLayoutVariants['side'];

  /**
   * Sidebar panel width. Single source of truth — the layout exposes it as
   * `--sidebar-width` (constant) and `--sidebar-effective-width` (animates to
   * `0` when collapsed) on the layout root, so the main content offset stays
   * in sync automatically.
   * @default '16rem'
   */
  sidebarWidth?: string;

  /** Close the mobile sidebar overlay when pressing Escape. @default true */
  closeOnEscape?: boolean;

  /** Close the mobile sidebar overlay when clicking the backdrop. @default true */
  closeOnBackdropClick?: boolean;

  /** Maximum width of the centered content column. @default 'xl' */
  contentMaxWidth?: SidebarLayoutVariants['contentMaxWidth'];

  /** Fires when the sidebar open state changes. */
  onOpenChange?: (open: boolean) => void;

  /** Sidebar header (above the scrollable nav). */
  sidebarHeader?: Snippet;

  /** Sidebar main content — typically a `<nav>`. */
  sidebar?: Snippet;

  /** Sidebar footer (below the scrollable nav). */
  sidebarFooter?: Snippet;

  /**
   * Mobile header bar, hidden on desktop in `responsive` mode. Receives a
   * helper to open the sidebar so a hamburger button needs no extra wiring.
   * If omitted, no mobile header is rendered.
   */
  mobileHeader?: Snippet<[MobileHeaderContext]>;

  /** Page content rendered inside the centered main column. */
  children?: Snippet;

  /** Additional CSS classes applied to the root wrapper. */
  class?: string;

  /** Strip all default styles. Combine with `slotClasses` for a custom layout. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides. `sidebar*` slots are forwarded to the embedded
   * `<Sidebar>` component (mapped to its `slotClasses.panel`/`header`/...).
   */
  slotClasses?: Partial<Record<SidebarLayoutSlot, string>>;

  /**
   * Apply a named preset registered via
   * `<BlocksProvider presets={{ SidebarLayout: {...} }}>`. Use this to share
   * a branded shell look across the app instead of repeating class overrides.
   */
  preset?: string;
}

export { default as SidebarLayout } from './SidebarLayout.svelte';
export { type SidebarLayoutVariants, sidebarLayoutVariants } from './sidebar-layout.variants';
