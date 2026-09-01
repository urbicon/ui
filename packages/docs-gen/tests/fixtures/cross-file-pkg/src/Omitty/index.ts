import type {
  GridCellKeys,
  GridCellState,
  GridPublicAxes,
  GridSlotInternals,
  GridSlotProps,
  GridVariants
} from '../shared/grid.variants';

/**
 * The Planner shape verbatim: one literal key beside a `keyof` over the type
 * that names the per-cell axes.
 *
 * @description Fixture component that subtracts variant axes by `keyof`.
 * @tag display
 */
export interface OmitKeyofProps extends Omit<GridVariants, 'view' | keyof GridCellState> {
  /** Own prop. */
  own?: string;
}

/**
 * `keyof` alone, no literal beside it — so nothing at all is spelled out.
 *
 * @description Fixture component whose omit list is a bare `keyof`.
 * @tag display
 */
export interface OmitKeyofOnlyProps extends Omit<GridVariants, keyof GridCellState> {
  /** Own prop. */
  own?: string;
}

/**
 * A plain union alias in the key position — no `keyof` token to pattern-match
 * on, and no quotes to scan for either.
 *
 * @description Fixture component whose omit list is a union alias.
 * @tag display
 */
export interface OmitAliasProps extends Omit<GridVariants, GridCellKeys> {
  /** Own prop. */
  own?: string;
}

/**
 * `Exclude` in the key position: the omitted set is computed, not written.
 *
 * @description Fixture component whose omit list is an `Exclude`.
 * @tag display
 */
export interface OmitExcludeProps
  extends Omit<GridVariants, Exclude<keyof GridVariants, 'variant' | 'size'>> {
  /** Own prop. */
  own?: string;
}

/**
 * The `Pick` counterpart: the public axes named by `keyof` over another type.
 *
 * @description Fixture component that selects variant axes by `keyof`.
 * @tag display
 */
export interface PickKeyofProps extends Pick<GridVariants, keyof GridPublicAxes> {
  /** Own prop. */
  own?: string;
}

/**
 * Non-variant base, subtracted by `keyof`: an interface whose internal members
 * are named by their own type rather than respelled.
 *
 * @description Fixture component that subtracts interface members by `keyof`.
 * @tag display
 */
export interface OmitInterfaceKeyofProps extends Omit<GridSlotProps, keyof GridSlotInternals> {
  /** Own prop. */
  own?: string;
}
