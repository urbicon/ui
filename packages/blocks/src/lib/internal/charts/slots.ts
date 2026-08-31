import type { ChartSlot } from './variants';

/* ── Which chart paints which slot ──────────────────────────────────────────
 *
 * Its own module, not part of `variants.ts`: every chart imports that one at
 * runtime for `chartSlotResolver`, and the lists below are read only by the
 * type projection and by `slot-reach.svelte.test.ts`. Kept beside the resolver
 * they survived tree-shaking — `bun run size` measured +0.3 % gz on the four
 * charts and +0.6 % on ChartFrame; from here nothing a consumer bundles
 * imports them at all.
 *
 * One config feeds five components, so `ChartSlot` answers "what does this
 * family paint", never "what does *this* component paint" — that is a property
 * of a component's markup and no type operator over the config can reach it.
 * It is therefore written down, once, below, and each chart's `slotClasses`
 * type is projected from its own list.
 *
 * `slot-reach.svelte.test.ts` mounts all five and asserts every list against
 * the rendered markup in both directions, so a list that claims too much or
 * too little is an error rather than prose.
 */

/** The `<figure>` + `<svg>` every chart gets from `<ChartFrame>`. */
const FRAME_SLOTS = ['root', 'svg'] as const;

/** The axis groups, tick labels and gridlines of a cartesian plot. */
const AXIS_SLOTS = ['axis', 'axisLabel', 'grid'] as const;

/** The series legend rendered as HTML below the plot. */
const LEGEND_SLOTS = ['legend', 'legendItem', 'legendSwatch'] as const;

export const CHART_FRAME_SLOTS = FRAME_SLOTS satisfies readonly ChartSlot[];

export const BAR_CHART_SLOTS = [
  ...FRAME_SLOTS,
  ...AXIS_SLOTS,
  'axisLine',
  'bar',
  ...LEGEND_SLOTS
] as const satisfies readonly ChartSlot[];

export const LINE_CHART_SLOTS = [
  ...FRAME_SLOTS,
  ...AXIS_SLOTS,
  'mark',
  ...LEGEND_SLOTS
] as const satisfies readonly ChartSlot[];

export const AREA_CHART_SLOTS = [
  ...FRAME_SLOTS,
  ...AXIS_SLOTS,
  'mark',
  ...LEGEND_SLOTS
] as const satisfies readonly ChartSlot[];

export const DONUT_CHART_SLOTS = [
  ...FRAME_SLOTS,
  'arc',
  'centerLabel',
  'centerSubLabel',
  ...LEGEND_SLOTS
] as const satisfies readonly ChartSlot[];

/** Slots `<ChartFrame>` paints — the wrapper and the SVG it measures. */
export type ChartFrameSlot = (typeof CHART_FRAME_SLOTS)[number];
/** Slots `<BarChart>` paints. */
export type BarChartSlot = (typeof BAR_CHART_SLOTS)[number];
/** Slots `<LineChart>` paints. */
export type LineChartSlot = (typeof LINE_CHART_SLOTS)[number];
/** Slots `<AreaChart>` paints. */
export type AreaChartSlot = (typeof AREA_CHART_SLOTS)[number];
/** Slots `<DonutChart>` paints. */
export type DonutChartSlot = (typeof DONUT_CHART_SLOTS)[number];
