/**
 * Stand-ins for this repo's tv() shape. The `Pick` defect only shows itself
 * here: a variant axis is a property of a **mapped type**, so its symbol's
 * declaration points back at the config it was mapped from — never at anything
 * resembling a documented prop.
 *
 * Two shapes, because they fail differently:
 *
 *  - `tone` (mapped over a declared object **type**) has a `PropertySignature`
 *    declaration typed `{ calm: unknown; loud: unknown }`. Read syntactically,
 *    a picked `tone` reports that config object as its type. Only the checker
 *    knows the axis is `'calm' | 'loud'`.
 *  - `density` (mapped over a real object **literal**, which is what `tv()`
 *    takes) has a `PropertyAssignment` declaration and therefore no property
 *    signature and no JSDoc at all.
 */

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

declare const toneVariants: {
  tone: { calm: unknown; loud: unknown };
};

const densityVariants = {
  density: { compact: {}, cosy: {} }
};

export type ToneVariants = VariantProps<typeof toneVariants>;
export type DensityVariants = VariantProps<typeof densityVariants>;

/** Props of the fixture "Gadget": tv() axes plus hand-declared props. */
export interface GadgetProps extends ToneVariants, DensityVariants {
  /**
   * Whether the gadget is disabled.
   * @default false
   */
  disabled?: boolean;
  /** Internal flag that consumers must not set. */
  hidden?: boolean;
}
