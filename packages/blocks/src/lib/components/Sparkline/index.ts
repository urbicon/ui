import type { HTMLAttributes } from 'svelte/elements';

/** Per-slot class overrides for {@link SparklineProps}. */
export type SparklineSlotClasses = Partial<
  Record<'root' | 'svg' | 'line' | 'area' | 'point', string>
>;

/**
 * @description Tiny inline trend line — no axes, no labels — sized to flow in
 * table cells, cards, or running text. Zero-dependency SVG, optional area fill
 * and end-point dot. Fixed `width`/`height` by default, or set `fluid` to fill
 * the container width. Aria-hidden by default with an optional `ariaLabel`.
 *
 * @tag display
 * @tag data
 * @related LineChart
 * @stability beta
 *
 * @example
 * ```svelte
 * <Sparkline data={[3, 5, 4, 8, 6, 9]} area />
 * ```
 */
export interface SparklineProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Sequence of values plotted left → right. */
  data: number[];
  /** Width in px. @default 96 */
  width?: number;
  /** Height in px. @default 24 */
  height?: number;
  /**
   * Fill the container width instead of a fixed pixel size. Drops the svg's
   * `width`/`height` attributes (they still set the `viewBox` aspect ratio) so
   * it scales to its container; strokes stay crisp via
   * `vector-effect="non-scaling-stroke"`. @default false
   */
  fluid?: boolean;
  /** Fill the area under the line. @default false */
  area?: boolean;
  /** Mark the last point with a dot. @default false */
  showEndPoint?: boolean;
  /** Line + fill color. @default var(--color-chart-1) */
  color?: string;
  /** Stroke width in px. @default 1.5 */
  strokeWidth?: number;
  /** Accessible label; when omitted the sparkline is aria-hidden. */
  ariaLabel?: string;
  /** Extra classes merged onto the wrapper. */
  class?: string;
  /** Remove all default classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: SparklineSlotClasses;
}

export { default as Sparkline } from './Sparkline.svelte';
