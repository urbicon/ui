import type { GadgetProps, ToneVariants } from '../shared/gadget.variants';
import type { BarProps } from '../shared/types';

/**
 * @description Fixture component that picks a subset of an imported interface.
 * @tag form
 */
export interface PickyProps extends Pick<BarProps, 'label' | 'size'> {
  /** Own prop. */
  own?: string;
}

/**
 * The CopyButton shape: the base is a *Props interface, but two of its three
 * picked members reach it through a tv() variant alias, so only the checker
 * sees them.
 *
 * @description Fixture component that picks through a variant alias.
 * @tag form
 */
export interface ThroughVariantsProps extends Pick<GadgetProps, 'tone' | 'density' | 'disabled'> {
  /** Own prop. */
  own?: string;
}

/**
 * The JourneyTimeline shape: the base is the *Variants alias itself, which is
 * a statement about which axes are public.
 *
 * @description Fixture component that picks straight from a variants alias.
 * @tag form
 */
export interface PickVariantsProps extends Pick<ToneVariants, 'tone'> {
  /** Own prop. */
  own?: string;
}
