import type { FrameSingleProps } from '../shared/frame';

/**
 * The LocaleSwitcher shape: an `Omit` over an interface whose members mostly
 * arrive through that interface's own heritage.
 *
 * @description Fixture component that omits from a derived interface.
 * @tag form
 */
export interface ChainyProps extends Omit<FrameSingleProps<string>, 'value'> {
  /** Own prop. */
  own?: string;
  /** Redeclared from the chain's base: this declaration is the one the type keeps. */
  mint?: string;
  /** Redeclared from the Omit target itself. */
  label?: string;
}

/**
 * The `Pick` counterpart over the same chain.
 *
 * @description Fixture component that picks from a derived interface.
 * @tag form
 */
export interface PickChainProps
  extends Pick<FrameSingleProps<string>, 'placeholder' | 'indicator'> {
  /** Own prop. */
  own?: string;
}
