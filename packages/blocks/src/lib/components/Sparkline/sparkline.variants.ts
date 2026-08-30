import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Sparkline carries almost no look of its own — colour and stroke come from
 * props and land as SVG presentation attributes, not classes. The config
 * exists so the two classes it *does* emit sit where the fold can reach them:
 * a consumer's `class` / `slotClasses` entry has to be able to strip them.
 */
export const sparklineVariants = tv({
  slots: {
    /** Outer <span> around the svg. */
    root: [],
    /** The <svg> element. */
    svg: [],
    /** The line path. */
    line: [],
    /** The filled area under the line. */
    area: [],
    /** The end-point marker. */
    point: []
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
