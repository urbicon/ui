/**
 * What a column may be asked to do: sort, search, group, summarize — one
 * predicate per axis, and the only place each question is answered.
 *
 * WHY ONE MODULE. Every axis is asked from at least two surfaces that a reader
 * experiences as one feature: the column's `⋮` header menu and the filter bar's
 * tool of the same name (which itself renders twice, as a popover on a wide bar
 * and as a sheet section on a narrow one). While the rule sat inline at each
 * call site, "the same feature" was a claim nothing held up — and it broke
 * exactly where you would expect:
 *
 *   `groupable` unset, `sortable` unset. The header menu offered *Group by
 *   column* (`groupable !== false`) while the toolbar's grouping list left the
 *   column out (`groupable === true || sortable === true`). One column, two
 *   answers, no error anywhere — and the docs page had to describe both.
 *
 * A gate comparing the copies would have reported that. Deleting the copies
 * makes it unrepresentable instead, which is the order this repo argues for.
 * So: no lint, one function per axis, and every surface calls it.
 *
 * WHY CONFIGURATION ONLY. None of these predicates looks at what a column is
 * *called*. {@link isColumnSummable} is the cautionary tale — it used to match
 * nine English nouns by regex, so a `price` column yielding `'$95'` was offered
 * a sum that could not work while a numeric `throughput` was offered none, and
 * the feature did not exist at all for columns named in another language.
 * Capability follows what the consumer declared, or it is not offered.
 *
 * Synthetic columns (no accessor) are never capable of any of it: there is no
 * value to sort, match, bucket or reduce. That check leads every predicate.
 */
import type { Column } from '../types';

/** The column shapes that carry data — everything except the synthetic one. */
type DataColumn = Exclude<Column, { accessor?: never }>;

/** Narrow to a data column, or `null` for a synthetic one. */
function asDataColumn(col: Column): DataColumn | null {
  return col.accessor === undefined ? null : (col as DataColumn);
}

/**
 * Whether a column sorts — by a header click, from its header menu, and from
 * the filter bar's sort tool.
 *
 * **Opt-out.** Sorting is the one operation that works on any value, so a data
 * column sorts unless `sortable: false` says otherwise. The flag exists to take
 * it away (a column of free text nobody would order by), not to grant it.
 */
export function isColumnSortable(col: Column): boolean {
  const dataCol = asDataColumn(col);
  return dataCol !== null && dataCol.sortable !== false;
}

/**
 * Whether a column takes part in the search field's matching and offers a
 * per-column filter.
 *
 * **Opt-out**, for the same reason as {@link isColumnSortable}: every value can
 * be stringified and matched, so `searchable: false` is how a column is kept
 * out of both.
 */
export function isColumnSearchable(col: Column): boolean {
  const dataCol = asDataColumn(col);
  return dataCol !== null && dataCol.searchable !== false;
}

/**
 * Whether a column may be grouped by — from its header menu and from the filter
 * bar's grouping tool.
 *
 * **Opt-in, with `sortable` as the fallback**, and that asymmetry against the
 * two predicates above is deliberate. Grouping a high-cardinality column
 * produces one group per row: an email or a free-text note is a perfectly good
 * thing to sort and search, and a useless thing to bucket by. So grouping is
 * not offered to every column that happens to hold a value.
 *
 * `sortable: true` is the fallback because a consumer who marked a column
 * sortable has said it is a dimension worth organising the table by, which is
 * the same claim grouping needs. `groupable` set either way wins outright.
 *
 * The virtualized-table refusal is NOT here: it is a property of the table, not
 * of the column, and it lives at the one call site that renders an affordance
 * (`HeaderMenu`) plus the read gate behind `state.effectiveGroupBy`.
 */
export function isColumnGroupable(col: Column): boolean {
  const dataCol = asDataColumn(col);
  if (dataCol === null) return false;
  if (dataCol.groupable !== undefined) return dataCol.groupable === true;
  return dataCol.sortable === true;
}

/**
 * Whether a column may be offered Sum / Avg / Min / Max / Count.
 *
 * **Opt-in, with `dataType: 'number'` as the fallback.** Four of the five
 * aggregations are arithmetic, so the column has to hold numbers, and the only
 * trustworthy statement about that is the consumer's own: `summable` first, the
 * declared `dataType` second. The numeric factories (`TableColumns.number`,
 * `TableColumns.currency`, …) set `dataType` for you, which also right-aligns
 * the column.
 *
 * It used to guess from the column's name — nine hardcoded English nouns by
 * regex, in three separate copies. That is the mistake the module header takes
 * as its lesson: a `price` column yielding `'$95'` was offered a sum that could
 * only render a dash, a numeric `throughput` was offered none, and a table
 * whose columns were named in German had no summaries at all.
 */
export function isColumnSummable(col: Column): boolean {
  const dataCol = asDataColumn(col);
  if (dataCol === null) return false;
  if (dataCol.summable !== undefined) return dataCol.summable === true;
  return dataCol.dataType === 'number';
}
