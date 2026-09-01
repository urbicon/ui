import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Sparkline carries almost no look of its own — colour and stroke come from
 * props and land as SVG presentation attributes, not classes. The config
 * exists so the two classes it *does* emit sit where the fold can reach them:
 * a consumer's `class` / `slotClasses` entry has to be able to strip them.
 *
 * The slot names are the charts' (`internal/charts/variants.ts`), so one
 * vocabulary covers both families — except the end-point marker, which is one
 * circle where the charts' `point` is one per datum, and so is named apart.
 */
export const sparklineVariants = tv({
  slots: {
    /** Outer <span> around the svg. */
    root: [],
    /** The <svg> element. */
    svg: [],
    /** The stroked series path — the trend line itself. */
    mark: [],
    /** The filled area under the line, drawn only with `area`. */
    area: [],
    /**
     * The end-point marker, drawn only with `showEndPoint`: exactly one circle,
     * at the last value. The charts' `point` is one marker per datum.
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
