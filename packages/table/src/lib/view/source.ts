/**
 * The data-source union (TABLE-VIEW-STATE-2026-08.md §3.5). Replaces the
 * `mode` × `items` × `queryFn` × `onQueryChange` × `loading` × `error` ×
 * `serverTotalItems` prop combinatorics with one value whose invalid
 * combinations are unrepresentable.
 *
 * The `kind?: never` / `total?: never` guards on the client variant are not
 * decoration: TypeScript's excess-property check fires only on *fresh object
 * literals*. `const s = { items, total: 120 }; <Table source={s}>` sails
 * through structural matching against `{ items; loading?; error? }` without
 * them — which would resurrect exactly the silent mode switch the explicit
 * `kind: 'server'` tag exists to prevent (dead sort headers with nobody
 * having chosen server mode). Guarded by `source.typecheck.ts`.
 *
 * WHY `ServerManagedSource` IS FROZEN (2026-08-06, #160). It fetches on view
 * change, debounces and aborts, and that is the whole remit. The requests it
 * cannot serve — re-running the same query for a refresh button or a poll,
 * resync after a failed optimistic update, caching, deduplication, retry,
 * invalidation after a mutation — are a data layer, and growing one inside a
 * table component means competing with TanStack Query and, since Kit 2.27,
 * SvelteKit's own remote functions (whose `query` already has the keyed
 * cache, the dedup, `refresh()` and single-flight invalidation). Consumers
 * bring theirs and hand the result to `ServerManualSource`, which asks only
 * for rows and a total and therefore composes with any of them. That variant
 * is where capabilities go; this one takes bug fixes.
 */
import type { TableItem, TableQuery, TableQueryResult } from '$lib/types/tableTypes';

/** Client-mode source with self-fetched loading/error state. */
export interface ClientItemsSource<T = TableItem> {
  items: T[];
  loading?: boolean;
  error?: string | null;
  kind?: never;
  total?: never;
  query?: never;
}

/**
 * Server mode, manual flow: the consumer fetches, the table only renders.
 * `kind: 'server'` is mandatory — server mode turns local sorting/filtering
 * off, so it must be an explicit decision, never inferred from a `total`
 * field that happened to be passed through.
 */
export interface ServerManualSource<T = TableItem> {
  kind: 'server';
  items: T[];
  /** Total number of items matching the query — drives pagination. */
  total: number;
  loading?: boolean;
  error?: string | null;
  query?: never;
}

/**
 * Server mode, managed flow: the table drives the fetch lifecycle — and owns
 * `loading`/`error`/`total` outright, so the `never` guards below make
 * passing them a type error instead of the silently ignored props they were
 * in v7 (the DEV warning this union replaced).
 *
 * Feature-frozen: the view is the only thing that triggers a fetch, and that
 * is the whole remit. Refreshing, polling, caching and invalidating belong to
 * a data layer of your own, whose result reaches the table through
 * {@link ServerManualSource}.
 */
export interface ServerManagedSource {
  query: (q: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;
  /** Debounce for refetches after the immediate first fetch. @default 300 */
  debounceMs?: number;
  kind?: never;
  items?: never;
  loading?: never;
  error?: never;
  total?: never;
}

/**
 * Where the table's rows come from — always an object, never a bare array:
 * - `{ items, loading?, error? }` — client items the consumer fetches itself
 * - `{ kind: 'server', items, total, loading?, error? }` — manual server flow
 * - `{ query, debounceMs? }` — managed server flow
 *
 * The bare `T[]` arm was dropped in 8.1 (#161). It normalised into exactly the
 * same internal shape as `{ items }`, so it bought no capability — it only
 * gave "how do I pass rows?" a third correct answer next to `items` and
 * `source={{ items }}`. The split that remains is a rule you can state:
 * {@link import('$lib/core/table').TableProps.items | items} for just rows,
 * `source` for rows plus how they arrive.
 */
export type TableSource<T = TableItem> =
  | ClientItemsSource<T>
  | ServerManualSource<T>
  | ServerManagedSource;

/** The internal discriminated shape {@link resolveSource} narrows into. */
export type ResolvedSource<T = TableItem> =
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

/** Narrow the union into the internal discriminated shape. */
export function resolveSource<T>(source: TableSource<T>): ResolvedSource<T> {
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
    items: source.items,
    loading: source.loading ?? false,
    error: source.error ?? null
  };
}
