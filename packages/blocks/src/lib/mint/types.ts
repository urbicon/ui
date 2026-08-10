export interface MintConfig {
  /**
   * `hover` and `focus` hold the effect while the pointer/visible focus stays
   * on the element; `click` and `load` run it once.
   */
  trigger?: 'hover' | 'click' | 'focus' | 'load';
  /**
   * Effect duration in ms. Written as an inline per-effect custom property
   * (`--blocks-mint-<effect>-duration`), so the CSS transition/animation
   * actually runs at this speed; unset, the theme duration tokens apply.
   */
  duration?: number;
  /** Delay in ms before the effect applies. */
  delay?: number;
  /**
   * CSS easing for the effect (`--blocks-mint-<effect>-easing` inline);
   * unset, the per-effect theme default applies.
   */
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
  /** Scale factor for the `scale` effect (`--blocks-mint-scale-intensity`). */
  intensity?: number;
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
 *
 * `animation-iteration` is for classes whose animation runs `infinite`
 * (pulse): `animationend` never fires there, so the run settles at the end of
 * the current cycle instead of the fallback timeout cutting it mid-cycle.
 * Same keyframe-name convention as `animation` — and for an infinite
 * animation the convention is load-bearing in the other direction too: with
 * a foreign keyframe name the fallback timeout is the only end, and on an
 * endless animation "late, never early" cannot hold — the timeout cuts
 * mid-cycle (Avatar's renamed pulse override is the known case).
 */
export type MintSettleSignal =
  | { via: 'animation' }
  | { via: 'animation-iteration' }
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
