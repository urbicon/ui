import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { Placement } from '$lib/utils/floating';
import type { TooltipSlots, TooltipVariants } from './tooltip.variants';

/**
 * @description Contextual overlay that displays brief, supplementary text on hover or focus.
 * Built with Floating UI for precise positioning and accessibility support.
 *
 * @tag display
 * @related Popover
 *
 * @example
 * ```svelte
 * <Tooltip label="Save your changes">
 *   <Button>Save</Button>
 * </Tooltip>
 * ```
 *
 * @example
 * ```svelte
 * <Tooltip label="Copy to clipboard" placement="right" arrow showDelay={100}>
 *   <Button variant="ghost" size="sm" onclick={handleCopy}>Copy</Button>
 * </Tooltip>
 * ```
 */
export interface TooltipProps
  extends TooltipVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Text displayed inside the tooltip bubble. */
  label: string;

  /** The trigger element(s) that activate the tooltip. */
  children: Snippet;

  /** Where the tooltip appears relative to the trigger. Auto-flips when clipped. @default 'top' */
  placement?: Placement;

  /** Milliseconds before the tooltip appears after hover/focus. Prevents accidental activation. @default 200 */
  showDelay?: number;

  /** Milliseconds before the tooltip disappears after leaving the trigger. @default 100 */
  hideDelay?: number;

  /**
   * Override the fade duration in milliseconds. Distinct from `showDelay` /
   * `hideDelay`, which time *when* the tooltip appears — this is how fast the
   * opacity fade itself runs. Defaults to the tooltip token
   * `--blocks-tooltip-duration` (fast, 150ms). Respects `prefers-reduced-motion`.
   */
  transitionDuration?: number;

  /**
   * Override the fade easing as a CSS `<easing-function>` (e.g. `'linear'`,
   * `'ease-out'`, `'cubic-bezier(0.4,0,0.2,1)'`). Defaults to the tooltip token
   * `--blocks-tooltip-easing`. A CSS string, not a JS easing fn, because the
   * tooltip fade is a pure CSS transition.
   */
  transitionEasing?: string;

  /** Whether to show a directional arrow pointing at the trigger. @default true */
  arrow?: boolean;

  /** Prevent the tooltip from appearing regardless of hover/focus. @default false */
  disabled?: boolean;

  /** Fires when tooltip visibility changes (hover in/out, Escape key). */
  onVisibleChange?: (visible: boolean) => void;

  /** Remove default tv classes; only consumer classes apply. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing, when unstyled) tv styles. */
  slotClasses?: Partial<Record<TooltipSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Tooltip: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Additional CSS class for the tooltip panel. */
  class?: string;
}

export type { Placement as TooltipPlacement } from '$lib/utils/floating';
export { default as Tooltip } from './Tooltip.svelte';
export { type TooltipVariants, tooltipVariants } from './tooltip.variants';
