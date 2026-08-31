import type {
  AreaChartSlot,
  BarChartSlot,
  ChartFrameSlot,
  DonutChartSlot,
  LineChartSlot
} from './slots';

/** Per-slot class overrides for `<ChartFrame>`. */
export type ChartFrameSlotClasses = Partial<Record<ChartFrameSlot, string>>;

/** Per-slot class overrides for `<BarChart>`. */
export type BarChartSlotClasses = Partial<Record<BarChartSlot, string>>;

/** Per-slot class overrides for `<LineChart>`. */
export type LineChartSlotClasses = Partial<Record<LineChartSlot, string>>;

/** Per-slot class overrides for `<AreaChart>`. */
export type AreaChartSlotClasses = Partial<Record<AreaChartSlot, string>>;

/** Per-slot class overrides for `<DonutChart>`. */
export type DonutChartSlotClasses = Partial<Record<DonutChartSlot, string>>;

/** Plot margins (px). Any omitted side falls back to the frame default. */
export interface ChartMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Plot geometry passed to a ChartFrame children snippet. The snippet renders
 * inside a `<g>` translated to the plot's top-left corner, so marks use local
 * coordinates in `[0, innerWidth] × [0, innerHeight]`.
 */
export interface ChartPlot {
  /** Full SVG width (px). */
  width: number;
  /** Full SVG height (px). */
  height: number;
  /** Drawable width inside the margins (px). */
  innerWidth: number;
  /** Drawable height inside the margins (px). */
  innerHeight: number;
  /** Resolved margins (all sides present). */
  margin: Required<ChartMargin>;
}

/** A data series shared across the cartesian charts. */
export interface ChartSeries {
  /** Legend + tooltip label. */
  label: string;
  /** Explicit color; defaults to the cycled categorical palette. */
  color?: string;
}

/** One category (x-axis tick) with one value per series — shared by the cartesian charts. */
export interface CartesianDatum {
  /** Category label rendered on the x-axis. */
  label: string;
  /** Values in series order; missing entries are treated as 0. */
  values: number[];
}
