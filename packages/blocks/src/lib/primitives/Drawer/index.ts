import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { DrawerSlots, DrawerVariants } from './drawer.variants';

/**
 * @summary A panel that slides in from an edge and takes focus with it.
 * @description Slide-in panel overlay from any edge of the viewport.
 * Uses native dialog with focus trap, backdrop click dismiss, and Escape key support.
 *
 * @tag overlay
 * @related Dialog
 * @related Sidebar
 *
 * @example
 * ```svelte
 * <Drawer bind:open title="Settings" placement="right">
 *   <p>Drawer content here</p>
 * </Drawer>
 * ```
 *
 * @example
 * ```svelte
 * <Drawer bind:open title="Menu" placement="left" size="sm">
 *   <nav>...</nav>
 * </Drawer>
 * ```
 */
export interface DrawerProps extends Omit<HTMLDialogAttributes, 'children' | 'open'> {
  /** Controls whether the drawer is visible. Supports `bind:open`. */
  open?: boolean;

  /** Content rendered inside the drawer body. */
  children: Snippet;

  /** Action buttons rendered in the drawer footer. */
  footer?: Snippet;

  /** Heading displayed in the drawer header. */
  title?: string;

  /** Edge of the viewport from which the drawer slides in. @default 'right' */
  placement?: DrawerVariants['placement'];

  /** Width (for left/right) or height (for top/bottom) of the drawer panel. @default 'md' */
  size?: DrawerVariants['size'];

  /**
   * Semantic purpose marker (mirrors Dialog). By default the Drawer paints no
   * accent border — the value is exposed on the panel as `data-intent="…"` so
   * consumers can hook presets, CSS overrides, or icon/title color via their own
   * snippets. Set {@link accentEdge} to also tint the docked edge in this colour.
   * @default 'neutral'
   * @summary Which colour the accent edge takes; on its own it paints nothing.
   */
  intent?: DrawerVariants['intent'];

  /**
   * Tint the panel's docked (viewport-facing) edge with a 2px accent border in
   * the {@link intent} colour — `border-right` for `left`, `border-left` for
   * `right`, `border-bottom` for `top`, `border-top` for `bottom`. Off by
   * default, keeping symmetry with Dialog; opt in for a coloured seam that ties
   * the drawer to a semantic purpose (e.g. a `danger` confirm drawer).
   * @default false
   * @summary Tints the edge that faces the viewport in the intent colour.
   */
  accentEdge?: DrawerVariants['accentEdge'];

  /** Fires when the drawer is dismissed via Escape, backdrop click, or close button. */
  onClose?: () => void;

  /** Hides the built-in close button in the header. @default false */
  hideCloseButton?: boolean;

  /** Whether clicking the backdrop closes the drawer. @default true */
  closeOnBackdropClick?: boolean;

  /**
   * Whether pressing Escape closes the drawer.
   *
   * Escape is dismissed one layer at a time: a control INSIDE the drawer that
   * handles Escape itself — an open `Select`/`Combobox`/`Menu` panel, a
   * `clearable` `Input` with text in it — consumes the key, and the drawer stays
   * up. The second Escape closes the drawer. This is about controls in the
   * content; it does not apply to a consumer `onkeydown` on the Drawer itself,
   * which cannot veto the dismiss (see utils/compose-handlers.ts) — use this
   * prop for that.
   * @default true
   * @summary Whether the Escape key dismisses the drawer.
   */
  closeOnEscape?: boolean;

  /**
   * Override the enter/exit animation duration in milliseconds.
   * Defaults to the overlay token `--blocks-overlay-enter-duration` /
   * `--blocks-overlay-exit-duration` (200ms / 180ms). Respects
   * `prefers-reduced-motion`.
   */
  transitionDuration?: number;

  /** Override the enter/exit easing function. Defaults to the overlay token easing (`quintOut`). */
  transitionEasing?: (t: number) => number;

  /** Additional CSS classes applied to the drawer panel. */
  class?: string;

  /** Strip all default styles. Combine with slotClasses for fully custom appearance. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with variant styles. */
  slotClasses?: Partial<Record<DrawerSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Drawer: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Drawer } from './Drawer.svelte';
export { type DrawerVariants, drawerVariants } from './drawer.variants';
