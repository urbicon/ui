/**
 * Types that name their values somewhere other than where a prop uses them —
 * a reader of the written type sees no literal, the checker sees all of them.
 */

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

/** A tv() config: the axis' values are its keys, written smallest first. */
const scaleVariants = {
  scale: { sm: {}, md: {}, lg: {} }
};

export type ScaleVariants = VariantProps<typeof scaleVariants>;

/** The runtime list a computed union is read from. */
export const TONES = ['calm', 'loud', 'quiet'] as const;
export type Tone = (typeof TONES)[number];

/**
 * The same literals in the opposite order. Resolving this first makes the
 * checker create them in that order, which is the order it then reports every
 * union over them in.
 */
export type ReversedLiterals = 'quiet' | 'loud' | 'calm' | 'lg' | 'md' | 'sm';

type Side = 'top' | 'bottom';
type Align = 'start' | 'end';
export type Spot = Side | `${Side}-${Align}`;

export type Flag = boolean;
export type Label = string;

/** A base whose member another interface reads by key. */
export interface ResolvyBaseProps extends ScaleVariants {
  /** How the widget lays out its parts. */
  layout?: 'stacked' | 'inline';
}
