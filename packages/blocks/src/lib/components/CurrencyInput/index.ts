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
 * @summary Money entry that counts in cents, so nothing is lost to rounding.
 * @description Locale-aware monetary input that stores values in **minor units**
 * (cents for EUR/USD, pennies for GBP, etc.). The field is a fixed-scale mask
 * rather than free text: it re-formats on every keystroke, the fraction is a
 * fixed row of slots (deleting a cent digit zeroes it instead of pulling the
 * separator along), and the caret is carried as a digit position so the grouping
 * separators appearing and disappearing under it never move it. The currency
 * symbol is rendered as a static adornment (left or right of the field) and
 * stays visible at all times.
 *
 * Storing cents as integers avoids floating-point drift when summing, sorting,
 * or persisting amounts. Parsing also goes through string splits — never
 * `parseFloat * factor` — so `1,005` lands on the `100` minor units it reads as,
 * rather than the `99` IEEE-754 drift produces. A digit past the last place is
 * truncated, never rounded: `1,999` is `199`. Use
 * {@link CurrencyInputProps.precision} for currencies with non-2 decimal
 * places (JPY = 0, BHD = 3).
 *
 * @tag form
 * @related Input
 *
 * @example Default — follows the active i18n locale
 * ```svelte
 * <script>
 *   // "1.234,56 €" under a `de` provider, "1,234.56 €" under `en` (the default)
 *   let priceCents = $state(1234_56);
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
   * Micro-interaction preset forwarded to the inner Input. Redeclared from
   * InputProps so the inheritance is a documented contract rather than an
   * accident of the Omit list.
   * @default 'none'
   */
  mint?: InputProps['mint'];
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ CurrencyInput: {...} }}>`.
   * Resolved against the **`CurrencyInput`** key, not `Input`: a preset written for
   * the money field would otherwise style every text field under the provider.
   * `defaults.Input` still applies — the resolved preset reaches Input as
   * instance `slotClasses`, so it wins over the provider's input-wide defaults
   * and loses to `slotClasses` / `class` written on this component.
   * A preset's `overrides` rules are matched against what you wrote here plus
   * Input's own variant defaults; an axis Input derives for itself (`tier`,
   * `messageType`, `error`) can match the wrong state — #360.
   */
  preset?: string;

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
   * BCP 47 locale used for formatting (`Intl.NumberFormat`). Controls the
   * grouping separator (`.` vs `,`) and decimal separator. Defaults to
   * `'auto'`, which follows the active `<I18nProvider>` locale — SSR-safe
   * (server and client resolve the same locale, no hydration flash) and
   * consistent with the rest of the library's number formatting. Falls back
   * to the base locale (`en`) when no provider is mounted. Pass an explicit
   * BCP 47 string (e.g. `'de-DE'`, `'ja-JP'`) to override. `currency` is
   * intentionally **not** auto-detected, since it is orthogonal to locale
   * (a `de-CH` user may still bill in EUR).
   * @default 'auto'
   * @summary Which conventions the number follows — separators, symbol placement, spacing.
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
   * @summary Which side of the number the currency symbol sits on.
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
