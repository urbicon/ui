import type { HTMLAttributes } from 'svelte/elements';
import type {
  CartesianDatum,
  ChartMargin,
  ChartSeries,
  LineChartSlotClasses
} from '$lib/internal/charts/types';

/**
 * @summary Lines over an ordered axis, for how something developed.
 * @description Line chart for trends over an ordered category axis. One path
 * per series on the design-token palette; zero-dependency SVG, responsive,
 * dark-mode aware, with optional points, gridlines, legend, and a screen-
 * reader data-table fallback.
 *
 * @tag display
 * @tag data
 * @related AreaChart
 * @related BarChart
 * @related Sparkline
 * @stability beta
 *
 * @example
 * ```svelte
 * <LineChart
 *   data={[
 *     { label: 'Mon', values: [12] },
 *     { label: 'Tue', values: [18] },
 *     { label: 'Wed', values: [9] }
 *   ]}
 * />
 * ```
 */
export interface LineChartProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Ordered categories with per-series values. */
  data: CartesianDatum[];
  /** Series metadata (labels + colors); defaults to one per value column. */
  series?: ChartSeries[];
  /** SVG height in px. @default 240 */
  height?: number;
  /** Fixed width in px; omit for responsive width. */
  width?: number;
  /** Plot margins; merged over the defaults. */
  margin?: ChartMargin;
  /** Format values for axis labels, tooltips, and the data table. */
  formatValue?: (value: number) => string;
  /** BCP-47 locale for the default number formatter. */
  locale?: string;
  /** Render a dot at each data point; style them via `slotClasses.point`. @default true */
  showPoints?: boolean;
  /** Show the series legend (only renders with >1 series). @default true */
  showLegend?: boolean;
  /** Render horizontal gridlines. @default true */
  showGrid?: boolean;
  /** Start the value axis at zero instead of framing the data range. @default false */
  includeZero?: boolean;
  /** Accessible label; a summary is generated when omitted. */
  ariaLabel?: string;
  /** Extra classes merged onto the wrapper. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. `mark` is the line path, `point` the dots on it. */
  slotClasses?: LineChartSlotClasses;
  /** Apply a named preset registered on `<BlocksProvider>`. */
  preset?: string;
}

export { default as LineChart } from './LineChart.svelte';
