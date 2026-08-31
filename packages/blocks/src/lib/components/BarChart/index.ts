import type { HTMLAttributes } from 'svelte/elements';
import type {
  BarChartSlotClasses,
  CartesianDatum,
  ChartMargin,
  ChartSeries
} from '$lib/internal/charts/types';

/** One category (x-axis tick) with one value per series. @see CartesianDatum */
export type BarChartDatum = CartesianDatum;

/**
 * @summary Bars for comparing categories — single, grouped or stacked.
 * @description Categorical bar chart — single, grouped, or stacked. Zero-
 * dependency SVG rendering on the design-token chart palette, responsive via
 * ResizeObserver, dark-mode aware, with a screen-reader data-table fallback.
 *
 * @tag display
 * @tag data
 * @related Sankey
 * @related CompositionBar
 * @stability beta
 *
 * @example
 * ```svelte
 * <BarChart
 *   data={[
 *     { label: 'Q1', values: [12, 8] },
 *     { label: 'Q2', values: [19, 11] }
 *   ]}
 *   series={[{ label: 'Revenue' }, { label: 'Cost' }]}
 *   formatValue={(v) => `${v}k`}
 * />
 * ```
 */
export interface BarChartProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Categories with per-series values. */
  data: BarChartDatum[];
  /**
   * Series metadata (labels + colors). Defaults to one generic series per
   * value column found in `data`.
   */
  series?: ChartSeries[];
  /** Stack series instead of grouping them side by side. @default false */
  stacked?: boolean;
  /** SVG height in px. @default 240 */
  height?: number;
  /** Fixed width in px; omit for responsive width. */
  width?: number;
  /** Plot margins; merged over the defaults. */
  margin?: ChartMargin;
  /** Format values for axis labels, tooltips, and the data table. */
  formatValue?: (value: number) => string;
  /** BCP-47 locale for the default number formatter (when no `formatValue`). */
  locale?: string;
  /** Show the series legend (only renders with >1 series). @default true */
  showLegend?: boolean;
  /** Render horizontal gridlines. @default true */
  showGrid?: boolean;
  /** Accessible label; a summary is generated when omitted. */
  ariaLabel?: string;
  /** Extra classes merged onto the wrapper. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: BarChartSlotClasses;
  /** Apply a named preset registered on `<BlocksProvider>`. */
  preset?: string;
}

export { default as BarChart } from './BarChart.svelte';
