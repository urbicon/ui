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

/** Row spacing of the option list. */
export type FrameDensity = 'compact' | 'cosy';

/** The SelectSingleProps<T> position: generic, and a plain `extends` of the base. */
export interface FrameSingleProps<T = string> extends FrameBaseProps {
  /** Currently chosen value. */
  value?: T | null;
  /** Value shown while nothing is chosen. */
  fallback?: T | null;
  /** Fires when the option list opens or closes. */
  onOpen?: (open: boolean) => void;
  /** Fires with the value a reader picks. */
  onPick?: (value: T) => void;
  /** Row spacing. */
  density?: FrameDensity;
  /** Indicator rendered next to each option. */
  indicator?: 'check' | 'none';
  /** Label above the frame. */
  label?: string;
}

type Box<T> = { boxed: T };
/** A mapping that changes every member's type. */
type Boxed<T> = { [K in keyof T]?: Box<T[K]> };

interface FrameMetrics {
  /** Width in pixels. */
  width?: number;
}

/** A base whose members reach it through `Boxed`, typed `Box<…>` rather than as written. */
export interface BoxedFrameProps extends Boxed<FrameMetrics> {
  /** Internal flag. */
  internal?: boolean;
}
