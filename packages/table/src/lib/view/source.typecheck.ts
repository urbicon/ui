/**
 * Type-level guards on the source union, against the real compiler. This file
 * is *checked*, never executed: every `@ts-expect-error` here is a claim that
 * the compiler rejects the line — and svelte-check fails when one stops
 * erroring, so each probe carries its own positive control.
 *
 * The headline measurement used to be M5/Prüfstein 19: `{ items, total }` — a
 * server config that forgot its tag — had to be a type error *without* a fresh
 * object literal too, since excess-property checks only fire on fresh ones.
 * That took a `total?: never` field on the client arm to enforce, because the
 * tag lived on one arm out of three.
 *
 * With `processing` required everywhere (#165) the same shape matches no arm
 * at all, so the guard is no longer what carries it — the union's own shape
 * is. `NaiveClient` at the bottom keeps measuring what the *absence* of the
 * required tag costs, which is what makes it the control rather than a
 * decoration.
 */
import type { TableItem, TablePage } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';
import type { TableViewSnapshot } from './view.svelte';

declare const items: Array<{ id: number; name: string }>;
declare const query: (q: TableViewSnapshot, o: { signal: AbortSignal }) => Promise<TablePage>;

declare function acceptSource<T>(source: TableSource<T>): void;

// ── The three intended shapes all pass ────────────────────────────────────
acceptSource({ processing: 'client', items });
acceptSource({ processing: 'client', items, loading: true, error: null });
acceptSource({ processing: 'server', items, total: 120 });
acceptSource({ processing: 'server', items, total: 120, loading: false });
acceptSource({ processing: 'server', query });
acceptSource({ processing: 'server', query, debounceMs: 500 });

// ── #165: the tag is required, and that is what kills the silent switch ───

// The M5 shape, in the form that used to need a `never` guard to reject: a
// variable, so no excess-property check fires. It now matches no arm, because
// every arm requires `processing`.
const untaggedServerConfig = { items: [] as TableItem[], total: 120 };
// @ts-expect-error a source without `processing` matches no arm (variable form)
acceptSource(untaggedServerConfig);

// @ts-expect-error a source without `processing` matches no arm (fresh literal)
acceptSource({ items });

// @ts-expect-error `processing` is a literal union, not an open string
acceptSource({ processing: 'remote', items });

// ── #161: the bare-array arm is gone ──────────────────────────────────────
// It resolved into exactly the same internal shape as `{ processing:
// 'client', items }`, so it was a third spelling of one thing. Re-add `T[]`
// to the union and this line stops erroring.
// @ts-expect-error a bare array is not a source
acceptSource(items);

// ── The guards that remain: a field one arm owns, on another arm ──────────
// These no longer prevent a mode switch — the tag does that — but each field
// would still be silently ignored, which is what the `?: never` fields make
// loud. Both forms, because excess-property checks only cover the literal.

// @ts-expect-error a client source has no `total` (fresh literal)
acceptSource({ processing: 'client', items, total: 120 });
const clientWithTotal = { processing: 'client' as const, items: [] as TableItem[], total: 120 };
// @ts-expect-error a client source has no `total` (variable form)
acceptSource(clientWithTotal);

// @ts-expect-error a server source needs `total` when it carries rows
acceptSource({ processing: 'server', items });

// @ts-expect-error a managed source owns the data — it cannot carry `items`
acceptSource({ processing: 'server', query, items });

// The combination #165 called out: rows AND a query on one server source.
// Neither arm accepts it — manual has `query?: never`, managed `items?: never`.
// @ts-expect-error a server source is manual or managed, not both
acceptSource({ processing: 'server', items, total: 120, query });

// A managed source owns loading/error/total too — v7 warned about this
// combination in DEV and ignored the props; now it must not compile, in the
// variable form as well (those guards are still load-bearing).
const managedWithLoading = { processing: 'server' as const, query, loading: true };
// @ts-expect-error managed source cannot carry `loading` (variable form)
acceptSource(managedWithLoading);
const managedWithErrorTotal = {
  processing: 'server' as const,
  query,
  error: 'boom' as string | null,
  total: 99
};
// @ts-expect-error managed source cannot carry `error`/`total` (variable form)
acceptSource(managedWithErrorTotal);
// @ts-expect-error managed source cannot carry `loading` (fresh literal)
acceptSource({ processing: 'server', query, loading: false });

// ── Control measurement: what the required tag is worth ───────────────────
// The client arm as it would look with an optional tag — the pre-#165 shape.
// This block compiling is the *measured defect*: `{ items, total }` passes as
// a client source, the table sorts a page of server-paged rows locally, and
// the reader gets sort headers that reorder 20 of 5000 rows. Make
// `processing` optional on `ClientItemsSource` and the two probes at the top
// of the #165 block start failing the check as unused directives.
// Measured 2026-08-07.
interface OptionallyTagged<T> {
  processing?: 'client';
  items: T[];
  loading?: boolean;
  error?: string | null;
}
declare function acceptOptionallyTagged<T>(source: OptionallyTagged<T>): void;
acceptOptionallyTagged(untaggedServerConfig); // compiles — the silent switch

// ── TS ergonomics under generics (§7.3): narrowing survives the generic ───
export function genericConsumer<T>(source: TableSource<T>): T[] {
  const resolved = resolveSource(source);
  if (resolved.mode === 'server-managed') {
    // narrowed: no items on the managed arm
    return [];
  }
  // narrowed: both remaining arms carry items
  return resolved.items;
}
