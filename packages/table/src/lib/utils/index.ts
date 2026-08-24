import { createPersistentState, type PersistenceKeyConfig } from '@urbicon-ui/blocks';
import type { SummaryConfig } from '$lib/stores/TableStore.svelte';
import type { Column, TableItem } from '$lib/types/tableTypes';
import { isSummaryType } from './summary-types.js';

/**
 * Retrieves a nested value from an object using dot notation
 * e.g. getNestedValue(user, 'address.city')
 */
export function getNestedValue(item: unknown, key: string): unknown {
  if (!item || !key) return undefined;

  const keys = key.split('.');
  let value: unknown = item;

  for (const k of keys) {
    if (value === undefined || value === null) return undefined;
    value = (value as Record<string, unknown>)[k];
  }

  return value;
}

/**
 * Resolves the stable identifier of a column. Mirrors the discriminated
 * union shape from `tableTypes.ts`:
 *
 * - string accessor → defaults to `accessor` if `id` is omitted
 * - function accessor → `id` is required
 * - synthetic column → `id` is required
 *
 * Throws when neither `id` nor a string `accessor` is present — this
 * combination can only occur when a caller bypasses the type system, and
 * returning a sentinel (e.g. empty string) would silently corrupt the
 * filter/sort/group/visibility state that targets columns by id.
 */
export function resolveColumnId<T>(column: Column<T>): string {
  if (column.id !== undefined && column.id !== '') return column.id;
  // DataColumnString fallback: id defaults to the accessor string.
  if (typeof column.accessor === 'string' && column.accessor !== '') return column.accessor;
  throw new Error(
    'Column has no resolvable id. Provide `id` for function-accessor or synthetic columns, or a non-empty string `accessor`.'
  );
}

/**
 * Resolves the human-readable label of a column for use in table chrome
 * (column-visibility menu, header menu, filter/grouping/summary menus).
 *
 * Resolution order: `menuTitle` → `title` → humanized column id. The last
 * step guarantees a non-empty label even for icon-only columns
 * (`{ id: 'actions', title: '' }` → "Actions") so menu entries never render
 * blank. Header cells render `title` verbatim on purpose — an empty header
 * is a deliberate design choice, an empty menu entry is not.
 */
export function resolveColumnLabel<T>(column: Column<T>): string {
  return column.menuTitle || column.title || humanizeColumnId(resolveColumnId(column));
}

/**
 * Turns a column id into a readable Title-Case label: splits camelCase,
 * kebab-case, snake_case and dot-paths into words and capitalizes each
 * (`quickActions` / `quick-actions` / `quick_actions` → "Quick Actions").
 */
export function humanizeColumnId(id: string): string {
  return id
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves the canonical value of a cell — the single source of truth that
 * search, sort, group, summary and the default cell renderer all read from.
 * Display via `cell`/`component`/`formatter` is decoupled and may transform
 * this value further for rendering, but the derived operations always
 * operate on the accessor's output.
 *
 * - string accessor → property lookup (dot-paths supported via `getNestedValue`)
 * - function accessor → invoke with the item
 * - synthetic column (no accessor) → `undefined`
 */
export function resolveColumnValue<T>(column: Column<T>, item: T): unknown {
  if (typeof column.accessor === 'function') {
    return column.accessor(item);
  }
  if (typeof column.accessor === 'string') {
    return getNestedValue(item, column.accessor);
  }
  return undefined;
}

/**
 * Looks up a column from the table's column list by its resolved id.
 * Returns `undefined` when no column matches — used by concerns that
 * keep only the id in their state (filters, sort, group, summary).
 */
export function findColumnById<T>(
  columns: ReadonlyArray<Column<T>>,
  id: string
): Column<T> | undefined {
  return columns.find((col) => resolveColumnId(col) === id);
}

/**
 * The human name of a column *id* — what every tool surface needs, since
 * filters, sort, grouping and summaries keep only the id.
 *
 * Falls back to humanising the id (`humanizeColumnId`, which stays internal)
 * when no column matches, and that is a
 * real state rather than an error: grouping accepts any item field, and
 * persisted state can name a column the definition has since dropped. Passing
 * the raw id through was the older answer, and it made one key read "day" on a
 * chip and "Day" in the menu row one line above it.
 *
 * Hand it the *declared* column list (`state.allColumns`), never the visible
 * subset — otherwise hiding a column degrades every label that names it (#253).
 */
export function resolveColumnLabelById<T>(columns: ReadonlyArray<Column<T>>, id: string): string {
  const column = findColumnById(columns, id);
  return column ? resolveColumnLabel(column) : humanizeColumnId(id);
}

/**
 * Resolves a column's value by its id, falling back to a raw nested-key
 * lookup when no matching column is registered. The fallback preserves the
 * pre-2.0 behaviour for transient state (e.g. persisted filters that
 * reference a column which has since been removed from the definition).
 */
export function resolveValueById<T extends TableItem>(
  columns: ReadonlyArray<Column<T>>,
  item: T,
  id: string
): unknown {
  const column = findColumnById(columns, id);
  if (column) return resolveColumnValue(column, item);
  return getNestedValue(item, id);
}

/**
 * Formats a cell value based on the column definition. The displayed value
 * starts from the accessor's output — `formatter` then has a chance to
 * transform it into a presentation string.
 *
 * `locale` is a BCP 47 tag the caller has already resolved (see
 * `resolveDateLocale` in `@urbicon-ui/i18n`). It is required for the `Date`
 * branch and has no other use: `undefined` there hands `Intl` the **runtime**
 * locale, so an app that declares `en` renders `12.3.2026` for a German
 * user's browser and `3/12/2026` for an American one — the date follows the
 * reader's machine instead of the app's language.
 *
 * Not an SSR-divergence on this path, which an earlier version of this comment
 * claimed: `<TableProvider>` syncs `items` into the store from an `$effect`,
 * and effects do not run during SSR, so a server render emits "No data
 * available" and no cell payload at all. Measured 2026-08-02. The client-side
 * half above is the whole bug here, and it is enough — this is the DEFAULT
 * path for a plain `Date` column, while `DateCell` is opt-in.
 */
export function formatCellValue<T extends TableItem>(
  item: T,
  column: Column<T>,
  locale: string
): string {
  const value = resolveColumnValue(column, item);

  // Use custom formatter when available
  if (column.formatter) {
    // The discriminated union narrows `formatter`'s value parameter to
    // either `unknown` (string accessor / synthetic) or the function's
    // return type V. Cast through `never` to bridge that to a callable
    // signature without losing the runtime narrowing above.
    const formatted = (column.formatter as (v: unknown, item: T) => string | null)(value, item);
    if (formatted !== null) return formatted;
  }

  // Default formatting based on data type
  if (value === undefined || value === null) return '';

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'Invalid Date';
    return value.toLocaleDateString(locale);
  }

  return String(value);
}

