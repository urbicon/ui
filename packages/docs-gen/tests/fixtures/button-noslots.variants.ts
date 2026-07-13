/**
 * Fixture: a tv() config with NO `slots:` block (single-slot component, e.g.
 * Button). extractSlotNames must return [] rather than inventing slot names
 * from the variant keys.
 */
declare const tv: (config: unknown) => Record<string, unknown>;

export const buttonVariants = tv({
  variants: {
    intent: { primary: {}, danger: {} },
    size: { sm: {}, md: {} }
  },
  defaultVariants: { intent: 'primary', size: 'md' }
});
