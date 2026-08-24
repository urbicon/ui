import type { DeepKeys } from '@urbicon-ui/i18n';
import type { TableState } from '$lib/stores/concerns/types';
import type enTranslations from '$lib/translations/en';
import type { Column } from '$lib/types/tableTypes';
import {
  findColumnById,
  resolveColumnId,
  resolveColumnLabel,
  resolveColumnLabelById
} from '$lib/utils';
import {
  isColumnGroupable,
  isColumnSearchable,
  isColumnSortable,
  isColumnSummable
} from '$lib/utils/column-capabilities';

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
 *
 * The same argument covers what a tool says when the answer is *no columns at
 * all* — see {@link toolEmptyKey} at the foot of this module, which is that
 * decision made once instead of five times (#254).
 *
 * ## The two column lists (#253)
 *
 * Every builder takes a {@link ToolColumnScope} rather than one array, because
 * the two questions a tool asks have different answers:
 *
 * - **What may I offer?** The *visible* columns. A tool offers what the reader
 *   can see; an aggregation on a hidden column has no cell to render in, and a
 *   filter form for a column that is not on screen is an invitation to nothing.
 * - **What is running?** Anything, visible or not. A tool value survives its
 *   column being hidden — that is the preference philosophy the whole table
 *   follows — so a key that is *active* and unlisted gets a fallback row, and
 *   its label resolves over the *declared* set so it keeps reading "Location"
 *   rather than degrading to the raw `city`.
 *
 * "No cell to render in" is a statement about the desktop **grid**, where a
 * summary cell sits under its column and a hidden column takes that place with
 * it. The mobile layout's summary band is a *list* of label/value rows, so it
 * has a place for an aggregation whose column is not on screen and keeps
 * showing it — with the label resolved over the declared set, like every other
 * ambient surface. The offer narrows with visibility; what is *in force* is
 * shown wherever the geometry allows.
 *
 * Grouping had this shape first, for a different reason (a group key need not
 * be a column at all), and the other three axes were left holding a value they
 * could neither display nor edit.
 */
export interface ToolColumnEntry {
  /** Resolved column id — what the store's setters take. */
  id: string;
  /** Human name, already resolved through `menuTitle` / `title` / the id. */
  label: string;
}

/**
 * The two column lists a tool surface has to tell apart — see the module note.
 *
 * Both come off the store: `visible` is `state.columns`, `declared` is
 * `state.allColumns`. They are equal until something is hidden.
 */
export interface ToolColumnScope {
  /** What the reader can see — the tool's offer. */
  visible: Column[];
  /** Everything the table declared, hidden included — where a label resolves. */
  declared: Column[];
}

/**
 * The scope a tool reads off the store — the one place the two state members
 * are paired, so no surface can take `state.columns` for both roles by
 * accident. Call it inside a `$derived`; both reads stay tracked.
 */
export function toolColumnScope(
  state: Pick<TableState, 'columns' | 'allColumns'>
): ToolColumnScope {
  return { visible: state.columns, declared: state.allColumns };
}

function toEntry(column: Column): ToolColumnEntry {
  return { id: resolveColumnId(column), label: resolveColumnLabel(column) };
}

/**
 * The shared body of all four axis builders: the eligible visible columns,
 * then one fallback row per `keptKey` that is not already among them.
 *
 * One function rather than four copies because the axes differ in exactly two
 * values — which columns are eligible, and which keys must survive not being
 * eligible — and everything else about the shape (dedup, label resolution,
 * order: listed first, fallbacks appended) has to be identical or the two
 * geometries of a tool start disagreeing again.
 *
 * `keptKeys` is an iterable of maybe-keys so callers can pass a tool's state
 * straight in (`view.sort?.column`, `declaredGroupByKey`, a config list's
 * column ids) without filtering it first.
 */
function buildToolEntries(
  scope: ToolColumnScope,
  isEligible: (column: Column) => boolean,
  keptKeys: Iterable<string | null | undefined>
): ToolColumnEntry[] {
  const entries = scope.visible.filter(isEligible).map(toEntry);

  for (const key of keptKeys) {
    if (!key || entries.some((entry) => entry.id === key)) continue;
    entries.push({ id: key, label: resolveColumnLabelById(scope.declared, key) });
  }

  return entries;
}

/**
 * The sort tool's rows — the sortable visible columns, plus the active sort
 * column when that is no longer among them.
 *
 * The eligibility rule is {@link isColumnSortable}, shared with the header
 * click and the header menu, so the three cannot answer differently. Sorting is
 * otherwise only reachable by clicking a column header, which the mobile card
 * layout has no equivalent of.
 *
 * Without the fallback, hiding the sorted column left the wide bar's `Select`
 * holding a value with no option (DEV-logged `value "…" has no matching
 * option`) and the sheet's radio group with *nothing* checked — not even "No
 * sorting" — while the grid stayed sorted and the direction segments stayed
 * enabled. Three surfaces disagreeing about one axis.
 */
export function buildSortEntries(
  scope: ToolColumnScope,
  activeSortKey: string | null | undefined
): ToolColumnEntry[] {
  return buildToolEntries(scope, isColumnSortable, [activeSortKey]);
}

/** A filter section, and how much of one it may be. */
export interface FilterToolEntry extends ToolColumnEntry {
  /**
   * Whether this section may carry the **add** form — the operator select, the
   * value field and the quick-value list — as opposed to only the rows that are
   * already running plus their remove buttons.
   *
   * `true` requires the key to name a column the consumer **declared** and that
   * {@link isColumnSearchable} accepts. That is one condition short of the
   * offer above: a declared, filterable column keeps its full form while merely
   * *hidden*, which is the whole point of the fallback row.
   *
   * The two `false` cases are the ones a full editor would misrepresent:
   *
   * - the key names **no declared column** — a filter restored from prefs or a
   *   URL for a column that v2 removed. The form would offer operators derived
   *   from a `dataType` nobody declared, and the quick-value list would
   *   enumerate up to twenty distinct values of a field the table knows
   *   nothing about.
   * - the column declared `searchable: false` — an explicit opt-out. Honouring
   *   it everywhere except in the one section that appears *because* a filter
   *   slipped past it would make the flag mean nothing.
   *
   * Both still show their running filters and the × that removes them: a filter
   * you cannot get rid of is the defect this whole builder exists for.
   */
  editable: boolean;
}

/**
 * The filter tool's sections — one per filterable column, plus one per column
 * that carries a running filter and is not among them.
 *
 * The fallback section is what makes an active filter reachable again: the chip
 * could only remove it, and the panel used to render no section at all for a
 * hidden column, so the trigger's badge counted a filter with nowhere to go.
 * How much of a section each one gets is {@link FilterToolEntry.editable}.
 *
 * Duplicates are collapsed by {@link buildToolEntries}, which matters here more
 * than elsewhere: a column can carry several filters at once.
 */
export function buildFilterEntries(
  scope: ToolColumnScope,
  activeFilterKeys: Iterable<string>
): FilterToolEntry[] {
  return buildToolEntries(scope, isColumnSearchable, activeFilterKeys).map((entry) => {
    const column = findColumnById(scope.declared, entry.id);
    return { ...entry, editable: !!column && isColumnSearchable(column) };
  });
}

/**
 * The grouping tool's rows, including the two keys that are legitimately absent
 * from the groupable columns.
 *
 * The eligibility rule is {@link isColumnGroupable}, shared with the column's
 * header menu. It was a second copy here until it turned out the two had
 * drifted apart: this list required `groupable: true` or `sortable: true` while
 * the header menu accepted anything that was not `groupable: false`, so an
 * unflagged column was groupable from one surface and not from the other.
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
 *   through a programmatic `setGroupBy`, through a column the header menu
 *   offers but this list filters out, or by hiding the column being grouped by.
 *   Without it the Select holds a value it cannot display and DEV-logs
 *   `value "…" has no matching option`.
 *
 * Labels of the fallback keys resolve over the *declared* columns and fall back
 * to `humanizeColumnId`, so the row reads "Day" for a key that is no column at
 * all and keeps reading "Location" for one that is merely hidden — and matches
 * the grouping chip, which resolves its label through the same helper.
 */
export function buildGroupingEntries(
  scope: ToolColumnScope,
  declaredGroupByKey: string | null | undefined,
  activeGroupByKey: string | null | undefined
): ToolColumnEntry[] {
  return buildToolEntries(scope, isColumnGroupable, [declaredGroupByKey, activeGroupByKey]);
}

/**
 * The summary tool's rows — one per summable column, plus one per column that
 * is *configured* to aggregate and is no longer summable-and-visible.
 *
 * The keys to pass are `state.summaryConfigs`, the raw configuration, not
 * `state.effectiveSummaryConfigs`: these lists belong to the editing control,
 * and what a column is configured to aggregate outlives both the summary row
 * being toggled off (#252) and the column being hidden. The ambient surfaces —
 * chips, badges, the summary row itself — keep reading the effective list.
 */
export function buildSummaryEntries(
  scope: ToolColumnScope,
  configuredKeys: Iterable<string>
): ToolColumnEntry[] {
  return buildToolEntries(scope, isColumnSummable, configuredKeys);
}

/**
 * Columns the visibility tool may toggle.
 *
 * `hideable: false` pins a column: it is excluded so it can never be hidden —
 * and so it is not silently hidden the first time the selection changes, which
 * is what happens when a multi-select reads an unlisted column as "deselected".
 *
 * The one builder that takes a bare list rather than a {@link ToolColumnScope}:
 * its offer *is* the declared set, since a hidden column is precisely what this
 * tool exists to bring back.
 */
export function selectHideableColumns(allColumns: Column[]): Column[] {
  return allColumns.filter((col) => col.hideable !== false);
}

/** {@link selectHideableColumns} as `{ id, label }` rows. */
export function buildColumnVisibilityEntries(allColumns: Column[]): ToolColumnEntry[] {
  return selectHideableColumns(allColumns).map(toEntry);
}

// ── The empty-state policy (#254) ───────────────────────────────────────────
//
// The builders above answer "what may this tool act on". What a tool does when
// that answer is *nothing* was decided five separate times, and came out five
// different ways: sort and summary disabled their trigger with nothing to say,
// the visibility and summary sheet panels carried an explanation their bar
// counterparts did not, and three axes said nothing at all — the eye opened a
// listbox with zero options, the filter popover was a heading over an Apply
// button, and grouping offered an enabled dropdown whose entire content was
// "No grouping".
//
// So the decision moves next to the rules it depends on: `toolEmptyKey` is
// asked, never re-derived. No surface writes `entries.length === 0` again, and
// none picks its own sentence.

/** The five tool axes of the filter bar — one list builder above per axis. */
export type ToolAxis = 'filter' | 'sort' | 'grouping' | 'summary' | 'columns';

/**
 * What each axis says when it has nothing to offer — one key per axis, spoken
 * by both geometries.
 *
 * That single key across surfaces is the same construction `SUMMARY_TYPES`
 * uses for the aggregation vocabulary, down to typing the keys against the
 * real bundle (`DeepKeys<typeof enTranslations>` is exactly what `useTableI18n`
 * accepts), so a key that stops existing is a compile error here rather than a
 * blank paragraph at render.
 */
const TOOL_EMPTY_KEY = {
  filter: 'filter.empty',
  sort: 'sort.empty',
  grouping: 'grouping.empty',
  summary: 'summary.empty',
  columns: 'columns.empty'
} as const satisfies Record<ToolAxis, DeepKeys<typeof enTranslations>>;

/** The sentence keys {@link toolEmptyKey} may return — a `tt()` argument. */
export type ToolEmptyKey = (typeof TOOL_EMPTY_KEY)[ToolAxis];

/**
 * Whether a tool has nothing to offer, and what it says about it: the axis's
 * translation key, or `null` while the tool has rows.
 *
 * **Empty means empty of rows, not empty of eligible columns.** The builders
 * append a fallback row for whatever is *in force* (#253/#265), so a table
 * where every column declared `searchable: false` still hands the filter tool a
 * section for a filter that is running — and a tool that can still act on
 * something must stay operable. Deriving this from the capability predicates
 * instead would disable the one surface that can remove that filter.
 *
 * How the answer is rendered is the surfaces' half, and it is two shapes for
 * one decision: the wide bar disables the trigger and carries the sentence as
 * its `title` plus its accessible name (see MenuTrigger's `unavailable`), the
 * sheet keeps the section and puts the sentence inside it (see ToolEmptyNote).
 * The sheet section stays because a sheet whose sections come and go with the
 * column definition moves the other four under the reader's thumb.
 */
export function toolEmptyKey(
  axis: ToolAxis,
  entries: readonly ToolColumnEntry[]
): ToolEmptyKey | null {
  return entries.length === 0 ? TOOL_EMPTY_KEY[axis] : null;
}
