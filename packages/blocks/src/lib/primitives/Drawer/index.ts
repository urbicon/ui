import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { DrawerSlots, DrawerVariants } from './drawer.variants';

/**
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
   * Semantic purpose marker (mirrors Dialog). After the Lighter-Refactor,
   * the Drawer itself no longer paints an accent border — the value is
   * exposed on the panel as `data-intent="…"` so consumers can hook
   * presets, CSS overrides, or icon/title color via their own snippets.
   * @default 'neutral'
   */
  intent?: DrawerVariants['intent'];

  /** Fires when the drawer is dismissed via Escape, backdrop click, or close button. */
  onClose?: () => void;

  /** Hides the built-in close button in the header. @default false */
  hideCloseButton?: boolean;

  /** Whether clicking the backdrop closes the drawer. @default true */
  closeOnBackdropClick?: boolean;

  /** Whether pressing Escape closes the drawer. @default true */
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
