import type { HTMLAttributes } from 'svelte/elements';
import type { ProgressSlots, ProgressVariants } from './progress.variants';

/**
 * @summary How far along something is — or that it is running at all.
 * @description Progress indicator for determinate and indeterminate loading states.
 * Supports linear bar and circular ring variants with semantic intents and animation.
 *
 * @tag feedback
 * @related Spinner
 * @related Skeleton
 *
 * @example
 * ```svelte
 * <Progress value={65} label="Upload progress" showValue />
 * ```
 *
 * @example
 * ```svelte
 * <Progress value={80} shape="circular" intent="success" showValue />
 * ```
 */
export interface ProgressProps
  extends ProgressVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** Current progress on the `min`–`max` scale, clamped into it. Omit for indeterminate mode. */
  value?: number;

  /** Minimum value for the progress range. @default 0 */
  min?: number;

  /** Maximum value for the progress range. @default 100 */
  max?: number;

  /**
   * Accessible name of the progressbar (`aria-label`, falling back to the localized
   * "Progress"). The linear shape also shows it above the track; the circular shape shows
   * no text label at all.
   */
  label?: string;

  /**
   * Show the formatted value (see `formatValue`) in the row above the linear track, or centred
   * inside the circular ring. Hidden while indeterminate.
   * @default false
   * @summary Shows the formatted value above the bar, or inside the ring.
   */
  showValue?: boolean;

  /**
   * Format function for the displayed value. Receives the clamped value and `max`, not `min`
   * — a formatter for a range that does not start at 0 has to know `min` itself. Without
   * one, the value shows as the rounded percentage of the `min`–`max` range the fill draws,
   * 0% for an empty range.
   */
  formatValue?: (value: number, max: number) => string;

  /** Shape of the progress indicator. @default 'linear' */
  shape?: 'linear' | 'circular';

  /**
   * Diameter of the circular indicator in pixels. Unset, the ring follows `size`: 48, 64,
   * 80 or 112 px for `xs` to `lg`.
   */
  circularSize?: number;

  /**
   * Stroke width of the circular indicator in pixels. Unset, the stroke follows `size`:
   * 3, 4, 6 or 8 px for `xs` to `lg`.
   */
  strokeWidth?: number;

  /** Display striped pattern on the fill. @default false */
  striped?: boolean;

  /** Animate the striped pattern. Requires `striped` to be true. @default false */
  animated?: boolean;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (linear
   * root — what `class` targets in linear shape) | header | label | valueText |
   * track | fill | circularWrapper (circular root — what `class` targets in
   * circular shape) | circularTrack | circularFill | circularLabel.
   */
  slotClasses?: Partial<Record<ProgressSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Progress: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Progress } from './Progress.svelte';
export { type ProgressVariants, progressVariants } from './progress.variants';
