import { tv, type VariantProps } from '$lib/utils/variants';

/**
 * Shared tv() slots for the charts/ family. SVG presentation (fill/stroke) is
 * driven by Tailwind utilities generated from the design tokens — exactly like
 * Sankey — so dark mode and theming flow automatically.
 */
export const chartVariants = tv({
  slots: {
    /** Outer <figure> wrapper. */
    root: ['m-0'],
    /** The <svg> element. */
    svg: ['block w-full overflow-visible'],
    /** Axis group (<g>) — sets the inherited text color for labels. */
    axis: ['text-text-tertiary'],
    /**
     * The zero baseline the bars stand on, drawn at `yScale(0)`. BarChart
     * paints it; LineChart, AreaChart, DonutChart and ChartFrame do not, and it
     * is not in their `slotClasses` types. A chart that starts drawing it has
     * to put 0 inside its own domain first — `yScale(0)` otherwise lands
     * outside the plot box: below it for an all-positive domain, above it for
     * an all-negative one.
     */
    axisLine: ['stroke-border-default'],
    /** Tick + category labels. */
    axisLabel: ['fill-text-tertiary text-3xs tabular-nums'],
    /** Background gridlines. */
    grid: ['stroke-border-hairline'],
    /**
     * The stroked series path: LineChart's line, AreaChart's top edge — and in
     * AreaChart the filled band as well, which is why `area` and `areaOutline`
     * exist to reach one path each. A *paint* utility written here lands on
     * both AreaChart paths, where each defeats the other's `fill="none"` /
     * `stroke="none"` presentation attribute: measured in Chromium, a `fill:`
     * declaration fills the open outline polyline and a `stroke:` declaration
     * draws a contour around the band. Stroke *geometry* — width, dash, cap,
     * join — paints nothing on the band and is safe to write here.
     */
    mark: ['transition-[opacity] duration-[var(--blocks-duration-fast)]'],
    /** Point marker on a line series; fades with the other data marks. */
    point: ['transition-[opacity] duration-[var(--blocks-duration-fast)]'],
    /**
     * AreaChart's filled band on its own. Empty, and so is `areaOutline`:
     * everything that distinguishes the two paths arrives as a presentation
     * attribute — `fill`, `fill-opacity` and `stroke` computed from the data,
     * `stroke-width`, `stroke-linejoin` and `stroke-linecap` written literally
     * — and the one class-level look either wants, the opacity transition, is
     * `mark`'s and already on both. They exist to *separate*
     * what `mark` says, not to add to it. Both are folded against `mark` with
     * `resolveClassChain` at the call site, so a default added here later
     * resolves against `mark`'s per bucket rather than racing it in the
     * stylesheet.
     */
    area: [],
    /** AreaChart's top edge on its own; empty for the reason `area` gives. */
    areaOutline: [],
    /** Bar rectangle. */
    bar: ['transition-[opacity] duration-[var(--blocks-duration-fast)]'],
    /** Donut / pie segment. */
    arc: ['transition-[opacity] duration-[var(--blocks-duration-fast)]'],
    /** Donut center primary label. */
    centerLabel: ['fill-text-primary text-sm font-medium tabular-nums'],
    /** Donut center secondary label. */
    centerSubLabel: ['fill-text-tertiary text-3xs'],
    /** Legend container (HTML). */
    legend: ['mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5', 'text-text-secondary text-xs'],
    /** One legend entry. */
    legendItem: ['inline-flex items-center gap-1.5'],
    /** Legend color swatch. */
    legendSwatch: ['inline-block size-2.5 rounded-[2px]']
  },
  variants: {
    /**
     * Shape of the outer box. A cartesian chart fills the column it sits in
     * and positions overlays against it; a donut is a square figure with the
     * legend stacked underneath, so it shrink-wraps instead.
     */
    layout: {
      cartesian: { root: 'relative w-full' },
      donut: { root: 'inline-flex flex-col items-center gap-3' }
    }
  },
  defaultVariants: {
    layout: 'cartesian'
  }
});

export type ChartVariants = VariantProps<typeof chartVariants>;

/** Union of chart slot names (kept in sync with `chartVariants`). */
export type ChartSlot = keyof ReturnType<typeof chartVariants>;

/**
 * Build a slot-class resolver honoring `unstyled` + per-slot overrides,
 * mirroring the EmptyState `slot()` pattern. When `unstyled`, default tv
 * classes are dropped and only the per-slot overrides (and `extra`) remain.
 */
export function chartSlotResolver(
  unstyled: boolean,
  overrides: Partial<Record<ChartSlot, string>> = {},
  variants: ChartVariants = {}
): (slot: ChartSlot, extra?: string) => string {
  const styles = unstyled ? undefined : chartVariants(variants);
  return (slot, extra) =>
    styles?.[slot]?.({ class: [overrides[slot], extra] }) ??
    [overrides[slot], extra].filter(Boolean).join(' ');
}
