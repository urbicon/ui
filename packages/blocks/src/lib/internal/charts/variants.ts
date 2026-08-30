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
    /** Baseline / domain line. */
    axisLine: ['stroke-border-default'],
    /** Tick marks. */
    axisTick: ['stroke-border-subtle'],
    /** Tick + category labels. */
    axisLabel: ['fill-text-tertiary text-3xs tabular-nums'],
    /** Background gridlines. */
    grid: ['stroke-border-hairline'],
    /** Generic data mark (line path, area, point). */
    mark: ['transition-[opacity] duration-[var(--blocks-duration-fast)]'],
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
