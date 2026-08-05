/**
 * SPIKE §3.5 / §7.3 — the data-source union. Replaces the
 * `mode` × `items` × `queryFn` × `onQueryChange` × `loading` × `error` ×
 * `serverTotalItems` prop combinatorics with one value whose invalid
 * combinations are unrepresentable.
 *
 * The `kind?: never` / `total?: never` guards on the client variant are not
 * decoration: TypeScript's excess-property check fires only on *fresh object
 * literals*. `const s = { items, total: 120 }; <Table source={s}>` sails
 * through structural matching against `{ items; loading?; error? }` without
 * them — which would resurrect exactly the silent mode switch (M5) the
 * explicit `kind: 'server'` tag exists to prevent. Measured in
 * `source.typecheck.ts` against the real compiler.
 */
import type { TableItem, TableQuery, TableQueryResult } from '$lib/types/tableTypes';

export interface ClientItemsSource<T extends TableItem = TableItem> {
  items: T[];
  loading?: boolean;
  error?: string | null;
  kind?: never;
  total?: never;
  query?: never;
}

export interface ServerManualSource<T extends TableItem = TableItem> {
  kind: 'server';
  items: T[];
  total: number;
  loading?: boolean;
  error?: string | null;
  query?: never;
}

export interface ServerManagedSource {
  query: (q: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;
  debounceMs?: number;
  kind?: never;
  items?: never;
}

export type TableSource<T extends TableItem = TableItem> =
  | T[]
  | ClientItemsSource<T>
  | ServerManualSource<T>
  | ServerManagedSource;

export type ResolvedSource<T extends TableItem = TableItem> =
  | { mode: 'client'; items: T[]; loading: boolean; error: string | null }
  | {
      mode: 'server-manual';
      items: T[];
      total: number;
      loading: boolean;
      error: string | null;
    }
  | {
      mode: 'server-managed';
      query: (q: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;
      debounceMs: number;
    };

/**
 * Narrow the union into an internal discriminated shape. Order matters only
 * for runtime dispatch; the type-level narrowing is measured separately.
 */
export function resolveSource<T extends TableItem>(source: TableSource<T>): ResolvedSource<T> {
  if (Array.isArray(source)) {
    return { mode: 'client', items: source, loading: false, error: null };
  }
  if (typeof source.query === 'function') {
    return {
      mode: 'server-managed',
      query: source.query,
      debounceMs: source.debounceMs ?? 300
    };
  }
  if (source.kind === 'server') {
    return {
      mode: 'server-manual',
      items: source.items,
      total: source.total,
      loading: source.loading ?? false,
      error: source.error ?? null
    };
  }
  return {
    mode: 'client',
    items: (source as ClientItemsSource<T>).items,
    loading: (source as ClientItemsSource<T>).loading ?? false,
    error: (source as ClientItemsSource<T>).error ?? null
  };
}
