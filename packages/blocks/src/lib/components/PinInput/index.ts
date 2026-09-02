import type { PinInputSlots, PinInputVariants } from './pin-input.variants';

/**
 * @summary One cell per digit, for codes that arrive by mail or app.
 * @description Segmented one-time-code / PIN entry — a row of single-character
 * cells with auto-advance, backspace-to-previous, paste-to-fill, and optional
 * masking. Purpose-built for the 2FA/OTP step: the first cell carries
 * `autocomplete="one-time-code"` on its own, so iOS offers an incoming SMS code
 * as a keyboard suggestion. The value is the concatenated string; `onComplete`
 * fires each time the row becomes complete.
 *
 * @tag form
 * @related Input
 * @related NumberInput
 * @stability beta
 *
 * @example
 * ```svelte
 * <script>
 *   let code = $state('');
 * </script>
 * <PinInput bind:value={code} length={6} onComplete={(v) => verify(v)} />
 * ```
 *
 * @example Masked, alphanumeric, grouped with a separator
 * ```svelte
 * <PinInput length={8} type="alphanumeric" mask separator="-" groupSize={4} />
 * ```
 */
export interface PinInputProps extends Omit<PinInputVariants, 'error'> {
  /** Current value — the concatenated cell characters. Supports `bind:value`. */
  value?: string;
  /** Number of cells. @default 6 */
  length?: number;
  /**
   * Allowed characters and keyboard hint. `numeric` accepts `0-9` and sets a
   * numeric inputmode; `alphanumeric` also accepts `A-Z`/`a-z`. @default 'numeric'
   * @summary Which characters the field accepts — digits only, or letters too.
   */
  type?: 'numeric' | 'alphanumeric';
  /**
   * Render each filled cell as a masked dot (password style). For a standing PIN or
   * passcode, not for a throwaway SMS code — masking one buys no secrecy and costs the
   * user the ability to check what they typed.
   *
   * @summary Renders each filled cell as a dot instead of the character.
   * @default false
   */
  mask?: boolean;
  /** Placeholder character shown in every empty cell. @default '' */
  placeholder?: string;
  /**
   * Uppercase alphanumeric input as it is entered — keeps a code like `ABCD`
   * visually consistent regardless of caps lock. Ignored for `numeric`.
   * @default false
   */
  uppercase?: boolean;
  /** Focus the first empty cell on mount. @default false */
  autoFocus?: boolean;

  /**
   * Render a separator between groups of `groupSize` cells (e.g. `123-456`).
   * A string is shown verbatim; omit for no separator.
   */
  separator?: string;
  /** Cells per group when `separator` is set. @default 3 */
  groupSize?: number;

  /** Blocks input and dims the whole row. @default false */
  disabled?: boolean;
  /** Shows the value but refuses edits; the cells stay focusable. @default false */
  readonly?: boolean;
  /**
   * Marks the label with an asterisk and sets `aria-required` on the cells. It does
   * not block a native submit — the value lives in component state, so validate it
   * yourself before you act on it.
   *
   * @default false
   */
  required?: boolean;

  /** Group label rendered above the cells and linked via `aria-labelledby`. */
  label?: string;
  /** Helper text below the cells — hidden when `error` is present. */
  helper?: string;
  /**
   * Error message below the cells. When set it overrides `helper`, colours the
   * cells danger, and sets `aria-invalid` on every cell.
   */
  error?: string;

  /** Fires after any change (typing, paste, backspace) with the full value. */
  onValueChange?: (value: string) => void;
  /**
   * Fires each time the row becomes complete, with the full value — so
   * correcting a rejected code fires it again. Not once per mount.
   */
  onComplete?: (value: string) => void;

  /** Shared `name` for a hidden input, for native form submission. */
  name?: string;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: root (what `class`
   * also targets) | label | group | cell | separator | message.
   */
  slotClasses?: Partial<Record<PinInputSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ PinInput: {...} }}>`. */
  preset?: string;

  /**
   * Accessible name for the cell group when no visible `label` is set. Each
   * cell additionally announces its position ("Character 2 of 6").
   */
  'aria-label'?: string;
  /** Root id; the cells derive their ids and ARIA wiring from it. */
  id?: string;
}

export { default as PinInput } from './PinInput.svelte';
export { type PinInputVariants, pinInputVariants } from './pin-input.variants';
