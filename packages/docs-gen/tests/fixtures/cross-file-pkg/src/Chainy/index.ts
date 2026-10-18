import type { BoxedFrameProps, FrameSingleProps } from '../shared/frame';

/**
 * The LocaleSwitcher shape: an `Omit` over an interface whose members mostly
 * arrive through that interface's own heritage, its key list spread over lines
 * with a note between them.
 *
 * @description Fixture component that omits from a derived interface.
 * @tag form
 */
export interface ChainyProps
  extends Omit<
    FrameSingleProps<string>,
    // Owned by the component itself.
    'value'
  > {
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

/**
 * An `Omit` over a base whose members a mapped type retyped.
 *
 * @description Fixture component that omits from a retyped base.
 * @tag form
 */
export interface BoxChainProps extends Omit<BoxedFrameProps, 'internal'> {
  /** Own prop. */
  own?: string;
}
