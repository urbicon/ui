/**
 * A two-level props chain in the Select shape: a generic interface that plain-
 * `extends` a base, which in turn takes its axes from a tv() alias and its DOM
 * attributes from a bag declared outside this package. A component reaches it
 * through `Omit<FrameSingleProps<string>, …>` (see `Chainy`).
 */

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

const frameVariants = {
  tone: { calm: {}, loud: {} },
  state: { idle: {}, busy: {} }
};

export type FrameVariants = VariantProps<typeof frameVariants>;

/**
 * The SelectBaseProps position. `state` is a derived axis and never a prop;
 * `ARIAMixin` is lib.dom's, so its members are declared outside the package —
 * the property a DOM-attribute bag (`svelte/elements`) has in the real tree.
 */
export interface FrameBaseProps extends Omit<FrameVariants, 'state'>, Partial<ARIAMixin> {
  /**
   * Whether the frame is disabled.
   * @default false
   */
  disabled?: boolean;
  /** Text shown while nothing is chosen. */
  placeholder?: string;
  /** Micro-interaction preset. */
  mint?: string;
}

/** The SelectSingleProps<T> position: generic, and a plain `extends` of the base. */
export interface FrameSingleProps<T = string> extends FrameBaseProps {
  /** Currently chosen value. */
  value?: T | null;
  /** Indicator rendered next to each option. */
  indicator?: 'check' | 'none';
  /** Label above the frame. */
  label?: string;
}
