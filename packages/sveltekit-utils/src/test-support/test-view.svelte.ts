/**
 * A faithful `TableViewLike` double — structural mirror of the table package's
 * `TableView` (equality guard, per-axis origin bookkeeping, claims). This
 * package stays table-free; the parity test in `@urbicon-ui/table` pins the
 * real class against `TableViewLike`.
 *
 * Lives in test-support rather than in one suite because both URL-binding
 * suites drive it: a second copy would be free to drift from the real class in
 * exactly the places the bindings depend on.
 */
import type { TableViewFilter } from '../lib/table-view';
import {
  TABLE_VIEW_AXES,
  type TableViewAxis,
  type TableViewLike,
  type TableViewSnapshot,
  type TableViewSort
} from '../lib/table-view';

const sortEqual = (a: TableViewSort | null, b: TableViewSort | null): boolean =>
  a === b || (a !== null && b !== null && a.column === b.column && a.direction === b.direction);

const filtersEqual = (a: TableViewFilter[], b: TableViewFilter[]): boolean =>
  a === b ||
  (a.length === b.length &&
    a.every(
      (f, i) => f.column === b[i].column && f.operator === b[i].operator && f.value === b[i].value
    ));

function axisEqual(axis: TableViewAxis, a: unknown, b: unknown): boolean {
  if (axis === 'sort') return sortEqual(a as TableViewSort | null, b as TableViewSort | null);
  if (axis === 'filters') return filtersEqual(a as TableViewFilter[], b as TableViewFilter[]);
  return Object.is(a, b);
}

type Origin = 'user' | 'external' | 'init';

export class TestView implements TableViewLike {
  readonly defaults: TableViewSnapshot;
  #snapshot: TableViewSnapshot = $state({
    search: '',
    sort: null,
    page: 1,
    pageSize: 10,
    filters: [],
    groupBy: null
  });
  #origins = new Map<TableViewAxis, { revision: number; origin: Origin }>();
  #claims = new Set<string>();
  #initApplied = new Set<TableViewAxis>();

  constructor(defaults: Partial<TableViewSnapshot> = {}) {
    this.defaults = {
      search: defaults.search ?? '',
      sort: defaults.sort ?? null,
      page: defaults.page ?? 1,
      pageSize: defaults.pageSize ?? 10,
      filters: defaults.filters ?? [],
      groupBy: defaults.groupBy ?? null
    };
    this.#snapshot = { ...this.defaults, filters: [...this.defaults.filters] };
    for (const axis of TABLE_VIEW_AXES) this.#origins.set(axis, { revision: 0, origin: 'init' });
  }

  #write(axis: TableViewAxis, value: unknown, origin: Origin): void {
    if (axisEqual(axis, this.#snapshot[axis], value)) return;
    const slot = this.#origins.get(axis);
    if (slot) {
      slot.revision += 1;
      slot.origin = origin;
    }
    this.#snapshot = { ...this.#snapshot, [axis]: value };
  }

  get search() {
    return this.#snapshot.search;
  }
  set search(v: string) {
    this.#write('search', v, 'user');
  }
  get sort() {
    return this.#snapshot.sort;
  }
  set sort(v: TableViewSort | null) {
    this.#write('sort', v, 'user');
  }
  get page() {
    return this.#snapshot.page;
  }
  set page(v: number) {
    this.#write('page', v, 'user');
  }
  get pageSize() {
    return this.#snapshot.pageSize;
  }
  set pageSize(v: number) {
    this.#write('pageSize', v, 'user');
  }
  get filters() {
    return this.#snapshot.filters;
  }
  set filters(v: TableViewFilter[]) {
    this.#write('filters', v, 'user');
  }
  get groupBy() {
    return this.#snapshot.groupBy;
  }
  set groupBy(v: string | null) {
    this.#write('groupBy', v, 'user');
  }

  applyExternal(partial: Partial<TableViewSnapshot>, origin: 'external'): void {
    for (const axis of TABLE_VIEW_AXES) {
      if (partial[axis] !== undefined) this.#write(axis, partial[axis], origin);
    }
  }

  claimAxes(kind: 'url' | 'storage', axes: readonly TableViewAxis[]): void {
    for (const axis of axes) {
      const key = `${kind}:${axis}`;
      if (this.#claims.has(key)) throw new Error(`duplicate claim ${key}`);
      this.#claims.add(key);
    }
  }
  releaseAxes(kind: 'url' | 'storage', axes: readonly TableViewAxis[]): void {
    for (const axis of axes) this.#claims.delete(`${kind}:${axis}`);
  }
  markInitApplied(axes: readonly TableViewAxis[]): void {
    for (const axis of axes) this.#initApplied.add(axis);
  }
  wasInitApplied(axis: TableViewAxis): boolean {
    return this.#initApplied.has(axis);
  }
  originOf(axis: TableViewAxis) {
    const { revision, origin } = this.#origins.get(axis) ?? {
      revision: 0,
      origin: 'init' as const
    };
    return { revision, origin };
  }
  snapshot(): TableViewSnapshot {
    return { ...this.#snapshot };
  }
}
