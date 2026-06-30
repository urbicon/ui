import type { Component, Snippet } from 'svelte';
import type { TableProps } from '../core/table';

/**
 * A table data item. Table items are arbitrary records — the Table component
 * accesses values dynamically via a column's accessor. Values are typed as
 * `unknown` to force explicit narrowing in formatters, cells, and components.
 */
export type TableItem = Record<string, unknown>;

/**
 * Primitive value classes that are safe to stringify, sort, group, and
 * summarise without losing information. Used to constrain string-accessor
 * keys so that the compiler rejects column definitions that would silently
 * fall into the `String({}) === '[object Object]'` trap.
 */
export type PrimitiveValue = string | number | bigint | boolean | Date | null | undefined;

/**
 * Keys of `T` whose value is a {@link PrimitiveValue}. Use as a constraint
 * for string-accessor columns to keep search/sort/group meaningful.
 *
 * If `T` is the unrestricted `TableItem` (i.e. `Record<string, unknown>`),
 * the result collapses to `never` — see {@link DataAccessor} for the
 * pragmatic fallback to plain `string` in that case.
 */
export type PrimitiveKeys<T> = {
  [K in keyof T]: T[K] extends PrimitiveValue ? K : never;
}[keyof T] &
  string;

/**
 * Resolves the allowed string-accessor type for `T`. For typed rows this is
 * the union of primitive-valued property names; for the default
 * `Record<string, unknown>` row type (where `PrimitiveKeys<T>` is `never`)
 * we widen back to `string` to keep the unconstrained call sites usable.
 */
export type DataAccessor<T> = [PrimitiveKeys<T>] extends [never] ? string : PrimitiveKeys<T>;

/**
 * Cell rendering priority (first match wins):
 * 1. Table-level `cell` snippet (full override for all columns)
 * 2. `column.cell` snippet (per-column snippet, defined in template)
 * 3. `column.component` (dynamic Svelte component)
 * 4. `column.formatter` (text transformation)
 * 5. Raw accessor value
 *
 * Whichever path renders the cell, the value that search, sort, group and
 * summary operate on is **always** the accessor's output. Display and
 * derived operations are decoupled by design.
 *
 * `value` in `formatter`/`cell`/`component` is intentionally typed as
 * `unknown` for all column shapes — the table cannot statically prove the
 * runtime shape of a function accessor's return type to every consumer of
 * the column type, and forcing the union-narrowing path on each render
 * would block legitimate cell sharing across columns of different shapes.
 * Consumers that want a concrete value type can narrow inside the snippet
 * or cast on the call boundary.
 */
interface BaseColumn<T> {
  /**
   * Display title of the column. May be empty (`''`) for icon-only columns
   * such as action columns — the header cell then stays blank by design.
   */
  title: string;
  /**
   * Label used wherever the column is referenced *by name* in table chrome
   * (column-visibility menu, header menu, filter/grouping/summary menus).
   * Falls back to {@link title}; when that is empty too, a humanized form
   * of the column id is used (`quickActions` → "Quick Actions"). Set this
   * on icon-only columns to give them a proper (localized) menu name, e.g.
   * `{ id: 'actions', title: '', menuTitle: 'Aktionen' }`.
   */
  menuTitle?: string;
  /** Optional column width (CSS value) */
  width?: string;
  /** Minimum column width (CSS value) */
  minWidth?: string;
  /** Column flexibility */
  flex?: boolean;
  /**
   * Responsive priority — controls how the column appears in the **mobile card**
   * layout. The desktop table always shows every column.
   * - `1` (or unset): primary — the first such column becomes the card title,
   *   any others render as prominent fields.
   * - `2`: secondary — rendered as a normal detail field.
   * - `3`: desktop-only — omitted from the mobile card (kept in the desktop table).
   */
  priority?: 1 | 2 | 3;
  /** Text alignment within the column */
  align?: 'left' | 'center' | 'right';
  /** Custom formatter for cell values (only when no component/cell is set) */
  formatter?: (value: unknown, item: T) => string | null;
  /**
   * Per-column snippet for custom cell rendering. Define in the template area of your
   * `.svelte` file and reference here. Receives the row item and the resolved cell value.
   *
   * For non-trivial cells, or when `eslint-plugin-svelte` chokes on snippet type
   * annotations such as `{#snippet name(item: T, _value: unknown)}`, prefer
   * `component` + `componentProps` — they keep typing intact without depending
   * on the plugin's snippet-arg parser.
   *
   * @example
   * ```svelte
   * {#snippet statusCell(item, value)}
   *   <Badge intent={value === 'active' ? 'success' : 'danger'}>{value}</Badge>
   * {/snippet}
   *
   * <Table items={data} columns={[
   *   { accessor: 'status', title: 'Status', cell: statusCell }
   * ]} />
   * ```
   */
  cell?: Snippet<[item: T, value: unknown]>;
  /** Custom Svelte component for rendering this column's cells (rendered dynamically) */
  component?: Component<{ item: T; [key: string]: unknown }>;
  /** Props factory for the custom component (item is always passed automatically) */
  componentProps?: (item: T) => Record<string, unknown>;
}

