/**
 * SPIKE (§7 of TABLE-VIEW-STATE-2026-08.md) — the v8 view-object prototype.
 *
 * Not exported from the package, not part of any public API. This directory
 * exists to *measure* the open questions of the v8 design before anything is
 * built: origin tracking under effect batching (§7.1), binding composition
 * (§7.2), the source union (§7.3) and the server-mode contract (§7.4). The
 * measurements live in the sibling `spike.*.svelte.test.ts` files; the design
 * document records their results as Rev. 3.
 */
import { hasContext } from 'svelte';
import type { Filter } from '$lib/types/tableTypes';

export type ViewOrigin = 'user' | 'external' | 'system';

export interface ViewSort {
  column: string;
  direction: 'asc' | 'desc';
}

/** The six view axes, in the v8 vocabulary (§3.2 of the design). */
export const VIEW_AXES = ['search', 'sort', 'page', 'pageSize', 'filters', 'groupBy'] as const;
export type ViewAxis = (typeof VIEW_AXES)[number];

/** A fully resolved view state — never `undefined` anywhere (§3.1). */
export interface TableViewSnapshot {
  search: string;
  sort: ViewSort | null;
  page: number;
  pageSize: number;
  filters: Filter[];
  groupBy: string | null;
}

export type TableViewDefaults = Partial<TableViewSnapshot>;

/** Kinds of bindings that can claim axes. One binding per kind per axis. */
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
 * count as a change and re-trigger every subscriber (measured in
 * spike.origin.svelte.test.ts).
 */
function axisEqual(axis: ViewAxis, a: unknown, b: unknown): boolean {
  if (axis === 'sort') return sortEqual(a as ViewSort | null, b as ViewSort | null);
  if (axis === 'filters') return filtersEqual(a as Filter[], b as Filter[]);
  return Object.is(a, b);
}

/**
 * Detects whether we are inside component initialisation. `hasContext` is the
 * one public API that throws (`lifecycle_outside_component`) outside of it —
 * measured in spike.ssr.test.ts, on the server and in module scope.
 */
function inComponentInit(): boolean {
  try {
    hasContext('__spike-probe__');
    return true;
  } catch {
    return false;
  }
}

/**
 * The consumer-constructed view object (§3.2): a class with `$state` fields,
 * resolved against `defaults` in the constructor. Construction and getters are
 * SSR-safe — no effects anywhere (the #10 lesson). The table reads and writes
 * the fields directly (`view.page = 3`); bindings and system gates go through
 * {@link applyExternal} so the storage binding can tell a reader's change from
 * an applied one (§7.1).
 */
export class TableView {
  readonly defaults: TableViewSnapshot;

  #search: string = $state('');
  #sort: ViewSort | null = $state(null);
  #page: number = $state(1);
  #pageSize: number = $state(10);
  #filters: Filter[] = $state([]);
  #groupBy: string | null = $state(null);

  /**
   * Per-axis (revision, origin) bookkeeping — §7.1 candidate 1. Deliberately
   * NOT reactive: effects are triggered by the `$state` fields themselves and
   * read the origin untracked afterwards. Because the pair is kept *per axis*,
   * batching two writes to different axes into one flush cannot mix their
   * origins up — that is exactly what spike.origin.svelte.test.ts measures.
   */
  #origins: Record<ViewAxis, { revision: number; origin: ViewOrigin | 'init' }> = {
    search: { revision: 0, origin: 'init' },
    sort: { revision: 0, origin: 'init' },
    page: { revision: 0, origin: 'init' },
    pageSize: { revision: 0, origin: 'init' },
    filters: { revision: 0, origin: 'init' },
    groupBy: { revision: 0, origin: 'init' }
  };

  /** kind → axes claimed by a binding of that kind (fail-loud on conflict). */
  #claims = new Map<ViewAxis, BindingKind>();
  /** Axes a binding applied during init (the URL named them) — §3.3 contract. */
  #initApplied = new Set<ViewAxis>();

  constructor(defaults: TableViewDefaults = {}) {
    if (
      import.meta.env?.DEV &&
      typeof window === 'undefined' &&
      typeof document === 'undefined' &&
      !inComponentInit()
    ) {
      // Module-scope construction on the server is cross-request state (m4).
      console.warn(
        '[TableView] constructed outside component initialisation on the server — a module-scope view is shared between requests. Construct it inside the component that owns it.'
      );
    }
    this.defaults = {
      search: defaults.search ?? '',
      sort: defaults.sort ?? null,
      page: defaults.page ?? 1,
      pageSize: defaults.pageSize ?? 10,
      filters: defaults.filters ?? [],
      groupBy: defaults.groupBy ?? null
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
    this.#write('groupBy', value, 'user');
  }

  // ── The binding/system write surface ────────────────────────────────────

  /**
   * Apply a partial view without it counting as the reader's own change.
   * `external` = a binding applies (URL navigation, storage hydration) —
   * "someone else's link stores nothing". `system` = the table itself
   * discards a value (virtualized × grouping) — may clean the URL, must not
   * land in storage as a user wish (§7.1, third origin class).
   */
  applyExternal(partial: Partial<TableViewSnapshot>, origin: 'external' | 'system'): void {
    for (const axis of VIEW_AXES) {
      if (partial[axis] !== undefined) {
        this.#write(axis, partial[axis], origin);
      }
    }
  }

  #write(axis: ViewAxis, value: unknown, origin: ViewOrigin): void {
    const current = this.#read(axis);
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

  /** Reactive full snapshot — reads (and therefore tracks) all six axes. */
  snapshot(): TableViewSnapshot {
    return {
      search: this.#search,
      sort: this.#sort,
      page: this.#page,
      pageSize: this.#pageSize,
      filters: this.#filters,
      groupBy: this.#groupBy
    };
  }

  // ── Claims (§3.3): fail-loud composition ────────────────────────────────

  /**
   * A binding registers the axes it manages. Two bindings of the same kind on
   * the same axis are a programming error, not a precedence question — DEV
   * throws (measured in spike.composition.svelte.test.ts).
   */
  claimAxes(kind: BindingKind, axes: readonly ViewAxis[]): void {
    for (const axis of axes) {
      if (this.#claims.get(axis) === kind) {
        throw new Error(
          `[TableView] two ${kind} bindings claim the axis "${axis}" — every axis takes at most one binding per kind.`
        );
      }
      this.#claims.set(axis, kind);
    }
  }

  /**
   * Marks axes a binding applied *during init* (the URL actually named them).
   * The storage binding consults this at hydration time — the one moment
   * presence matters (§3.3): an init-applied axis is claimed, storage keeps
   * off it; an axis nobody applied may be seeded from storage.
   */
  markInitApplied(axes: readonly ViewAxis[]): void {
    for (const axis of axes) this.#initApplied.add(axis);
  }

  wasInitApplied(axis: ViewAxis): boolean {
    return this.#initApplied.has(axis);
  }
}

/** §3.1 — the consumer entry point. */
export function createTableView(options: { defaults?: TableViewDefaults } = {}): TableView {
  return new TableView(options.defaults);
}
