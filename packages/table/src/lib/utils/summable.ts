import type { Column } from '../types';

/**
 * Whether a column may be offered Sum / Avg / Min / Max.
 *
 * The single source of truth for that question. It used to be three copies of
 * one regex — `SummaryMenu`, `HeaderMenu` and the `TableColumns.text` factory
 * each carried `/^(age|salary|price|amount|count|number|projectsCompleted|rating|score)$/i`
 * — which is both a drift hazard and, more importantly, the wrong question.
 *
 * **A column's name says nothing about its data.** A column called `price` whose
 * accessor yields `'$95'` was offered a sum that cannot work, and the result was
 * a dash indistinguishable from "no rows" (DEV-warned since 2026-07-30, but the
 * offer was still made). A genuinely numeric column called `throughput` was
 * offered nothing at all. Nine hardcoded English nouns also meant the feature
 * simply did not exist for anyone whose columns are named in another language.
 *
 * So capability now follows configuration only:
 *
 *   1. `summable` — the explicit answer, and it wins either way;
 *   2. `dataType: 'number'` — the declared type, which the numeric factories
 *      (`TableColumns.number`, `TableColumns.currency`, …) set for you.
 *
 * A consumer who wants the old behaviour for one column writes
 * `summable: true`; the honest fix for a whole table is to declare the numeric
 * columns as numeric, which also gets them right-aligned.
 *
 * Synthetic columns (no accessor) are never summable — there is no source value
 * to reduce, regardless of what anything is called.
 */
export function isColumnSummable(col: Column): boolean {
  if (col.accessor === undefined) return false;
  // After the accessor check, TS narrows `col` to the shapes that carry data.
  const dataCol = col as Exclude<Column, { accessor?: never }>;
  if (dataCol.summable !== undefined) return dataCol.summable === true;
  return dataCol.dataType === 'number';
}
