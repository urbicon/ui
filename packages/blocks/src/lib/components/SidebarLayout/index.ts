import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SidebarSlots } from '$lib/primitives/Sidebar/sidebar.variants';
import type { DisclosureTriggerProps } from '$lib/utils/use-disclosure.svelte';
import type { SidebarLayoutSlots, SidebarLayoutVariants } from './sidebar-layout.variants';

/**
 * Snippet payload for the `mobileHeader` slot. Receives an opener for the
 * sidebar overlay so the consumer can wire a hamburger button without
 * threading state through the layout.
 */
export interface MobileHeaderContext {
  /** Open the sidebar (mobile overlay or collapsible panel). */
  openSidebar: () => void;
  /** Flip the sidebar open or closed. The `toggle` snippet is the wired-up version of this. */
  toggle: () => void;
  /** Current open state of the sidebar. */
  sidebarOpen: boolean;
}

/**
 * Snippet payload for the `toggle` slot — Collapsible's `trigger` vocabulary
 * (`open`, `toggle`, `triggerId`, `contentId`) plus the ready-made attribute
 * record from `useDisclosure`.
 *
 * The layout renders the snippet at both seams it owns (the rail edge on
 * desktop, the header on mobile) and hands each render its **own**
 * `triggerId`, so spreading `triggerProps` on both cannot produce a duplicate
 * id. `contentId` is the sidebar panel and is the same for both.
 */
export interface SidebarToggleContext {
  /** Whether the sidebar is currently open. */
  open: boolean;
  /** Flip it. */
  toggle: () => void;
  /** DOM id for this render of the trigger — already inside `triggerProps`. */
  triggerId: string;
  /** DOM id of the sidebar panel this trigger controls. */
  contentId: string;
  /** `id` / `aria-expanded` / `aria-controls` — spread these onto your button. */
  triggerProps: DisclosureTriggerProps;
}

/**
 * Slot keys for `slotClasses`. The tv-driven slots (`SidebarLayoutSlots`:
 * root | mobileHeader | main | inner) are the layout's own; each remaining key
 * is one slot of the embedded `<Sidebar>` under a `sidebar` prefix.
 *
 * Both halves of that forwarding derive from `sidebarVariants` — this union by
 * template literal, the mapping in `SidebarLayout.svelte` by walking the same
 * config — so a Sidebar slot renamed, added or dropped moves the two together.
 * They used to be five literals here mapped by hand, and three edits to that
 * map type-checked while reaching no element: a mistyped source key, a swapped
 * pair, and a deleted line (#346).
 */
type SidebarLayoutSlot = SidebarLayoutSlots | SidebarForwardKey;

/**
 * The `slotClasses` keys forwarded to the embedded `<Sidebar>` — one per slot
 * it declares, under a `sidebar` prefix.
 *
 * Exported because `SidebarLayout.svelte` *builds* the key it reads and
 * annotates it with this type. That is what writes the prefix once for both
 * halves: mistyping it in the builder is a compile error, where the resolved
 * record it indexes is a `Record<string, string>` that would otherwise accept
 * any string and quietly return nothing (measured).
 */
export type SidebarForwardKey = `sidebar${Capitalize<SidebarSlots>}`;

/**
 * @summary The app shell — sidebar, content, and the mobile header that opens it.
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
 * @example Collapsible — the toggle snippet, remembered across reloads
 * ```svelte
 * <script>
 *   import { SidebarLayout, Button, MenuIcon, createPersistentState } from '@urbicon-ui/blocks';
 *
 *   const railOpen = createPersistentState({ key: 'sidebar', defaultValue: true });
 * </script>
 *
 * <SidebarLayout bind:open={railOpen.value} mode="collapsible" sidebarWidth="16rem">
 *   {#snippet sidebarHeader()}<span class="font-semibold">App</span>{/snippet}
 *   {#snippet sidebar()}<nav class="p-3"><!-- … --></nav>{/snippet}
 *
 *   {#snippet toggle(rail)}
 *     <Button
 *       variant="ghost"
 *       size="sm"
 *       {...rail.triggerProps}
 *       onclick={rail.toggle}
 *       aria-label={rail.open ? 'Collapse sidebar' : 'Expand sidebar'}
 *     >
 *       <MenuIcon />
 *     </Button>
 *   {/snippet}
 *
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
   * @summary Whether the sidebar is permanent on desktop, or toggleable at every width.
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
   * @summary How wide the sidebar panel is; the content offset follows it automatically.
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
   * If omitted, no mobile header is rendered — unless `toggle` is given, which
   * needs the header bar as its mobile seam.
   */
  mobileHeader?: Snippet<[MobileHeaderContext]>;

  /**
   * The control that opens and closes the sidebar, rendered by the layout at
   * the seams it owns: the rail edge on desktop (`mode="collapsible"` only —
   * a `responsive` sidebar is permanent there and `open` would toggle nothing)
   * and the header bar on mobile. One snippet, both places, each render with
   * its own `triggerId`.
   *
   * The desktop grip floats over the content column, so while it renders the
   * layout reserves a `--sidebar-toggle-gutter` strip (`3rem`, room for an icon
   * button) beside the sidebar. Set that custom property on the layout root to
   * make room for a wider control.
   *
   * Persistence is deliberately not a prop: `createPersistentState` plus
   * `bind:open` is the two-line version and keeps one storage story in the app.
   * @summary The open/close control for the sidebar, placed by the layout at the rail and header.
   */
  toggle?: Snippet<[SidebarToggleContext]>;

  /** Page content rendered inside the centered main column. */
  children?: Snippet;

  /** Additional CSS classes applied to the root wrapper. */
  class?: string;

  /** Strip all default styles. Combine with `slotClasses` for a custom layout. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides. A `sidebar`-prefixed key is forwarded to the
   * embedded `<Sidebar>`'s slot of that name — `sidebarPanel` reaches its
   * `panel`, `sidebarBackdrop` its `backdrop`, and so on.
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
