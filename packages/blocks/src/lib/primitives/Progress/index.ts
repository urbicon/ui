import type { HTMLAttributes } from 'svelte/elements';
import type { ProgressVariants } from './progress.variants';

/**
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
  /** Current progress value (0–100). Omit for indeterminate mode. */
  value?: number;

  /** Minimum value for the progress range. @default 0 */
  min?: number;

  /** Maximum value for the progress range. @default 100 */
  max?: number;

  /** Text label displayed above or inside the progress indicator. */
  label?: string;

  /** Show the numeric value (percentage or absolute) next to the label. @default false */
  showValue?: boolean;

  /** Format function for the displayed value. @default (v, max) => `${Math.round((v/max) * 100)}%` */
  formatValue?: (value: number, max: number) => string;

  /** Shape of the progress indicator. @default 'linear' */
  shape?: 'linear' | 'circular';

  /** Diameter of the circular indicator in pixels. @default 80 */
  circularSize?: number;

  /** Stroke width of the circular indicator in pixels. @default 6 */
  strokeWidth?: number;

  /** Display striped pattern on the fill. @default false */
  striped?: boolean;

  /** Animate the striped pattern. Requires `striped` to be true. @default false */
  animated?: boolean;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with tv() styles. */
  slotClasses?: Partial<
    Record<
      | 'wrapper'
      | 'header'
      | 'label'
      | 'valueText'
      | 'track'
      | 'fill'
      | 'circularWrapper'
      | 'circularTrack'
      | 'circularFill'
      | 'circularLabel',
      string
    >
  >;
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
