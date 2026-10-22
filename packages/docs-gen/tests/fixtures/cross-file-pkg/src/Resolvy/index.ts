import type {
  Flag,
  Label,
  Letters,
  ResolvyBaseProps,
  ScaleVariants,
  Spot,
  Tone
} from '../shared/resolvy';

/**
 * @description Fixture component whose props take their values from types declared elsewhere.
 * @tag form
 */
export interface ResolvyProps {
  /** A computed union over a `const` tuple. */
  tone?: Tone;
  /** A tv() axis read by key. */
  scale?: ScaleVariants['scale'];
  /** A member of another props interface, read by key. */
  layout?: ResolvyBaseProps['layout'];
  /** A template literal over two unions. */
  spot?: Spot;
  /** `NonNullable` over a tv() axis. */
  strictScale?: NonNullable<ScaleVariants['scale']>;
  /** A conditional type: the source fixes no order. */
  letter?: Exclude<'b' | 'c' | 'a' | 'x', 'x'>;
  /** A boolean behind an alias — a flag, not a choice. */
  flag?: Flag;
  /** Not a literal union at all. */
  label?: Label;
  /** A written union that mixes a literal with a non-literal. */
  height?: number | 'auto';
  /** A written literal next to an alias that holds the rest. */
  mixed?: 'auto' | Letters;
  /** Numbers, through a conditional type: the source fixes no order. */
  count?: Exclude<10 | 2 | 1 | 99, 99>;
}

/**
 * @description Fixture component that picks a tv() axis through a base interface.
 * @tag form
 */
export interface PickScaleProps extends Pick<ResolvyBaseProps, 'scale' | 'layout'> {
  /** Own prop. */
  own?: string;
  /** The picked tv() axis, redeclared: nothing else documents it. */
  scale?: ResolvyBaseProps['scale'];
}
