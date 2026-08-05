/**
 * SPIKE §7.3 — type-level measurements against the real compiler. This file
 * is *checked*, never executed: every `@ts-expect-error` here is a claim that
 * the compiler rejects the line — and svelte-check fails when one stops
 * erroring, so each probe carries its own positive control.
 *
 * The headline measurement (M5/Prüfstein 19): `{ items, total }` must be a
 * type error with AND without a fresh literal. Excess-property checks only
 * fire on fresh literals, so the variable-assignment probes below are the
 * ones that prove the `total?: never` guard is load-bearing — `NaiveClient`
 * models the union *without* the guard, and its probe compiles, which is the
 * measured failure the guards exist for.
 */
import type { TableItem, TableQuery, TableQueryResult } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';

declare const items: Array<{ id: number; name: string }>;
declare const query: (q: TableQuery, o: { signal: AbortSignal }) => Promise<TableQueryResult>;

declare function acceptSource<T extends TableItem>(source: TableSource<T>): void;

// ── The four intended shapes all pass ─────────────────────────────────────
acceptSource(items);
acceptSource({ items });
acceptSource({ items, loading: true, error: null });
acceptSource({ kind: 'server', items, total: 120 });
acceptSource({ kind: 'server', items, total: 120, loading: false });
acceptSource({ query });
acceptSource({ query, debounceMs: 500 });

// ── Prüfstein 19: the silent mode switch is a type error ──────────────────

// Fresh literal — excess-property check catches it even without the guards.
// @ts-expect-error `total` without `kind: 'server'` must not compile
acceptSource({ items, total: 120 });

// Variable assignment — excess-property checks do NOT fire here; only the
// `total?: never` guard rejects it. This is the probe that measures M5.
const informativeTotal = { items: [] as TableItem[], total: 120 };
// @ts-expect-error `total` without `kind: 'server'` must not compile (variable form)
acceptSource(informativeTotal);

// `kind: 'server'` without `total` is incomplete server config.
// @ts-expect-error server source requires `total`
acceptSource({ kind: 'server', items });

// A managed source owns the data — handing it items too must not compile.
// @ts-expect-error managed source cannot carry `items`
acceptSource({ query, items });

// ── Control measurement: the union WITHOUT the never-guards lets the silent
// mode switch through on variable assignment. This block compiling is the
// *measured defect*, not an oversight — remove the guards from TableSource
// and the two @ts-expect-error probes above start failing the check.
interface NaiveClient<T extends TableItem> {
  items: T[];
  loading?: boolean;
  error?: string | null;
}
type NaiveSource<T extends TableItem> = T[] | NaiveClient<T>;
declare function acceptNaive<T extends TableItem>(source: NaiveSource<T>): void;
acceptNaive(informativeTotal); // compiles — the silent switch M5 warns about

// ── TS ergonomics under generics (§7.3): narrowing survives the generic ───
export function genericConsumer<T extends TableItem>(source: TableSource<T>): T[] {
  const resolved = resolveSource(source);
  if (resolved.mode === 'server-managed') {
    // narrowed: no items on the managed arm
    return [];
  }
  // narrowed: both remaining arms carry items
  return resolved.items;
}
