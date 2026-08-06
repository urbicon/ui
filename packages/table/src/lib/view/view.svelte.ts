/**
 * The v8 view object (#152/#157, TABLE-VIEW-STATE-2026-08.md §3): the six
 * axes that decide *which data is shown* — search, sort, page, pageSize,
 * filters, groupBy — as one consumer-constructed reactive object with one
 * name scheme, fully resolved against `defaults`.
 *
 * Construction and getters are SSR-safe — no effects anywhere (the #10
 * lesson). The table reads and writes the fields directly (`view.page = 3`);
 * bindings and system gates go through {@link TableView.applyExternal} so the
 * storage binding can tell a reader's change from an applied one.
 */
import { hasContext, untrack } from 'svelte';
import type { Filter } from '$lib/types/tableTypes';

/**
 * Who last wrote an axis:
 * - `user` — reader interaction through the table, or consumer code writing a
 *   field. May be persisted.
 * - `external` — a binding applied a value (URL navigation, storage
 *   hydration). Must never be persisted — "someone else's link stores
 *   nothing".
 * - `system` — the table itself discarded a value (virtualized × grouping).
 *   May clean the URL, must not land in storage as a user wish.
 */
export type ViewOrigin = 'user' | 'external' | 'system';

/** Sort state of a view: a column and a direction, or `null` for unsorted. */
export interface ViewSort {
  /** Column ID to sort by (must match a column's resolved id). */
  column: string;
  /** Sort direction. */
  direction: 'asc' | 'desc';
}

/** The six view axes, in the v8 vocabulary. */
export const VIEW_AXES = ['search', 'sort', 'page', 'pageSize', 'filters', 'groupBy'] as const;

/** One of the six view axes. */
export type ViewAxis = (typeof VIEW_AXES)[number];

/** A fully resolved view state — never `undefined` anywhere. */
export interface TableViewSnapshot {
  /** Full-text search term (`''` = no search). */
  search: string;
  /** Active sort, or `null` for unsorted — "unsorted" is a value, not a sentinel. */
  sort: ViewSort | null;
  /** Current page (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Active column filters. */
  filters: Filter[];
  /** Column ID for grouping, or `null` for ungrouped. */
  groupBy: string | null;
}

/** Partial defaults for {@link createTableView} — unset axes fall back to the table's own. */
export type TableViewDefaults = Partial<TableViewSnapshot>;

/**
 * Kinds of bindings that can claim axes. One binding per kind per axis; a
 * `url` and a `storage` binding on the same axis is composition, two `url`
 * bindings on it are a programming error.
 */
export type BindingKind = 'url' | 'storage';

const sortEqual = (a: ViewSort | null, b: ViewSort | null): boolean =>
  a === b || (a !== null && b !== null && a.column === b.column && a.direction === b.direction);

const filtersEqual = (a: Filter[], b: Filter[]): boolean =>
  a === b ||
  (a.length === b.length &&
    a.every(
      (f, i) => f.column === b[i].column && f.operator === b[i].operator && f.value === b[i].value
    ));

/**
 * Structural equality per axis — the echo guard. `Object.is` protects the
 * primitive axes on assignment already (Svelte skips signal propagation for
 * identical values); `sort` and `filters` arrive from a URL parser as *fresh
 * references* on every navigation, so without this check every URL echo would
 * count as a change and re-trigger every subscriber.
 */
function axisEqual(axis: ViewAxis, a: unknown, b: unknown): boolean {
  if (axis === 'sort') return sortEqual(a as ViewSort | null, b as ViewSort | null);
  if (axis === 'filters') return filtersEqual(a as Filter[], b as Filter[]);
  return Object.is(a, b);
}

/**
 * Detects whether we are inside component initialisation. `hasContext` is the
 * one public API that throws (`lifecycle_outside_component`) outside of it —
 * on the server and in module scope alike.
 */
function inComponentInit(): boolean {
  try {
    hasContext('__table-view-probe__');
    return true;
  } catch {
    return false;
  }
}

