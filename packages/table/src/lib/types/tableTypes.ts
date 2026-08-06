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
   * - `1` (or unset): primary — rendered as a prominent field.
   * - `2`: secondary — rendered as a normal detail field.
   * - `3`: desktop-only — omitted from the mobile card (kept in the desktop table).
   *
   * Of the card columns (priority 1/unset/2, in source order) the first becomes
   * the label-less card title and the second the label-less subtitle under it;
   * everything from the third on fills the detail grid, which the card hides
   * until it is opened. `Table`'s `mobileCardDetails="expanded"` turns the
   * collapse off — then only the first column is special and every other card
   * column shows as a labelled field.
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
  /**
   * Whether the user may hide this column — via the column-visibility menu or
   * the header menu's hide action. Defaults to `true`. Set `false` to pin a
   * column as always-visible (e.g. a primary identifier or an actions column):
   * it is then omitted from the visibility menu and its header menu shows no
   * hide action. Independent of the table-level `enableColumnVisibility` prop,
   * which turns the whole feature off at once.
   */
  hideable?: boolean;
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
  /** Whether this column is groupable. Falls back to `sortable === true`. */
  groupable?: boolean;
  /**
   * Whether this column offers Sum / Avg / Min / Max. Falls back to
   * `dataType === 'number'`.
   *
   * Never inferred from the column's **name**. Until 2026-07-31 an accessor
   * called `price`, `age`, `amount`, `score` (and five more English nouns) was
   * treated as numeric — so a `price` column yielding strings was offered a sum
   * that could not work, a numeric `throughput` was offered none, and the
   * feature did not exist at all for columns named in another language.
   */
  summable?: boolean;
  /**
   * The column's data type. Drives alignment, the filter operators the menu
   * offers, the quick-values list and summability — so declaring it is how a
   * numeric column becomes numeric. `TableColumns.number()` sets it for you.
   */
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
 * `value` is always a string — even for the comparing operators (`greaterThan`,
 * `lessThan`). This keeps filters serializable for persistence and consistent
 * with the text-input UI.
 *
 * The comparing operators resolve in two steps:
 *
 * 1. **Numeric** — when both the cell value and `value` convert via `Number()`,
 *    they are compared as numbers (prices, counts, epoch timestamps).
 * 2. **Date** — otherwise both sides are read as instants: `Date` instances,
 *    numbers (epoch millis) and ISO-8601 strings (`2021-03-15`,
 *    `2021-03-15T09:00`, `2021-03-15T09:00:00Z`). Anything else — and any other
 *    string format — never matches.
 *
 * Date semantics: when `value` is a bare calendar date (`YYYY-MM-DD`, what the
 * SmartFilterBar's date input emits), both operators compare on **UTC day
 * boundaries** — `greaterThan` ("after") starts at the following midnight UTC,
 * `lessThan` ("before") ends at the filter day's midnight UTC, so a cell at
 * `2021-03-15T09:00Z` matches neither for `2021-03-15`. A `value` *with* a time
 * of day compares instants strictly. Per the ECMAScript date-time string
 * format a date-only string is UTC midnight while a date-time string without an
 * offset is local time, so a `Date` built from local parts
 * (`new Date(2021, 2, 15)`) can land on the neighbouring UTC day — store ISO
 * strings or UTC-constructed dates for day-exact filtering.
 */
export interface Filter {
  /** Column ID the filter applies to (must match a column's resolved id) */
  column: string;
  /** Filter operator */
  operator: FilterOperator;
  /**
   * Filter value (string — `greaterThan`/`lessThan` compare it as a number
   * first, then as a date; see the interface docs)
   */
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
 * Result a server source resolves with — the return shape of `source.query`
 * (managed flow), and the shape `setServerResult` accepts in the manual
 * `kind: 'server'` flow.
 *
 * `total` is spelled the same here as on `ServerManualSource` (#162): both
 * mean "how many rows match this query", and until v9 the managed flow
 * called it `totalItems` purely because that name came through unchanged
 * from v7. Which flow you use no longer changes what the field is called.
 */
export interface TablePage {
  /** Items for the current page/query */
  items: TableItem[];
  /** Total number of items matching the query — drives pagination. */
  total: number;
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
