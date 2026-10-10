import type { HTMLAttributes } from 'svelte/elements';
import type { DonutChartSlotClasses } from '#lib/internal/charts/types.js';

/** A single slice of a donut / pie chart. */
export interface DonutDatum {
  /** Slice label (legend + data table). */
  label: string;
  /**
   * Numeric value; the slice angle is its share of the total. A value at or
   * below zero draws no slice, adds nothing to the total and reads as 0 in the
   * data table.
   */
  value: number;
  /** Explicit color; defaults to the cycled categorical palette. */
  color?: string;
}

/**
 * @summary Parts of a whole as a ring, with the total in the middle.
 * @description Donut (or pie) chart for part-to-whole composition. Zero-
 * dependency SVG arcs on the design-token palette, dark-mode aware, with an
 * optional center total, legend, and a screen-reader data-table fallback. Set
 * `innerRadiusRatio={0}` for a full pie. Pairs with CompositionBar for the
 * linear equivalent.
 *
 * @tag display
 * @tag data
 * @related CompositionBar
 * @related BarChart
 * @stability beta
 *
 * @example
 * ```svelte
 * <DonutChart
 *   data={[
 *     { label: 'Direct', value: 45 },
 *     { label: 'Referral', value: 30 },
 *     { label: 'Organic', value: 25 }
 *   ]}
 *   showTotal
 * />
 * ```
 */
export interface DonutChartProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Slices; angle is each value's share of the total. */
  data: DonutDatum[];
  /** Square SVG size in px. @default 220 */
  size?: number;
  /** Inner-hole radius as a fraction of the outer radius (0 = pie). @default 0.6 */
  innerRadiusRatio?: number;
  /** Gap between slices in degrees. @default 0 */
  padAngle?: number;
  /** Format values for the center total, tooltips, and the data table. */
  formatValue?: (value: number) => string;
  /** BCP-47 locale for the default number formatter. */
  locale?: string;
  /** Show the summed total in the center hole. @default false */
  showTotal?: boolean;
  /** Caption under the center total (e.g. "Total"). */
  totalLabel?: string;
  /** Show the legend. @default true */
  showLegend?: boolean;
  /**
   * Accessible label for the chart image, which also captions the data table.
   * A plain `aria-label` does the same, and this prop wins over it; with
   * neither, a summary in the active locale is generated. `aria-labelledby`
   * outranks both for the image's name, and this prop then only captions the
   * table.
   */
  ariaLabel?: string;
  /** Extra classes merged onto the wrapper. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: DonutChartSlotClasses;
  /** Apply a named preset registered on `<BlocksProvider>`. */
  preset?: string;
}

export { default as DonutChart } from './DonutChart.svelte';