/**
 * The consumer-constructed view object: a class with `$state` fields,
 * resolved against `defaults` in the constructor.
 *
 * Two write surfaces, deliberately:
 * - **Fields** (`view.page = 3`) — the table's interaction handlers and
 *   consumer code. Counts as the reader's own change (`user`).
 * - **{@link applyExternal}** — bindings applying a value and the table's own
 *   system discards. Never counts as the reader's change, so the storage
 *   binding can keep someone else's link out of storage.
 *
 * Construct it in the component that owns it (or a request-scoped `load`),
 * never in module scope: on the server a module-scope view is state shared
 * between requests.
 */
export class TableView {
  /** The resolved elision/reset baseline — every axis present. */
  readonly defaults: TableViewSnapshot;

  #search: string = $state('');
  #sort: ViewSort | null = $state(null);
  #page: number = $state(1);
  #pageSize: number = $state(10);
  #filters: Filter[] = $state([]);
  #groupBy: string | null = $state(null);

  /**
   * Per-axis (revision, origin) bookkeeping. Deliberately NOT reactive:
   * effects are triggered by the `$state` fields themselves and read the
   * origin untracked afterwards. Because the pair is kept *per axis*,
   * batching two writes to different axes into one flush cannot mix their
   * origins up.
   */
  #origins: Record<ViewAxis, { revision: number; origin: ViewOrigin | 'init' }> = {
    search: { revision: 0, origin: 'init' },
    sort: { revision: 0, origin: 'init' },
    page: { revision: 0, origin: 'init' },
    pageSize: { revision: 0, origin: 'init' },
    filters: { revision: 0, origin: 'init' },
    groupBy: { revision: 0, origin: 'init' }
  };

  /**
   * `kind:axis` pairs claimed by bindings (fail-loud on conflict). A Set over
   * the composite key, NOT a `Map<axis, kind>`: the map form is defeasible by
   * interleaving kinds (url → storage → url overwrote the slot and the second
   * url binding registered silently).
   */
  #claims = new Set<string>();
  /** Axes a binding applied during init (the URL named them) — see {@link markInitApplied}. */
  #initApplied = new Set<ViewAxis>();
  /** Axes a storage binding has hydrated in this view's lifetime — see {@link markStorageApplied}. */
  #storageApplied = new Set<ViewAxis>();

  constructor(defaults: TableViewDefaults = {}) {
    if (
      import.meta.env?.DEV &&
      typeof window === 'undefined' &&
      typeof document === 'undefined' &&
      !inComponentInit()
    ) {
      // Module-scope construction on the server is cross-request state. A
      // warning rather than the DEV-*error* §8.2 would prefer, deliberately:
      // the `inComponentInit` probe cannot tell module scope from a
      // request-scoped `load` (both are outside component init), and an error
      // would break that legitimate construction site. Documented deviation.
      console.warn(
        '[TableView] constructed outside component initialisation on the server — a module-scope view is shared between requests. Construct it inside the component (or request-scoped load) that owns it.'
      );
    }
    // Copied, not referenced: `defaults` IS the elision baseline every
    // binding compares against, so a consumer who later pushes onto the array
    // they passed in would silently move the "this axis is at its default"
    // line — and with it what does and does not reach the URL.
    this.defaults = {
      search: defaults.search ?? '',
      sort: defaults.sort ? { ...defaults.sort } : null,
      page: defaults.page ?? 1,
      pageSize: defaults.pageSize ?? 10,
      filters: defaults.filters ? [...defaults.filters] : [],
      // `|| null` on top of the nullish fallback: an empty string is not a
      // grouping — normalising it here keeps `groupBy === null` the single
      // spelling of "ungrouped" for strict consumer checks.
      groupBy: defaults.groupBy || null
    };
    this.#search = this.defaults.search;
    this.#sort = this.defaults.sort;
    this.#page = this.defaults.page;
    this.#pageSize = this.defaults.pageSize;
    this.#filters = [...this.defaults.filters];
    this.#groupBy = this.defaults.groupBy;
  }

  // ── The user-facing write surface: plain fields ─────────────────────────
  get search(): string {
    return this.#search;
  }
  set search(value: string) {
    this.#write('search', value, 'user');
  }

  get sort(): ViewSort | null {
    return this.#sort;
  }
  set sort(value: ViewSort | null) {
    this.#write('sort', value, 'user');
  }

  get page(): number {
    return this.#page;
  }
  set page(value: number) {
    this.#write('page', value, 'user');
  }

  get pageSize(): number {
    return this.#pageSize;
  }
  set pageSize(value: number) {
    this.#write('pageSize', value, 'user');
  }

  get filters(): Filter[] {
    return this.#filters;
  }
  set filters(value: Filter[]) {
    this.#write('filters', value, 'user');
  }

  get groupBy(): string | null {
    return this.#groupBy;
  }
  set groupBy(value: string | null) {
    // `|| null`: same normalisation as the constructor — `null` stays the
    // single spelling of "ungrouped", so a consumer's `''` never reaches
    // serialization or storage as a distinct third state.
    this.#write('groupBy', value || null, 'user');
  }

  // ── The binding/system write surface ────────────────────────────────────

  /**
   * Apply a partial view without it counting as the reader's own change.
   * `external` = a binding applies (URL navigation, storage hydration);
   * `system` = the table itself discards a value (virtualized × grouping) —
   * it may clean the URL but must not land in storage as a user wish.
   */
  applyExternal(partial: Partial<TableViewSnapshot>, origin: 'external' | 'system'): void {
    for (const axis of VIEW_AXES) {
      if (partial[axis] !== undefined) {
        this.#write(axis, partial[axis], origin);
      }
    }
  }

  #write(axis: ViewAxis, value: unknown, origin: ViewOrigin): void {
    // `untrack` around the read is what makes writing an axis from inside an
    // `$effect` safe. Without it the echo guard's own read subscribes the
    // effect to the axis it writes, so the obvious way to drive the search
    // from outside —
    //   $effect(() => { view.search = query });
    // — re-ran on every table-side edit and overwrote it with the stale outer
    // value (measured: typing in the table's own search bar snapped back;
    // `view.page = 1` in the same effect made paging impossible). Untracking
    // it here removes the failure instead of documenting a rule about it: a
    // write is a write, and only the values the consumer actually reads
    // decide when their effect runs.
    const current = untrack(() => this.#read(axis));
    // The echo guard: a structurally identical write is a no-op — it neither
    // touches the signal nor the origin bookkeeping, so an echo arriving in
    // the same flush as a user edit cannot re-label the user's change.
    if (axisEqual(axis, current, value)) return;
    const slot = this.#origins[axis];
    slot.revision += 1;
    slot.origin = origin;
    switch (axis) {
      case 'search':
        this.#search = value as string;
        break;
      case 'sort':
        this.#sort = value as ViewSort | null;
        break;
      case 'page':
        this.#page = value as number;
        break;
      case 'pageSize':
        this.#pageSize = value as number;
        break;
      case 'filters':
        this.#filters = value as Filter[];
        break;
      case 'groupBy':
        this.#groupBy = value as string | null;
        break;
    }
  }

  #read(axis: ViewAxis): unknown {
    switch (axis) {
      case 'search':
        return this.#search;
      case 'sort':
        return this.#sort;
      case 'page':
        return this.#page;
      case 'pageSize':
        return this.#pageSize;
      case 'filters':
        return this.#filters;
      case 'groupBy':
        return this.#groupBy;
    }
  }

  /** Last change of an axis, for bindings — read untracked. */
  originOf(axis: ViewAxis): { revision: number; origin: ViewOrigin | 'init' } {
    const { revision, origin } = this.#origins[axis];
    return { revision, origin };
  }

  /**
   * Reactive full snapshot — reads (and therefore tracks) all six axes.
   *
   * The two composite axes are copied, so the returned object earns its name:
   * a snapshot that writes through to the live view is not one. The copy used
   * to sit in `viewToQuery`, which meant it only protected consumers who went
   * through that projection — `observeView(view, cb)` handed the callback the
   * view's own `filters` array, and a `cb` that sorted it in place was
   * reordering view state. Moving it here covers every caller.
   *
   * Shallow on purpose: the filter entries are three-string value objects
   * nothing edits in place, and a deep clone per snapshot would be paid on
   * every view change to guard against a write nobody makes.
   */
  snapshot(): TableViewSnapshot {
    return {
      search: this.#search,
      sort: this.#sort === null ? null : { ...this.#sort },
      page: this.#page,
      pageSize: this.#pageSize,
      filters: [...this.#filters],
      groupBy: this.#groupBy
    };
  }

  // ── Claims: fail-loud composition ───────────────────────────────────────

  /**
   * A binding registers the axes it manages. Two bindings of the same kind on
   * the same axis are a programming error, not a precedence question — this
   * throws unconditionally (like `getTableContext` outside a provider does):
   * a silently ignored second binding would corrupt state in prod too.
   *
   * A binding must release its claims on teardown via {@link releaseAxes} so
   * a remounting child (`{#if}`) on a longer-lived view does not trip over
   * its own previous registration.
   */
  claimAxes(kind: BindingKind, axes: readonly ViewAxis[]): void {
    for (const axis of axes) {
      const key = `${kind}:${axis}`;
      if (this.#claims.has(key)) {
        throw new Error(
          `[TableView] two ${kind} bindings claim the axis "${axis}" — every axis takes at most one binding per kind.`
        );
      }
      this.#claims.add(key);
    }
  }

  /** Release a binding's claims — called from the binding's destroy teardown. */
  releaseAxes(kind: BindingKind, axes: readonly ViewAxis[]): void {
    for (const axis of axes) {
      this.#claims.delete(`${kind}:${axis}`);
    }
  }

  /**
   * Marks axes a binding applied *during init* (the URL actually named them).
   * The storage binding consults this at hydration time — the one moment
   * presence matters: an init-applied axis is claimed, storage keeps off it
   * (the deep-link precedence URL > storage); an axis nobody applied may be
   * seeded from storage. Deliberately not cleared on binding teardown — that
   * the URL delivered at init is a historical fact, not a live claim.
   */
  markInitApplied(axes: readonly ViewAxis[]): void {
    for (const axis of axes) this.#initApplied.add(axis);
  }

  /** Whether a binding applied this axis during init. */
  wasInitApplied(axis: ViewAxis): boolean {
    return this.#initApplied.has(axis);
  }

  /**
   * Marks axes a storage binding has processed at hydration time — like
   * {@link markInitApplied}, scoped to the VIEW's lifetime, not the
   * binding's: "storage never applies again" is a phase of the view's life,
   * so a remounting child (`{#if}`) on a longer-lived view must not
   * re-hydrate over state the reader has since changed. Set for every bound
   * axis the hydration pass considered, whether or not storage held a value
   * for it, and never cleared — symmetric with the init marks.
   */
  markStorageApplied(axes: readonly ViewAxis[]): void {
    for (const axis of axes) this.#storageApplied.add(axis);
  }

  /** Whether a storage binding already hydrated this axis in this view's lifetime. */
  wasStorageApplied(axis: ViewAxis): boolean {
    return this.#storageApplied.has(axis);
  }
}

/**
 * Create a table view object — the consumer entry point.
 *
 * @example A view whose sort and page size differ from the table's defaults
 * ```ts
 * const view = createTableView({
 *   defaults: { pageSize: 25, sort: { column: 'date', direction: 'desc' } }
 * });
 * ```
 */
export function createTableView(options: { defaults?: TableViewDefaults } = {}): TableView {
  return new TableView(options.defaults);
}

/**
 * Resolve the `view` / `viewDefaults` prop pair. The single most common
 * configuration (a page size) must stay a one-liner; `viewDefaults` is that
 * one-liner, valid only WITHOUT a `view` prop. Passing both is a programming
 * error, not a precedence question — fail loud.
 */
export function resolveViewProp(
  view: TableView | undefined,
  viewDefaults: TableViewDefaults | undefined
): TableView {
  if (view && viewDefaults) {
    throw new Error(
      '[Table] `view` and `viewDefaults` are mutually exclusive — `viewDefaults` is the shorthand for a table that owns its view. Move the defaults into `createTableView({ defaults })` or drop the `view` prop.'
    );
  }
  return view ?? createTableView({ defaults: viewDefaults });
}
