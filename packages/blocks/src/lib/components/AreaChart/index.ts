import type { HTMLAttributes } from 'svelte/elements';
import type {
  AreaChartSlotClasses,
  CartesianDatum,
  ChartMargin,
  ChartSeries
} from '$lib/internal/charts/types';

/**
 * @summary A trend chart with the area under each line filled, for volume that adds up.
 * @description Area chart for trends with volume emphasis — filled regions
 * under each series, optionally stacked. Zero-dependency SVG on the design-
 * token palette, responsive, dark-mode aware, with a screen-reader data-table
 * fallback.
 *
 * @tag display
 * @tag data
 * @related LineChart
 * @related BarChart
 * @stability beta
 *
 * @example
 * ```svelte
 * <AreaChart
 *   stacked
 *   data={[
 *     { label: 'Jan', values: [4, 6] },
 *     { label: 'Feb', values: [7, 3] }
 *   ]}
 *   series={[{ label: 'New' }, { label: 'Returning' }]}
 * />
 * ```
 */
export interface AreaChartProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Ordered categories with per-series values. */
  data: CartesianDatum[];
  /** Series metadata (labels + colors); defaults to one per value column. */
  series?: ChartSeries[];
  /** Stack series cumulatively instead of overlaying them. @default false */
  stacked?: boolean;
  /** Opacity of the area fill (0–1). @default 0.2 (overlay) / 0.85 (stacked) */
  fillOpacity?: number;
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
  /**
   * Per-slot class overrides. A series is drawn as two paths and `mark` lands
   * on both of them, so a utility that sets a paint there reaches both: `fill-*`
   * fills the top edge's open polyline, `stroke-*` outlines the band. Use `area`
   * for the filled band alone and `areaOutline` for its top edge alone; each is
   * folded against `mark` rather than appended to it, so an entry there wins its
   * Tailwind bucket outright instead of by stylesheet order.
   */
  slotClasses?: AreaChartSlotClasses;
  /** Apply a named preset registered on `<BlocksProvider>`. */
  preset?: string;
}

export { default as AreaChart } from './AreaChart.svelte';
