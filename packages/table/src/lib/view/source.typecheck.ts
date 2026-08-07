/**
 * Type-level guards on the source union, against the real compiler. This file
 * is *checked*, never executed: every `@ts-expect-error` here is a claim that
 * the compiler rejects the line — and svelte-check fails when one stops
 * erroring, so each probe carries its own positive control.
 *
 * The headline measurement is M5/Prüfstein 19: `{ items, total }` — a server
 * config that forgot its tag — has to be a type error *without* a fresh object
 * literal too, since excess-property checks only fire on fresh ones.
 *
 * Since #165 that shape is rejected on two independent lines: `total?: never`
 * on the client arm (which carried it alone in 8.0) and the now-required
 * `processing`. The probes below separate the two, because conflating them is
 * how a control block stops controlling anything — measured per line, not
 * asserted.
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

// ── #165: what the required tag is worth, measured ───────────────────────
//
// Two claims, and they are not the same claim.
//
// (1) The tag ALONE rejects a source that says nothing about who processes.
// `{ items }` was a perfectly good client source until v9; now it matches no
// arm, because every arm requires the tag. Nothing else rejects this shape.
const untaggedItems = { items: [] as TableItem[] };
// @ts-expect-error a source without `processing` matches no arm (variable form)
acceptSource(untaggedItems);
// @ts-expect-error a source without `processing` matches no arm (fresh literal)
acceptSource({ items });

// (2) The M5 shape — a server config that forgot its tag — is rejected TWICE
// OVER, and that is worth stating precisely because the migration guide got it
// wrong first. `total?: never` on the client arm already made this a compile
// error in 8.0; the required tag is a second, independent line. Measured
// 2026-08-07 in both directions: make `processing` optional and this probe
// keeps erroring (the `never` guard holds it); drop `total?: never` and it
// keeps erroring too (the tag holds it). Only removing BOTH lets it compile,
// which is what the control block at the bottom does.
const untaggedServerConfig = { items: [] as TableItem[], total: 120 };
// @ts-expect-error a source without `processing` matches no arm (variable form)
acceptSource(untaggedServerConfig);

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

// A managed source owns items/loading/error/total — v7 warned about these
// combinations in DEV and ignored the props; now none must compile, in the
// variable form as well.
//
// ONE FIELD PER PROBE, deliberately. The #165 review found three of these
// guards unpinned: `managedWithErrorTotal` below combined `error` and `total`,
// so deleting either one alone left it erroring for the other's sake, and the
// `items` probe was a fresh literal that the excess-property check would have
// caught anyway. Each of the four now goes unused when — and only when — its
// own field is deleted. Measured 2026-08-07, field by field.
const managedWithItems = { processing: 'server' as const, query, items: [] as TableItem[] };
// @ts-expect-error managed source cannot carry `items` (variable form)
acceptSource(managedWithItems);
const managedWithLoading = { processing: 'server' as const, query, loading: true };
// @ts-expect-error managed source cannot carry `loading` (variable form)
acceptSource(managedWithLoading);
const managedWithError = { processing: 'server' as const, query, error: 'boom' as string | null };
// @ts-expect-error managed source cannot carry `error` (variable form)
acceptSource(managedWithError);
const managedWithTotal = { processing: 'server' as const, query, total: 99 };
// @ts-expect-error managed source cannot carry `total` (variable form)
acceptSource(managedWithTotal);
// @ts-expect-error managed source cannot carry `loading` (fresh literal)
acceptSource({ processing: 'server', query, loading: false });

// ── Control measurement: the client arm as it stood before v9 ────────────
// Both lines removed at once — an optional tag AND no `total?: never`. This
// is the only configuration in which the M5 shape compiles, and this block
// compiling is what makes the two probes above positive controls rather than
// assertions. Measured 2026-08-07; the per-line results are in the comment on
// probe (2).
//
// Note what this does NOT claim: that 8.0 shipped the silent mode switch. It
// did not — `total?: never` caught this shape at compile time. What 8.0 had
// no answer for was the same shape reaching `resolveSource` from plain
// JavaScript, which is what the runtime guard there now handles.
interface UntaggedAndUnguarded<T> {
  processing?: 'client';
  items: T[];
  loading?: boolean;
  error?: string | null;
}
declare function acceptUntaggedAndUnguarded<T>(source: UntaggedAndUnguarded<T>): void;
acceptUntaggedAndUnguarded(untaggedServerConfig); // compiles — both lines down

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
