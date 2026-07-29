export interface MintConfig {
  trigger?: 'hover' | 'click' | 'focus' | 'load';
  duration?: number;
  delay?: number;
  easing?: string;
  disabled?: boolean;
}

export interface Mint<TConfig extends MintConfig = MintConfig> {
  /** Called once after element is in the DOM */
  init(el: HTMLElement, config?: TConfig): void;

  /** Optional cleanup */
  destroy?(el: HTMLElement): void;

  /** Optional config updates */
  update?(el: HTMLElement, config: TConfig): void;
}

export type MintFactory<TConfig extends MintConfig = MintConfig> = (
  config?: TConfig
) => Mint<TConfig>;

export interface MintInstance {
  mint: Mint;
  destroy: () => void;
}

// Specific mint configs
export interface MicroInteractionConfig extends MintConfig {
  intensity?: number;
  transformOrigin?: string;
}

/**
 * Which CSS mechanism a mint class drives — and therefore the ONLY event the
 * cleanup is allowed to settle on. A class either runs keyframes or a
 * transition, never both.
 *
 * Not part of the config: this is a property of the stylesheet rule, not
 * something a consumer configures. It is declared where the class is named.
 *
 * Load-bearing, because both events bubble and host elements transition on
 * their own: a Checkbox box transitions `color, background-color,
 * border-color, box-shadow, scale` on every checked change. The first of
 * those to finish used to call the cleanup and strip `blocks-mint-bounce`
 * ~20 ms into a 500 ms animation — every click-mint on every element with
 * transitions was dead (bounce/shake/wiggle on Button, ButtonGroup,
 * SegmentItem, Checkbox).
 *
 * `animation` matches on the keyframe name, which by convention equals the
 * class name (`.blocks-mint-bounce` → `@keyframes blocks-mint-bounce`). A
 * custom effect that breaks that convention simply falls through to the
 * fallback timeout — late, never early.
 */
export type MintSettleSignal =
  | { via: 'animation' }
  | { via: 'transition'; properties: readonly string[] };

export interface RippleConfig extends MintConfig {
  color?: string;
  opacity?: number;
  size?: number;
}

export interface CompositeConfig extends MintConfig {
  mints: Array<string | { name: string; config?: MintConfig }>;
}

// Polymorphic mint property type
export type MintProp =
  | string
  | { name: string; config?: MintConfig & Record<string, unknown> }
  | Array<string>
  | Array<string | { name: string; config?: MintConfig & Record<string, unknown> }>;
