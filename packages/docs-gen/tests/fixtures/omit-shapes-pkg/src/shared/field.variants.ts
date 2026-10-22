/**
 * A tv() config whose keys are not in alphabetical order, and the props type
 * built from it — the Input shape a wrapper (NumberInput) redeclares an axis of.
 */

declare function tv<C extends { variants: object }>(config: C): { config: C };

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

export const fieldVariants = tv({
  variants: {
    tier: { modify: {}, commit: {} },
    size: { xs: {}, sm: {}, md: {}, lg: {} }
  },
  defaultVariants: { tier: 'modify', size: 'md' }
});

export type FieldVariants = VariantProps<(typeof fieldVariants)['config']['variants']>;

export interface FieldProps extends FieldVariants {
  /** Field label. */
  label?: string;
}
