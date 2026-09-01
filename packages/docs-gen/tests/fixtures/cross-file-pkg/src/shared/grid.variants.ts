/**
 * The Planner shape: a tv() axis roster where four axes are per-cell state and
 * are re-exported as their own type, so the props type can subtract them by
 * `keyof` instead of respelling their names.
 */

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

const gridVariants = {
  view: { week: {}, month: {}, range: {} },
  variant: { default: {}, bordered: {} },
  size: { sm: {}, md: {}, lg: {} },
  dayState: { default: {}, today: {}, disabled: {} },
  selected: { true: {}, false: {} },
  weekend: { true: {}, false: {} },
  outside: { true: {}, false: {} }
};

export type GridVariants = VariantProps<typeof gridVariants>;

/** The axes resolved per cell, never props. */
export type GridCellState = Pick<GridVariants, 'dayState' | 'selected' | 'weekend' | 'outside'>;

/** The same four names as a bare union alias — no `keyof` at the use site. */
export type GridCellKeys = 'dayState' | 'selected' | 'weekend' | 'outside';

/** The public axes, for the `Pick` counterpart. */
export type GridPublicAxes = Pick<GridVariants, 'variant' | 'size'>;

/** Non-variant base with a subtractable member set. */
export interface GridSlotProps {
  /** Label text. */
  label?: string;
  /** Size of the widget. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Internal flag consumers must not set. */
  hidden?: boolean;
  /** Second internal flag. */
  secret?: boolean;
}

/** The members of `GridSlotProps` that are internal. */
export type GridSlotInternals = Pick<GridSlotProps, 'hidden' | 'secret'>;
