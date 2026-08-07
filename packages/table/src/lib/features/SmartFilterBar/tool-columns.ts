import type { Column } from '$lib/types/tableTypes';
import { findColumnById, humanizeColumnId, resolveColumnId, resolveColumnLabel } from '$lib/utils';
import { isColumnGroupable, isColumnSortable } from '$lib/utils/column-capabilities';

/**
 * Which columns each filter-bar tool may act on, as plain functions.
 *
 * Every tool exists twice over: as a `Select`/`Popover` beside the search field
 * on a wide bar, and as an overlay-free section inside the tools sheet on a
 * narrow one (see ToolsSheet). The two render completely differently — a
 * flat option list versus a radio group with a separate direction control — but
 * they must agree on *which columns are eligible at all*, and that agreement is
 * the part that silently rots when it lives twice.
 *
 * So the eligibility rules live here and the option/label shaping stays with
 * whoever renders it: an entry is `{ id, label }`, not `{ value, label }`, and
 * neither list carries the "none" row, which is presentation.
 */
export interface ToolColumnEntry {
  /** Resolved column id — what the store's setters take. */
  id: string;
  /** Human name, already resolved through `menuTitle` / `title` / the id. */
  label: string;
}

function toEntry(column: Column): ToolColumnEntry {
  return { id: resolveColumnId(column), label: resolveColumnLabel(column) };
}

/**
 * Columns the sort tool offers. Sorting is otherwise only reachable by clicking
 * a column header, which the mobile card layout has no equivalent of.
 *
 * The rule itself is {@link isColumnSortable}, shared with the header click and
 * the header menu, so the three cannot answer differently.
 */
export function selectSortableColumns(columns: Column[]): Column[] {
  return columns.filter(isColumnSortable);
}

/** {@link selectSortableColumns} as `{ id, label }` rows. */
export function buildSortEntries(columns: Column[]): ToolColumnEntry[] {
  return selectSortableColumns(columns).map(toEntry);
}

/**
 * Columns the grouping tool offers.
 *
 * The rule is {@link isColumnGroupable}, shared with the column's header menu.
 * It was a second copy here until it turned out the two had drifted apart: this
 * list required `groupable: true` or `sortable: true` while the header menu
 * accepted anything that was not `groupable: false`, so an unflagged column was
 * groupable from one surface and not from the other.
 */
export function selectGroupableColumns(columns: Column[]): Column[] {
  return columns.filter(isColumnGroupable);
}

/**
 * The grouping tool's rows, including the two keys that are legitimately absent
 * from {@link selectGroupableColumns}.
 *
 * Grouping is a superset of the column list: `view.groupBy` / `setGroupBy`
 * accept any item field, so a table can group by something it shows no column
 * for — the landing journey groups bookings by `day` while displaying no Day
 * column, because the day belongs in the group header and would be redundant in
 * every row. Two keys can therefore be missing, and they need different
 * treatment:
 *
 * - the **declared** key (`view.defaults.groupBy`): the consumer asked for this
 *   grouping, so it belongs in the list permanently — including after the user
 *   ungroups, which is the whole point. Deriving it from the *active* key
 *   instead would make the row vanish on ungroup, i.e. leave the reported
 *   symptom ("no way back to it") exactly as it was.
 * - the **active** key, when it is neither listed nor declared — reachable
 *   through a programmatic `setGroupBy`, or through a column the header menu
 *   offers but this list filters out. Without it the Select holds a value it
 *   cannot display and DEV-logs `value "…" has no matching option`.
 *
 * Labels of the fallback keys go through `humanizeColumnId`, the same helper the
 * rest of the package uses, so the row reads "Day" rather than the raw field
 * name — and matches the grouping chip, which resolves its label the same way.
 */
export function buildGroupingEntries(
  columns: Column[],
  declaredGroupByKey: string | null | undefined,
  activeGroupByKey: string | null | undefined
): ToolColumnEntry[] {
  const entries = selectGroupableColumns(columns).map(toEntry);

  for (const key of [declaredGroupByKey, activeGroupByKey]) {
    if (!key || entries.some((entry) => entry.id === key)) continue;
    const column = findColumnById(columns, key);
    entries.push({
      id: key,
      label: column ? resolveColumnLabel(column) : humanizeColumnId(key)
    });
  }

  return entries;
}

/**
 * Columns the visibility tool may toggle.
 *
 * `hideable: false` pins a column: it is excluded so it can never be hidden —
 * and so it is not silently hidden the first time the selection changes, which
 * is what happens when a multi-select reads an unlisted column as "deselected".
 */
export function selectHideableColumns(allColumns: Column[]): Column[] {
  return allColumns.filter((col) => col.hideable !== false);
}

/** {@link selectHideableColumns} as `{ id, label }` rows. */
export function buildColumnVisibilityEntries(allColumns: Column[]): ToolColumnEntry[] {
  return selectHideableColumns(allColumns).map(toEntry);
}
