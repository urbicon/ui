import type { ChartSlot } from '$lib/internal/charts/variants';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Sparkline carries almost no look of its own — colour and stroke come from
 * props and land as SVG presentation attributes, not classes. The config
 * exists so the two classes it *does* emit sit where the fold can reach them:
 * a consumer's `class` / `slotClasses` entry has to be able to strip them.
 *
 * The end-point marker is the one name that deliberately does *not* follow the
 * charts: their `point` is one marker per series and datum, this is a single
 * circle, and a shared name would read as portable while landing on a
 * different number of elements. Renaming it to `point` re-creates that.
 */
export const sparklineVariants = tv({
  slots: {
    /** Outer <span> around the svg. */
    root: [],
    /** The <svg> element. */
    svg: [],
    /**
     * The stroked trend path — one, since a sparkline plots one series. Reaches
     * this path only: unlike `<AreaChart>`, where `mark` is folded onto the
     * filled band as well, the band here carries `area` alone.
     */
    mark: [],
    /** The filled area under the line, drawn only with `area`. */
    area: [],
    /**
     * The end-point marker, drawn only with `showEndPoint`: exactly one circle,
     * at the last value. The charts' `point` is one circle per series *and*
     * datum.
     */
    endPoint: []
  },
  variants: {
    /** Fills the container instead of drawing at the intrinsic width/height. */
    fluid: {
      true: { root: 'block w-full', svg: 'w-full h-auto' },
      false: { root: 'inline-block align-middle' }
    }
  },
  defaultVariants: {
    fluid: false
  }
});

export type SparklineVariants = VariantProps<typeof sparklineVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SparklineSlots = SlotNames<typeof sparklineVariants>;

/** `T` unchanged, and a compile error unless every member of it is in `U`. */
type AssertSubset<T extends U, U> = T;

/**
 * One vocabulary across both chart families, checked rather than asserted in
 * prose: every slot above except `endPoint` has to be a name `chartVariants`
 * already declares. Renaming a slot on either side is a `TS2344` here instead
 * of a silent drift. Type-only — it costs no runtime bytes.
 */
type _SparklineTakesChartNames = AssertSubset<SparklineSlots, ChartSlot | 'endPoint'>;
