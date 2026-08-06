/**
 * The data-source union (TABLE-VIEW-STATE-2026-08.md §3.5). Replaces the
 * `mode` × `items` × `queryFn` × `onQueryChange` × `loading` × `error` ×
 * `serverTotal` prop combinatorics with one value whose invalid
 * combinations are unrepresentable.
 *
 * `processing` is required on every arm (#165), and that is what makes the
 * dangerous state unrepresentable rather than guarded. Until v9 the tag was
 * `kind: 'server'`, present on one arm out of three, so the missing-tag case
 * had to be caught by `?: never` fields: TypeScript's excess-property check
 * fires only on *fresh object literals*, and
 * `const s = { items, total: 120 }; <Table source={s}>` sailed through
 * structural matching against `{ items; loading?; error? }` — the silent mode
 * switch, handing the reader dead sort headers with nobody having chosen
 * server processing. `{ items, total }` now matches no arm at all.
 *
 * The `?: never` fields that remain guard a smaller class: a field one arm
 * owns appearing on another, where it would be silently ignored rather than
 * change the mode (`{ processing: 'server', items, total, query }`). Both
 * classes are pinned by `source.typecheck.ts`.
 *
 * Why `processing` and not `kind`: the tag decides **who sorts, filters,
 * searches and pages** — the table or the backend — and `kind` said nothing
 * about that. It read as a statement about where the data comes from, which
 * the client arm answers differently (it fetches from a server too). The
 * domain already has the word: DataTables ships "server-side processing",
 * AG Grid the "Server-Side Row Model", TanStack Table the same axis as
 * `manualSorting`/`manualFiltering`/`manualPagination`.
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
import type { TableItem, TablePage } from '$lib/types/tableTypes';
import type { TableViewSnapshot } from './view.svelte';

/**
 * The table does the work: it sorts, filters, searches and pages the rows you
 * give it, in the browser. Loading and error are yours to report because you
 * fetched the rows — the *processing* is what this arm decides, not where the
 * data came from.
 */
export interface ClientItemsSource<T = TableItem> {
  processing: 'client';
  items: T[];
  loading?: boolean;
  error?: string | null;
  total?: never;
  query?: never;
}

/**
 * The backend does the work, manual flow: you fetch, the table only renders.
 *
 * `processing: 'server'` is mandatory because it turns the table's own
 * sorting, filtering, searching and paging off — a decision with visible
 * consequences for the reader, never something to be inferred from a `total`
 * field that happened to be passed through.
 */
export interface ServerManualSource<T = TableItem> {
  processing: 'server';
  items: T[];
  /** Total number of items matching the query — drives pagination. */
  total: number;
  loading?: boolean;
  error?: string | null;
  query?: never;
}

/**
 * The backend does the work, managed flow: the table drives the fetch
 * lifecycle too, and owns `loading`/`error`/`total` outright — so the `never`
 * guards below make passing them a type error instead of the silently ignored
 * props they were in v7 (the DEV warning this union replaced).
 *
 * Same `processing: 'server'` as {@link ServerManualSource}, deliberately:
 * which of the two applies is structural (a `query` function or rows), and
 * the difference has no consequence for the reader — the backend computes
 * either way and no control goes dead. Folding "who fetches" into the tag
 * would put two questions back in one field.
 *
 * Feature-frozen: the view is the only thing that triggers a fetch, and that
 * is the whole remit. Refreshing, polling, caching and invalidating belong to
 * a data layer of your own, whose result reaches the table through
 * {@link ServerManualSource}.
 */
export interface ServerManagedSource {
  processing: 'server';
  /**
   * Called with the view itself — the same six axes the reader manipulates,
   * under the same names. Project it onto your backend's parameters inside
   * the function.
   */
  query: (q: TableViewSnapshot, options: { signal: AbortSignal }) => Promise<TablePage>;
  /** Debounce for refetches after the immediate first fetch. @default 300 */
  debounceMs?: number;
  items?: never;
  loading?: never;
  error?: never;
  total?: never;
}

/**
 * Where the table's rows come from, and **who processes them** — always an
 * object, never a bare array:
 * - `{ processing: 'client', items, loading?, error? }` — the table sorts,
 *   filters, searches and pages in the browser
 * - `{ processing: 'server', items, total, loading?, error? }` — the backend
 *   does that work; you fetch and hand in each page
 * - `{ processing: 'server', query, debounceMs? }` — same, and the table
 *   calls `query` for you when the view changes
 *
 * The bare `T[]` arm was dropped in v9 (#161). It normalised into exactly the
 * same internal shape as `{ items }`, so it bought no capability — it only
 * gave "how do I pass rows?" a third correct answer next to `items` and
 * `source={{ items }}`. The split that remains is a rule you can state:
 * {@link import('$lib/core/table').TableProps.items | items} for just rows,
 * `source` for rows plus how they arrive and who processes them.
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
      query: (q: TableViewSnapshot, options: { signal: AbortSignal }) => Promise<TablePage>;
      debounceMs: number;
    };

/**
 * Narrow the union into the internal discriminated shape.
 *
 * The validation up front is for the consumer TypeScript is not protecting.
 * In plain JavaScript every shape the type rules out still arrives here, and
 * each one used to fail late and anonymously: a bare array fell through to
 * the client branch and returned `items: undefined` — a value
 * `ResolvedSource` forbids — which surfaced as
 * `Cannot read properties of undefined (reading 'map')` from `normalizeItems`
 * two frames away, naming neither `source` nor the removed arm. A missing
 * `processing` is the worse one: `{ items, total }` would resolve as *client*
 * and quietly sort a page of server-paged rows, which is the exact defect the
 * required tag exists to prevent. Same failures, named.
 */
export function resolveSource<T>(source: TableSource<T>): ResolvedSource<T> {
  if (Array.isArray(source)) {
    throw new TypeError(
      "[Table] `source` does not take a bare array — pass `source={{ processing: 'client', items: rows }}`, or use the `items` prop."
    );
  }
  // Read before narrowing: inside the `throw` branch TypeScript has already
  // reduced `source` to `never`, so the value would be unreportable.
  const processing: unknown = source?.processing;
  if (processing !== 'client' && processing !== 'server') {
    throw new TypeError(
      `[Table] \`source\` needs \`processing: 'client'\` or \`processing: 'server'\` — it decides whether the table or your backend sorts, filters and pages. Got ${JSON.stringify(processing)}.`
    );
  }
  if (typeof source.query === 'function') {
    return {
      mode: 'server-managed',
      query: source.query,
      debounceMs: source.debounceMs ?? 300
    };
  }
  if (!Array.isArray(source.items)) {
    throw new TypeError(
      `[Table] \`source\` with \`processing: '${source.processing}'\` needs an \`items\` array${source.processing === 'server' ? ' and a `total`, or a `query` function' : ''}.`
    );
  }
  if (source.processing === 'server') {
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
