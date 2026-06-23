import type { ThemeSwitcherSlots, ThemeSwitcherVariants } from './themeSwitcher.variants';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Props for the ThemeSwitcher component.
 *
 * @description Cycles between light, dark, and system color schemes. Sets a
 * `light`/`dark` class on the `<html>` element for explicit choices and clears
 * it in system mode (so the CSS `light-dark()` function follows the OS natively).
 * Persists the choice to localStorage.
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
   */
  strategy?: 'cycle' | 'toggle';

  /** `localStorage` key for persistence. Set to `false` to disable. @default 'urbicon-theme' */
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
