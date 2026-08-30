import type { Snippet } from 'svelte';
import type { InputProps } from '$lib/primitives/Input';

/**
 * @summary A number field with bounds, steppers and arrow-key stepping.
 * @description Generic numeric input with min/max/step bounds, stepper buttons,
 * and Arrow-key / mouse-wheel increment. Built on {@link Input}, so it inherits
 * labels, validation, sizes and variants. Values are plain numbers (not minor
 * units) — {@link CurrencyInput} is the domain-specific specialization for money.
 *
 * The field accepts a leading `-`, a single decimal separator (`.` or `,`), and
 * clamps to `[min, max]` on blur; the stepper and Arrow keys clamp immediately.
 * Set {@link precision} to fix the number of decimal places.
 *
 * @tag form
 * @related Input
 * @related CurrencyInput
 * @related Slider
 * @stability beta
 *
 * @example
 * ```svelte
 * <script>
 *   let qty = $state(1);
 * </script>
 * <NumberInput label="Quantity" bind:value={qty} min={0} max={99} step={1} />
 * ```
 *
 * @example Decimal step with fixed precision
 * ```svelte
 * <NumberInput label="Rate" bind:value={rate} min={0} max={1} step={0.05} precision={2} />
 * ```
 */
export interface NumberInputProps
  extends Omit<
    InputProps,
    // NumberInput owns these internally and does not forward them: the numeric
    // handlers (input/focus/blur/keydown/wheel), the raw string `value`, the
    // fixed `type`/`inputmode`, and `children`. `clearable`/`onClear` are omitted
    // too — Input's clear button would replace the stepper and, worse, write only
    // Input's internal string value, drifting the numeric model out of sync.
    | 'value'
    | 'type'
    | 'inputmode'
    | 'oninput'
    | 'onfocus'
    | 'onblur'
    | 'onkeydown'
    | 'onwheel'
    | 'clearable'
    | 'onClear'
    | 'children'
  > {
  /** Current numeric value. `null` when the field is empty. Supports `bind:value`. */
  value?: number | null;
  /**
   * Micro-interaction preset forwarded to the inner Input. Redeclared from
   * InputProps so the inheritance is a documented contract rather than an
   * accident of the Omit list.
   * @default 'none'
   */
  mint?: InputProps['mint'];
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ NumberInput: {...} }}>`.
   * Resolved against the **`NumberInput`** key, not `Input`: a preset written for
   * the number field would otherwise style every text field under the provider.
   * `defaults.Input` still applies — the resolved preset reaches Input as
   * instance `slotClasses`, so it wins over the provider's input-wide defaults
   * and loses to `slotClasses` / `class` written on this component.
   */
  preset?: string;
  /** Minimum allowed value. Clamped on step / Arrow / blur. */
  min?: number;
  /** Maximum allowed value. Clamped on step / Arrow / blur. */
  max?: number;
  /** Increment applied by the stepper buttons, Arrow keys, and wheel. @default 1 */
  step?: number;
  /**
   * Fixed number of decimal places for display and rounding. When unset, the
   * value is shown as typed and the step's own decimals drive rounding.
   * @summary Fixed number of decimal places. Unset shows the value as typed.
   */
  precision?: number;
  /** Hide the up/down stepper buttons (Arrow keys + wheel still work). @default false */
  hideStepper?: boolean;
  /** Shared `name` for a hidden input for native form submission. */
  name?: string;
  /** Fires after the value changes (typing, stepper, Arrow, wheel, or clamp). */
  onValueChange?: (value: number | null) => void;
  /** A custom right-side adornment. Overrides the stepper — pair with `hideStepper` or provide your own controls. */
  rightIcon?: Snippet;
}

export { default as NumberInput } from './NumberInput.svelte';