/**
 * Mixin for derived-operation flags (search/sort/group/sum). Only data
 * columns (string or function accessor) can be derived — synthetic columns
 * structurally exclude these flags so callers cannot, for instance, request
 * grouping by an actions column.
 */
interface DerivableMixin {
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether this column is searchable */
  searchable?: boolean;
  /** Whether this column is groupable (auto-detected if undefined) */
  groupable?: boolean;
  /** Whether this column is summable (auto-detected from data type if undefined) */
  summable?: boolean;
  /** Column data type for smart detection */
  dataType?: 'text' | 'number' | 'date' | 'boolean' | 'email' | 'url';
}

/**
 * Data column with a string accessor that names a primitive-valued property
 * on `T`. The accessor doubles as the default identifier — pass `id` only to
 * override (e.g. when two columns access the same field with different
 * formatters).
 */
export interface DataColumnString<T> extends BaseColumn<T>, DerivableMixin {
  /** Stable column identifier. Defaults to {@link accessor} when omitted. */
  id?: string;
  /** Property name on `T` whose value is rendered/used. Must point to a primitive. */
  accessor: DataAccessor<T>;
}

/**
 * Data column with a function accessor that derives the cell value from the
 * row. Use this for nested object lookups (`item.expenseType?.name`) or
 * computed values (`${lastName}, ${firstName}`). `id` is required because a
 * function carries no implicit identifier.
 */
export interface DataColumnFunction<T> extends BaseColumn<T>, DerivableMixin {
  /** Stable column identifier (required — functions carry no implicit name). */
  id: string;
  /** Function that derives the value to render/use from a row. */
  accessor: (item: T) => unknown;
}

/**
 * Synthetic column without a data accessor — typical for action buttons,
 * derived visuals, or other UI that is not tied to a row property.
 * Synthetic columns are structurally excluded from search, sort, group and
 * summary because there is no value to operate on — the type omits the
 * Derivable mixin, so `sortable: true` / `searchable: true` on a synthetic
 * column would fail to compile.
 */
export interface SyntheticColumn<T> extends BaseColumn<T> {
  /** Stable column identifier (required for state targeting + persistence). */
  id: string;
  /** Synthetic columns must not declare an accessor. */
  accessor?: never;
}

/**
 * Defines a table column. One of three shapes, discriminated by the
 * presence and type of `accessor`:
 *
 * - {@link DataColumnString} — `accessor: 'propertyName'` (primitive-valued
 *   key on `T`). `id` defaults to the accessor name.
 * - {@link DataColumnFunction} — `accessor: (item) => value`. `id` is required.
 * - {@link SyntheticColumn} — no `accessor`. `id` is required. Not
 *   searchable/sortable/groupable.
 *
 * @example
 * ```ts
 * const columns: Column<Expense>[] = [
 *   // Primitive property → id is implicit
 *   { accessor: 'description', title: 'Beschreibung' },
 *   // Object property → function accessor + explicit id
 *   { id: 'expenseType',
 *     accessor: (e) => e.expenseType?.name ?? '',
 *     title: 'Typ',
 *     component: TypeCell },
 *   // Synthetic — no row data
 *   { id: 'actions', title: '', component: ActionButtons }
 * ];
 * ```
 */
export type Column<T = TableItem> =
  | DataColumnString<T>
  | DataColumnFunction<T>
  | SyntheticColumn<T>;

/**
 * Filter for table rows.
 *
 * `value` is always a string — even for numeric operators (`greaterThan`,
 * `lessThan`). The filtering concern converts via `Number()` at comparison
 * time. This keeps filters serializable for persistence and consistent with
 * the text-input UI.
 */
export interface Filter {
  /** Column ID the filter applies to (must match a column's resolved id) */
  column: string;
  /** Filter operator */
  operator: FilterOperator;
  /** Filter value (string — numeric operators convert via Number() internally) */
  value: string;
}

/**
 * Supported filter operators
 */
export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan';

/**
 * Query object emitted by the table in server mode.
 * Contains the full query state for server-side data fetching.
 * Compatible with any HTTP library — convert to URL params, GraphQL variables, etc.
 */
export interface TableQuery {
  /** Current page (1-based) */
  page: number;
  /** Number of items per page */
  itemsPerPage: number;
  /** Column ID to sort by, or empty string if no sort is active */
  sortColumn: string;
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
  /** Full-text search term */
  searchTerm: string;
  /** Active column filters */
  activeFilters: Filter[];
  /** Column ID for grouping, or null if ungrouped */
  groupByKey: string | null;
}

/**
 * Result returned by `queryFn` in server mode.
 */
export interface TableQueryResult {
  /** Items for the current page/query */
  items: TableItem[];
  /** Total number of items matching the query (for pagination) */
  totalItems: number;
}

/**
 * Options for grouping
 */
export interface GroupOption {
  /** Column ID for grouping */
  key: string;
  /** Display title */
  title: string;
}

/**
 * Snippet for expanded row content.
 * Receives the data item of the expanded row.
 */
export type ExpandedRowContent = Snippet<[item: TableItem]>;

export type TableAction = 'filter' | 'group' | 'summary';
export type { TableProps };
