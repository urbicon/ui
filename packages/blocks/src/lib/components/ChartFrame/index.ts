import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChartFrameSlotClasses, ChartMargin, ChartPlot } from '$lib/internal/charts/types';

/**
 * @summary The measured, responsive canvas the other charts draw on — bring your own shapes.
 * @description Responsive SVG chart shell: measures its width via
 * ResizeObserver, applies plot margins, and hands the drawable plot geometry
 * to a child snippet. The building block under every cartesian chart in the
 * family — use it directly only for fully custom marks.
 *
 * @tag layout
 * @tag display
 * @related BarChart
 * @related Sankey
 * @stability beta
 *
 * @example
 * ```svelte
 * <ChartFrame height={200} ariaLabel="Weekly revenue">
 *   {#snippet children({ innerWidth, innerHeight })}
 *     <!-- map your data onto innerWidth / innerHeight, then draw SVG marks -->
 *     <polyline points={pts} fill="none" class="stroke-primary" stroke-width="2" />
 *   {/snippet}
 * </ChartFrame>
 * ```
 */
export interface ChartFrameProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Fixed SVG height in px. @default 240 */
  height?: number;
  /**
   * Fixed width in px. Omit for responsive width measured from the container
   * (the common case); set it only for SSR-stable, non-responsive output.
   */
  width?: number;
  /** Plot margins; merged over the frame defaults. */
  margin?: ChartMargin;
  /** Accessible label for the chart image (role="img"). */
  ariaLabel?: string;
  /** Renders the SVG plot content; receives the {@link ChartPlot} geometry. */
  children?: Snippet<[ChartPlot]>;
  /** Optional legend rendered (as HTML) below the SVG. */
  legend?: Snippet;
  /** Screen-reader fallback (e.g. a data table) rendered visually hidden. */
  fallback?: Snippet;
  /** Extra classes merged onto the <figure> wrapper. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: ChartFrameSlotClasses;
  /** Apply a named preset registered on `<BlocksProvider>`. */
  preset?: string;
}

export { default as ChartFrame } from './ChartFrame.svelte';