/**
 * Normalizes items for table consumption. Items without a usable `id` — any
 * value that is not a string or number, `null` included — get an `__index`
 * assigned as stable fallback key. The guard must match what
 * {@link resolveRowItemId} accepts, or an unusable `id` slips through
 * unstamped and every such row resolves to the same `-1` — a duplicate
 * `{#each}` key, which throws.
 */
export function normalizeItems<T extends TableItem>(items: T[]): T[] {
  return items.map((item, i) =>
    typeof item.id === 'string' || typeof item.id === 'number'
      ? item
      : ({ ...item, __index: i } as T)
  );
}

/**
 * Resolves the identity a row is keyed, selected, expanded and activated by:
 * `id` when the item carries one, else the list-wide `__index` stamped by
 * {@link normalizeItems}. `-1` only for items that never passed normalization
 * — every store-owned list does.
 */
export function resolveRowItemId(item: TableItem): string | number {
  const candidate = item.id ?? item.__index;
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : -1;
}

/**
 * Computes aggregate summary values for a set of items given summary configs.
 * Extracted from the store for testability.
 *
 * The optional `getValue` resolver lets callers supply a column-aware lookup
 * (typically `(item, id) => resolveValueById(state.columns, item, id)`) so
 * that summary aggregations honour function accessors and computed values.
 * When omitted, the legacy `getNestedValue` fallback is used — sufficient
 * for primitive property keys and required by the standalone unit tests.
 */
export function calculateSummary(
  items: TableItem[],
  configs: Array<{ column: string; type: 'sum' | 'avg' | 'count' | 'min' | 'max' }>,
  getValue: (item: TableItem, columnId: string) => unknown = (item, columnId) =>
    getNestedValue(item, columnId)
): Record<string, number> {
  const result: Record<string, number> = {};

  configs.forEach((config) => {
    const values = items
      .map((item) => getValue(item, config.column))
      .filter((value) => {
        if (value === undefined || value === null || value === '') return false;
        if (['sum', 'avg', 'min', 'max'].includes(config.type)) {
          return !Number.isNaN(Number(value));
        }
        return true;
      });

    if (config.type === 'count') {
      result[config.column] = values.length;
    } else if (values.length === 0) {
      // A dash in the summary row means two very different things: "no rows"
      // and "not one row held a number". The second one is a data-shape bug —
      // usually a display string in the data (`'$95'`) where the accessor is
      // contracted to yield the value that sort, group and summary operate on.
      // Silently showing the same dash for both hides it; say so once.
      if (import.meta.env?.DEV && items.length > 0) {
        const sample = JSON.stringify(getValue(items[0], config.column));
        console.warn(
          `[Table] Summary "${config.type}" on column "${config.column}": no numeric values ` +
            `among ${items.length} row(s) (first value: ${sample}). The accessor must yield ` +
            `numbers — keep units in \`column.formatter\`, which formats the total too.`
        );
      }
      result[config.column] = NaN;
    } else {
      switch (config.type) {
        case 'sum':
          result[config.column] = values.reduce<number>((s, val) => s + Number(val ?? 0), 0);
          break;
        case 'avg': {
          const total = values.reduce<number>((s, val) => s + Number(val ?? 0), 0);
          result[config.column] = total / values.length;
          break;
        }
        case 'min':
          result[config.column] = Math.min(...values.map((v) => Number(v)));
          break;
        case 'max':
          result[config.column] = Math.max(...values.map((v) => Number(v)));
          break;
        default:
          result[config.column] = NaN;
      }
    }
  });

  return result;
}

