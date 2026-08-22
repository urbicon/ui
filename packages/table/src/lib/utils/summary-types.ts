import type { DeepKeys } from '@urbicon-ui/i18n';
import type enTranslations from '../translations/en';

/**
 * The summary vocabulary — the five aggregation types, each with its
 * translation key and the glyph the grid chrome renders (summary row, header
 * indicator, menu options).
 *
 * WHY ONE MODULE. This list existed in five hand-written copies (HeaderMenu,
 * SummaryMenu, SummaryPanel, SummaryRow, ChipsField — plus a glyph switch in
 * TableHead), and only one of them was compile-anchored to the store union.
 * A sixth aggregation type cost 15 independent touch points of which the
 * compiler reported two, and the copies could drift apart without any error
 * (the `'avg'` → `'average'` drift ChipsField's history records). Now the
 * store union {@link SummaryType} is DERIVED from this array, so a list and a
 * union that disagree are unrepresentable — same argument as
 * `column-capabilities.ts` next door (#251).
 *
 * The `labelKey` half is typed against the real translation bundle
 * (`DeepKeys<typeof enTranslations>` — exactly what `useTableI18n`'s `t`
 * accepts), so a key that stops existing is a compile error here, not a
 * `tt(undefined)` crash at render.
 */
export const SUMMARY_TYPES = [
  { value: 'sum', labelKey: 'summary.types.sum', glyph: '∑' },
  { value: 'avg', labelKey: 'summary.types.average', glyph: '⌀' },
  { value: 'count', labelKey: 'summary.types.count', glyph: '#' },
  { value: 'min', labelKey: 'summary.types.minimum', glyph: '↓' },
  { value: 'max', labelKey: 'summary.types.maximum', glyph: '↑' }
] as const satisfies readonly {
  value: string;
  labelKey: DeepKeys<typeof enTranslations>;
  glyph: string;
}[];

/** The closed union of aggregation codes — `SummaryConfig['type']` derives from it. */
export type SummaryType = (typeof SUMMARY_TYPES)[number]['value'];

/**
 * Membership in the vocabulary. Every runtime entrance where an aggregation
 * code arrives as a plain string funnels through this: prefs hydration and
 * the panel's radio value. (The summary menu used to be a third entrance —
 * it parsed a `columnId:type` compound back apart — until #240 moved it onto
 * the Menu primitive, whose options carry column and type as objects.)
 * `typeof x === 'string'` is not a check — `'median'` from an older
 * app version passed it and crashed the whole table at mount (#251).
 */
export function isSummaryType(value: unknown): value is SummaryType {
  return SUMMARY_TYPES.some((entry) => entry.value === value);
}

// The two lookup shapes the render sites want, derived mechanically from the
// array above — the casts only name what the derivation guarantees.

/** Aggregation code → glyph (`∑ ⌀ # ↓ ↑`). */
export const SUMMARY_TYPE_GLYPH = Object.fromEntries(
  SUMMARY_TYPES.map((entry) => [entry.value, entry.glyph] as const)
) as { readonly [E in (typeof SUMMARY_TYPES)[number] as E['value']]: E['glyph'] };

/**
 * Aggregation code → translation key. The codes (`avg`/`min`/`max`) differ
 * from their key leaves (`average`/`minimum`/`maximum`) on purpose — the keys
 * spell the words out — so interpolating `summary.types.${type}` would miss
 * for three of five. Values keep their literal types so `tt()` accepts them.
 */
export const SUMMARY_TYPE_LABEL_KEY = Object.fromEntries(
  SUMMARY_TYPES.map((entry) => [entry.value, entry.labelKey] as const)
) as { readonly [E in (typeof SUMMARY_TYPES)[number] as E['value']]: E['labelKey'] };
