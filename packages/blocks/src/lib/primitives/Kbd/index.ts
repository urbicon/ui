import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { KbdSlots, KbdVariants } from './kbd.variants';

/**
 * @summary A keyboard shortcut, drawn as the key you press.
 * @description Keyboard-key hint. Renders one or more keys as a compact, physical-looking
 * keycap — the canonical way to show shortcuts (⌘K, Ctrl + S) in menus, tooltips, command
 * palettes and docs. Pure display; emits a semantic `<kbd>` element.
 *
 * @tag display
 * @related CommandPalette
 * @related Tooltip
 * @stability beta
 *
 * @example
 * ```svelte
 * <Kbd keys="⌘K" />
 * ```
 *
 * @example
 * ```svelte
 * <Kbd keys={['Ctrl', 'K']} />
 * ```
 */
export interface KbdProps
  extends KbdVariants,
    Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> {
  /**
   * The key(s) to display. A single string renders one label; an array renders each
   * entry joined by `separator` (e.g. `['Ctrl', 'K']` → `Ctrl + K`). Ignored when
   * `children` is provided.
   * @summary The key or keys to show; an array is joined by the separator.
   */
  keys?: string | string[];
  /** Separator rendered between multiple `keys`. @default '+' */
  separator?: string;
  /** Keycap size — sm, md (default), lg. */
  size?: 'sm' | 'md' | 'lg';
  /** Custom content; overrides `keys`. */
  children?: Snippet;
  /** Additional CSS class merged onto the root `<kbd>`. */
  class?: string;
  /** Strip all default styles; combine with slotClasses to rebuild from scratch. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | separator */
  slotClasses?: Partial<Record<KbdSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Kbd: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic palette — presets keep dark-mode logic coherent and reusable.
   */
  preset?: string;
}

export { default as Kbd } from './Kbd.svelte';
export { type KbdVariants, kbdVariants } from './kbd.variants';