/**
 * Collapses summary configs to the store invariant: at most one aggregation
 * per column (#92). Later entries win — the same rule `addSummaryConfig` has
 * always applied when a column is re-aggregated — while a column keeps the
 * position of its first occurrence, so a replace never reshuffles the row.
 * Every writer of `state.summaryConfigs` funnels through this: the summary
 * concern's setters, the `prefs.defaults.summaries` seed, and hydration from
 * storage (where an older version may have persisted duplicates). Readers
 * (`find` by column, `calculateSummary`'s per-column result keys) assume the
 * deduped shape.
 */
export function normalizeSummaryConfigs(configs: SummaryConfig[]): SummaryConfig[] {
  const byColumn = new Map<string, SummaryConfig>();
  for (const config of dropInvalidSummaryConfigs(configs)) byColumn.set(config.column, config);
  return [...byColumn.values()];
}

/**
 * Element guard for one summary config that arrived from OUTSIDE the type
 * system — storage JSON, a parsed compound string, an untyped consumer.
 * Membership in the aggregation vocabulary is checked, not just
 * `typeof type === 'string'`: a stored `'median'` used to pass the old
 * string check, hydrate, and crash the whole table at mount when the chip
 * looked its translation key up (#251).
 */
export function isSummaryConfigShape(value: unknown): value is SummaryConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<SummaryConfig>;
  return (
    typeof config.column === 'string' &&
    isSummaryType(config.type) &&
    // Storage JSON cannot hold a function, so a present `formatter` from
    // outside is always foreign — calling it would crash the render (#251).
    (config.formatter === undefined || typeof config.formatter === 'function')
  );
}

/**
 * The one read-tolerant entrance for summary configs: elements that fail
 * {@link isSummaryConfigShape} are dropped — with a DEV warning, never
 * silently in dev — and the valid rest keeps the table usable. Used directly
 * by prefs hydration (the unknown[] → SummaryConfig[] bridge) and by
 * {@link normalizeSummaryConfigs}, which every funnel path goes through —
 * hydration, the setter/adder, the defaults seed. Assigning
 * `state.summaryConfigs` directly still bypasses it, as it bypasses every
 * store invariant.
 */
export function dropInvalidSummaryConfigs(values: readonly unknown[]): SummaryConfig[] {
  const valid: SummaryConfig[] = [];
  for (const value of values) {
    if (isSummaryConfigShape(value)) {
      valid.push(value);
    } else if (import.meta.env?.DEV) {
      console.warn('[Table] Dropped summary config with unknown shape or aggregation type:', value);
    }
  }
  return valid;
}

/**
 * Segment of text with a flag indicating whether it matched the search term.
 */
export interface TextSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Splits text into segments based on a search term, marking matching parts as highlighted.
 * Used by SearchHighlight to render matches without {@html} (XSS-safe).
 */
export function splitSearchSegments(text: string, searchTerm: string): TextSegment[] {
  if (!searchTerm || !text) return [{ text, highlighted: false }];

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter((part) => part !== '')
    .map((part) => ({
      text: part,
      highlighted: part.toLowerCase() === searchTerm.toLowerCase()
    }));
}

// The four view axes that used to be persisted per key here — filters, search,
// group-by and sort — moved to `bindViewToStorage`, which writes one entry for
// the whole view (`urbicon_table_view_<key>_v1`) instead of one per axis. Their
// v7 factories are gone with the v8 cut; the keys they wrote are orphaned and
// listed as such in docs/MIGRATION-V8.md. What stays here is the prefs channel:
// summaries, hidden columns, column order, selection — same keys as v7, so a
// reader's preferences survive the upgrade.
export function createPersistentSummaryConfigs(config: PersistenceKeyConfig) {
  return createPersistentState({
    key: `table_summary_configs_${config.tableId}`,
    defaultValue: [] as SummaryConfig[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentHiddenColumns(config: PersistenceKeyConfig) {
  return createPersistentState({
    key: `table_hidden_columns_${config.tableId}`,
    defaultValue: [] as string[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentColumnOrder(config: PersistenceKeyConfig) {
  return createPersistentState({
    key: `table_column_order_${config.tableId}`,
    defaultValue: [] as string[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentSelection(config: PersistenceKeyConfig) {
  return createPersistentState({
    // Row ids may be strings or numbers; JSON round-trips both faithfully.
    key: `table_selection_${config.tableId}`,
    defaultValue: [] as Array<string | number>,
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

// Sticky-pinning measurement helpers
export { measureToCssVar, measureViewportOffsetTop, observeStuck } from './sticky-measure';
