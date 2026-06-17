import type { InputProps } from '$lib/primitives/Input';

/**
 * Where the currency symbol appears relative to the input field.
 * The symbol is rendered as a static adornment in the input's left or right
 * icon slot — never embedded in the editable text — so it stays visible during
 * editing and never doubles up with the locale's own currency formatting.
 * `'none'` suppresses the symbol entirely (e.g. for pure numeric editing).
 */
export type CurrencySymbolPosition = 'prefix' | 'suffix' | 'none';

/**
 * @description Locale-aware monetary input that stores values in **minor units**
 * (cents for EUR/USD, pennies for GBP, etc.). While focused the user types raw
 * digits with a single decimal separator; on blur the value is reformatted with
 * the locale's grouping separators. The currency symbol is rendered as a static
 * adornment (left or right of the field) and stays visible at all times.
 *
 * Storing cents as integers avoids floating-point drift when summing, sorting,
 * or persisting amounts. Parsing also goes through string splits — never
 * `parseFloat * factor` — so values like `1,005` round to the expected
 * `100` minor units (instead of `99` due to IEEE-754 drift). Use
 * {@link CurrencyInputProps.precision} for currencies with non-2 decimal
 * places (JPY = 0, BHD = 3).
 *
 * @tag form
 * @related Input
 *
 * @example Default — Euro with German locale
 * ```svelte
 * <script>
 *   let priceCents = $state(1234_56); // 1.234,56 €
 * </script>
 * <CurrencyInput label="Price" bind:value={priceCents} />
 * ```
 *
 * @example USD with prefix symbol
 * ```svelte
 * <CurrencyInput
 *   label="Amount"
 *   bind:value={amountCents}
 *   locale="en-US"
 *   currency="USD"
 *   symbolPosition="prefix"
 * />
 * ```
 *
 * @example Yen — zero decimal precision
 * ```svelte
 * <CurrencyInput bind:value={yen} locale="ja-JP" currency="JPY" precision={0} />
 * ```
 */
export interface CurrencyInputProps
  extends Omit<
    InputProps,
    | 'type'
    | 'value'
    | 'onClear'
    | 'inputmode'
    | 'oninput'
    | 'onchange'
    | 'onblur'
    | 'onfocus'
    | 'name'
  > {
  /**
   * Current monetary value in **minor units** (e.g. cents).
   * Use `null` for "no value entered yet"; the input renders empty.
   * @default null
   */
  value?: number | null;

  /**
   * Shared `name` for native form submission. When set, a hidden input
   * is rendered carrying the integer minor-unit value (matching
   * {@link CurrencyInputProps.value}) — never the locale-formatted display
   * string. The visible Input itself stays unnamed so the formatted text
   * is not submitted alongside.
   *
   * Empty / `null` values submit as `""` so the field still appears in
   * the FormData payload (consumers can disambiguate "untouched" via
   * server-side schema parsing).
   */
  name?: string;

  /**
   * BCP 47 locale used for formatting (`Intl.NumberFormat`). Controls
   * grouping separator (`.` vs `,`) and decimal separator. Pass `'auto'`
   * to defer to the runtime locale (`Intl.NumberFormat().resolvedOptions().locale`)
   * — i.e. the user's browser language. Note that the runtime locale on the
   * server (Node) and in the browser typically differ, so SSR pages using
   * `'auto'` may briefly show a different format on initial render before
   * hydration. `currency` is intentionally **not** auto-detected, since it
   * is orthogonal to locale (a `de-CH` user may still bill in EUR).
   * @default 'de-DE'
   */
  locale?: string;

  /**
   * ISO-4217 currency code. Determines the symbol when
   * {@link CurrencyInputProps.symbolPosition} is `'prefix'` or `'suffix'`.
   * @default 'EUR'
   */
  currency?: string;

  /**
   * Where the currency symbol is rendered as a static adornment. The symbol
   * is shown in the input's left or right icon slot (always visible, including
   * while focused) — it is never embedded in the editable text. Use `'none'`
   * for headless numeric editing (no symbol shown at all).
   * @default 'suffix'
   */
  symbolPosition?: CurrencySymbolPosition;

  /**
   * Number of fractional digits stored in {@link CurrencyInputProps.value}.
   * For most currencies `2`; for JPY use `0`, for BHD/KWD use `3`.
   * @default 2
   */
  precision?: number;

  /** Fires whenever the parsed value changes. Receives the new value in minor units (or `null`). */
  onValueChange?: (cents: number | null) => void;
}

export { default as CurrencyInput } from './CurrencyInput.svelte';

/**
 * Convert minor units (cents) to a major-unit number (euros, dollars).
 *
 * Use this at the boundary to APIs/datastores that work with major-unit
 * floats. **Inside your application keep amounts in minor units** to avoid
 * the floating-point drift that arises from repeated `* / 100` conversions.
 *
 * Returns `null` for `null`/`undefined`/`NaN` input — the inverse operation
 * of {@link majorToCents}.
 *
 * @example
 * ```ts
 * centsToMajor(123456);     // 1234.56
 * centsToMajor(123456, 3);  // 123.456 (for BHD/KWD-style 3-decimal currencies)
 * centsToMajor(15000, 0);   // 15000  (JPY-style 0-decimal currencies)
 * centsToMajor(null);       // null
 * ```
 */
export function centsToMajor(
  cents: number | null | undefined,
  precision: number = 2
): number | null {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return null;
  return cents / 10 ** Math.max(0, precision);
}

/**
 * Convert a major-unit number (euros, dollars) to minor units (cents).
 *
 * Use this when ingesting major-unit floats from an external API/datastore
 * before binding them to a {@link CurrencyInput}. The result is rounded to
 * the nearest minor unit.
 *
 * **Float-precision caveat:** by the time a value reaches this function as
 * a JavaScript `number`, IEEE-754 drift may already have occurred at the
 * caller (e.g. `0.1 + 0.2 === 0.30000000000000004`). For values that need
 * exact decimal preservation across system boundaries, transport them as
 * minor-unit integers (or as strings) instead of major-unit floats.
 *
 * @example
 * ```ts
 * majorToCents(1234.56);    // 123456
 * majorToCents(99.99);      // 9999
 * majorToCents(15000, 0);   // 15000
 * majorToCents(null);       // null
 * ```
 */
export function majorToCents(
  major: number | null | undefined,
  precision: number = 2
): number | null {
  if (major === null || major === undefined || Number.isNaN(major)) return null;
  return Math.round(major * 10 ** Math.max(0, precision));
}
