import type { ThemeSwitcherSlots, ThemeSwitcherVariants } from './themeSwitcher.variants';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Props for the ThemeSwitcher component.
 *
 * @summary Light, dark, or whatever the system says.
 * @description Cycles between light, dark, and system color schemes. Sets a
 * `light`/`dark` class on the `<html>` element for explicit choices and clears
 * it in system mode (so the CSS `light-dark()` function follows the OS natively).
 * Persists the choice to `localStorage` where that is usable, and never throws
 * where it is not: with storage switched off (a hardened browser profile, an
 * embedded webview) or a quota refusing the write, the button still switches the
 * theme and the choice simply does not survive a reload. So treat persistence as
 * best-effort — do not build a flow that depends on the stored key existing.
 *
 * @tag action
 * @related LocaleSwitcher
 *
 * @example
 * ```svelte
 * <ThemeSwitcher />
 * ```
 *
 * @example
 * ```svelte
 * <ThemeSwitcher size="lg" variant="outlined" strategy="toggle" />
 * ```
 */
export interface ThemeSwitcherProps {
  // ── Behavior ──────────────────────────────────────────

  /** Current theme. Supports `bind:theme`. @default 'system' */
  theme?: Theme;

  /**
   * Interaction mode.
   * - `'cycle'` — single button cycling light → dark → system (default)
   * - `'toggle'` — single button toggling light ↔ dark (no system option)
   * @default 'cycle'
   * @summary Whether the button cycles through system too, or just toggles light and dark.
   */
  strategy?: 'cycle' | 'toggle';

  /**
   * `localStorage` key holding the choice, or `false` to switch persistence
   * off. A stored value is read once on mount; `'system'` is persisted as the
   * ABSENCE of the key, so the OS keeps winning after a reload. Where storage
   * is unusable nothing is written and nothing throws — the theme is back to
   * `'system'` on the next load.
   * @default 'urbicon-theme'
   * @summary Which localStorage key holds the choice, or false to not remember it.
   */
  storageKey?: string | false;

  /** Called after the theme changes. */
  onThemeChange?: (theme: Theme) => void;

  // ── Variants ──────────────────────────────────────────

  /** Visual style of the button. @default 'ghost' */
  variant?: ThemeSwitcherVariants['variant'];

  /** Button size. @default 'md' */
  size?: ThemeSwitcherVariants['size'];

  // ── Styling ───────────────────────────────────────────

  /** Additional CSS classes. */
  class?: string;

  /** Strip all default styles. @default false */
  unstyled?: boolean;

  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<ThemeSwitcherSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ThemeSwitcher: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Disable the switcher. */
  disabled?: boolean;
}

export { default as ThemeSwitcher } from './ThemeSwitcher.svelte';
export { type ThemeSwitcherVariants, themeSwitcherVariants } from './themeSwitcher.variants';
