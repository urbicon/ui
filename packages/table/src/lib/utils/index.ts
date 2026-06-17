import { createPersistentState, type FilterPersistenceConfig } from '@urbicon-ui/blocks';
import type { SummaryConfig } from '$lib/stores/TableStore.svelte';
import type { Column, Filter, TableItem } from '$lib/types/tableTypes';

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
function humanizeColumnId(id: string): string {
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
 */
export function formatCellValue<T extends TableItem>(item: T, column: Column<T>): string {
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
    return value.toLocaleDateString();
  }

  return String(value);
}

/**
 * Groups items by a column-id, routing the lookup through {@link resolveValueById}
 * so that function-accessor columns aggregate the computed value (not the
 * non-existent property of the same name). Returns `{ ungrouped: items }`
 * when no group id is provided.
 */
export function groupItems<T extends TableItem>(
  items: T[],
  columns: ReadonlyArray<Column<T>>,
  groupByKey: string | null
): Record<string, T[]> {
  if (!groupByKey) return { ungrouped: items };

  const grouped: Record<string, T[]> = {};

  for (const item of items) {
    const groupValue = resolveValueById(columns, item, groupByKey);
    const groupKey =
      groupValue !== undefined && groupValue !== null ? String(groupValue) : 'Unassigned';

    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }

    grouped[groupKey].push(item);
  }

  return grouped;
}

/**
 * Normalizes items for table consumption. Items without an `id` property
 * get an `__index` assigned as stable fallback key.
 */
export function normalizeItems<T extends TableItem>(items: T[]): T[] {
  return items.map((item, i) => (item.id !== undefined ? item : ({ ...item, __index: i } as T)));
}

/**
 * Resolves the ID of an item
 */
export function getItemId(item: TableItem | null | undefined): number | string {
  if (!item) return -1;

  if (item.id !== undefined) return item.id as number | string;
  if (item.ID !== undefined) return item.ID as number | string;
  if (item._id !== undefined) return item._id as number | string;

  return -1;
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
 * Tests whether a single item value matches a filter condition.
 */
export function matchesFilter(itemValue: string, filterValue: string, operator: string): boolean {
  const value = itemValue.toLowerCase();
  const filter = filterValue.toLowerCase();

  switch (operator) {
    case 'contains':
      return value.includes(filter);
    case 'equals':
      return value === filter;
    case 'startsWith':
      return value.startsWith(filter);
    case 'endsWith':
      return value.endsWith(filter);
    case 'greaterThan':
      return Number(value) > Number(filter);
    case 'lessThan':
      return Number(value) < Number(filter);
    default:
      if (import.meta.env?.DEV)
        console.warn(`[Table] Unknown filter operator "${operator}" — row excluded.`);
      return false;
  }
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

export function createPersistentFilters(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_filters_${config.tableId}`,
    defaultValue: [] as Filter[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

/**
 * Specialized hook for search term persistence
 */
export function createPersistentSearchTerm(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_search_${config.tableId}`,
    defaultValue: '',
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentGroupByKey(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_group_by_${config.tableId}`,
    defaultValue: null as string | null,
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentSummaryConfigs(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_summary_configs_${config.tableId}`,
    defaultValue: [] as SummaryConfig[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

/**
 * Sort state shape persisted across reloads. `column === ''` represents
 * "no active sort" — `useSorting.handleSort` clears the column on the
 * third click.
 */
export interface PersistedSortState {
  column: string;
  direction: 'asc' | 'desc';
}

export function createPersistentSortState(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_sort_${config.tableId}`,
    defaultValue: { column: '', direction: 'asc' } as PersistedSortState,
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentHiddenColumns(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_hidden_columns_${config.tableId}`,
    defaultValue: [] as string[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

export function createPersistentColumnOrder(config: FilterPersistenceConfig) {
  return createPersistentState({
    key: `table_column_order_${config.tableId}`,
    defaultValue: [] as string[],
    storage: config.storage || 'localStorage',
    debounceMs: config.debounceMs || 500
  });
}

// Sticky-pinning measurement helpers
export { measureToCssVar, measureViewportOffsetTop, observeStuck } from './sticky-measure';
