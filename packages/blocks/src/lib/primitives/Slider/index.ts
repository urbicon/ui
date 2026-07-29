import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { SliderSlots, SliderVariants } from './slider.variants';

/** A labelled tick mark on the slider track. */
export interface SliderMark {
  value: number;
  label?: string;
}

/**
 * Display texts for the three range status zones (validRange/recommendedRange).
 * Only shown when `validRange` and/or `recommendedRange` are set. Missing
 * texts fall back to the UIB i18n localization.
 */
export interface SliderRangeStatusText {
  /** Value is within the recommended range. */
  insideRecommended?: string;
  /** Value is within the valid range but outside the recommended range. */
  insideValidOnly?: string;
  /** Value is outside the valid range. */
  outsideValid?: string;
}

/**
 * @summary Drag to a value, or to a range between two.
 * @description Slider for selecting a numeric value or range within min/max bounds.
 * Supports single and range modes, step snapping, tick marks, and labels.
 *
 * Optional `validRange` and `recommendedRange` paint the track as a three-zone
 * gradient (red/yellow/green) and show a live status text that is also announced
 * via an ARIA live region. Both props are optional and additive — a slider
 * without `validRange`/`recommendedRange` behaves exactly as before.
 *
 * @tag form
 *
 * @example
 * ```svelte
 * <Slider label="Volume" bind:value={volume} />
 * ```
 *
 * @example
 * ```svelte
 * <Slider label="Price range" range bind:value={priceRange} min={0} max={500} step={10} showValue />
 * ```
 *
 * @example
 * ```svelte
 * <Slider
 *   label="Consumption share of heating costs"
 *   bind:value={share}
 *   min={0}
 *   max={100}
 *   step={5}
 *   validRange={[50, 100]}
 *   recommendedRange={[60, 80]}
 *   formatValue={(v) => `${v} %`}
 * />
 * ```
 */
export interface SliderProps
  extends Omit<SliderVariants, 'error' | 'rangeStatus'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** Current value. Number for single, [min, max] tuple for range. Supports `bind:value`. */
  value?: number | [number, number];

  /** Minimum allowed value. @default 0 */
  min?: number;

  /** Maximum allowed value. @default 100 */
  max?: number;

  /** Snap to increments of this value. @default 1 */
  step?: number;

  /** Enable range mode with two thumbs. @default false */
  range?: boolean;

  /** Text label displayed above the slider. */
  label?: string;

  /** Show the current value next to the label. @default false */
  showValue?: boolean;

  /** Format function for the displayed value. */
  formatValue?: (value: number | [number, number]) => string;

  /** Tick marks along the track. */
  marks?: SliderMark[];

  /** Error message below the slider. Overrides `helper`. */
  error?: string;

  /** Helper text below the slider. Hidden when `error` is set. */
  helper?: string;

  /**
   * Valid value range (e.g. a legal limit). Values outside it style track and
   * thumb in the `outOfValidRangeIntent` color (default: `danger`). Status
   * changes are announced via an ARIA live region. If the range lies outside
   * `[min, max]`, a console warning is emitted — the visible `min`/`max` are
   * NOT shifted automatically.
   */
  validRange?: [number, number];

  /**
   * Recommended value range (UX recommendation, softer than `validRange`).
   * Values inside appear green, values outside yellow (warning). Typically
   * `recommendedRange ⊂ validRange`, but this is not enforced.
   */
  recommendedRange?: [number, number];

  /**
   * Intent applied outside the `validRange`. `'warning'` for softer limits
   * (recommendation, not a violation), `'danger'` for hard limits.
   * @default 'danger'
   */
  outOfValidRangeIntent?: 'danger' | 'warning';

  /**
   * Custom status texts for the three zones. Defaults to the UIB i18n
   * localization (`bt('slider.rangeStatus.*')`).
   */
  rangeStatusText?: SliderRangeStatusText;

  /** @default false */
  disabled?: boolean;

  /** Shared `name` for hidden inputs for form submission. */
  name?: string;

  /** Fires after the value changes. Receives the new value. */
  onValueChange?: (value: number | [number, number]) => void;

  /** Micro-interaction preset. @default 'none' */
  mint?: MintProp;

  /** Extra classes merged onto the root wrapper. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (root —
   * what `class` also targets) | header | label | valueText | base (the
   * interactive track container) | track | range | thumb | mark | boundaryTick
   * | rangeStatus | rangeStatusIcon | message.
   */
  slotClasses?: Partial<Record<SliderSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Slider: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Slider } from './Slider.svelte';
export { type SliderVariants, sliderVariants } from './slider.variants';
