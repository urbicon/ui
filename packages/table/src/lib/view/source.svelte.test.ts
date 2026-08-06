// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { TableQueryResult } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';

/**
 * Runtime half of the source union, ported from the v8 spike (§7.3,
 * spike.source at 5c0f42f8): dispatch correctness and the identity-tracking
 * measurement (M2). The type-level half (excess-property guards on the
 * `kind?: never` / `total?: never` fields) lives in the svelte-check gate,
 * not here.
 */

const ITEMS = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' }
];

describe('resolveSource — dispatch', () => {
  it('a bare array is client mode', () => {
    expect(resolveSource(ITEMS)).toEqual({
      mode: 'client',
      items: ITEMS,
      loading: false,
      error: null
    });
  });

  it('an items object is client mode with pass-through loading/error', () => {
    expect(resolveSource({ items: ITEMS, loading: true, error: 'boom' })).toEqual({
      mode: 'client',
      items: ITEMS,
      loading: true,
      error: 'boom'
    });
  });

  it('kind: server is manual server mode', () => {
    expect(resolveSource({ kind: 'server', items: ITEMS, total: 120 })).toEqual({
      mode: 'server-manual',
      items: ITEMS,
      total: 120,
      loading: false,
      error: null
    });
  });

  it('a query function is managed server mode, with the debounce defaulted', () => {
    // Positive control (red seen): the resolver default changed to `?? 50`
    // → exactly this test red — the one pin on the managed-fetch default
    // (Prüfstein 22); the fetch tests all pass `debounceMs` explicitly.
    const query = async (): Promise<TableQueryResult> => ({ items: [], totalItems: 0 });
    const resolved = resolveSource({ query });
    expect(resolved.mode).toBe('server-managed');
    if (resolved.mode === 'server-managed') {
      expect(resolved.debounceMs).toBe(300);
      expect(resolved.query).toBe(query);
    }
  });
});

describe('identity tracking (M2) — per-render fresh source literals', () => {
  it('a fresh literal with a STABLE items reference does not re-run downstream readers', () => {
    let downstreamRuns = 0;
    const cleanup = $effect.root(() => {
      let renderTrigger = $state(0);
      // What a parent re-render does: a fresh `source={{ items }}` object
      // identity on every render, the items reference itself stable.
      const getSource = (): TableSource => {
        void renderTrigger;
        return { items: ITEMS };
      };
      const items = $derived(resolveSource(getSource()));
      const itemsRef = $derived(items.mode === 'server-managed' ? [] : items.items);

      $effect(() => {
        void itemsRef;
        downstreamRuns += 1;
      });
      flushSync();
      expect(downstreamRuns).toBe(1);

      renderTrigger += 1; // parent re-render
      flushSync();
    });

    // The derived re-evaluated (its input tracked renderTrigger), but its
    // VALUE is the same array reference — Svelte skips propagation, the
    // downstream effect never runs. This is the structural-derivation shield
    // that carries the fetch layer and the items ingestion.
    expect(downstreamRuns).toBe(1);
    cleanup();
  });

  it('control: a fresh items ARRAY does re-run downstream readers', () => {
    let downstreamRuns = 0;
    const cleanup = $effect.root(() => {
      let renderTrigger = $state(0);
      const getSource = (): TableSource => {
        void renderTrigger;
        return { items: [...ITEMS] }; // consumer builds the array inline
      };
      const items = $derived(resolveSource(getSource()));
      const itemsRef = $derived(items.mode === 'server-managed' ? [] : items.items);

      $effect(() => {
        void itemsRef;
        downstreamRuns += 1;
      });
      flushSync();
      renderTrigger += 1;
      flushSync();
    });

    // Fresh array identity propagates. Same contract as the v7 `items` prop:
    // the reference must be stable across renders; the union does not change
    // that — it stays the consumer-side rule (Rev. 3).
    expect(downstreamRuns).toBe(2);
    cleanup();
  });

  it('the managed-mode boolean is immune to fresh query-function identities', () => {
    let effectRuns = 0;
    const cleanup = $effect.root(() => {
      let renderTrigger = $state(0);
      const getSource = (): TableSource => {
        void renderTrigger;
        // fresh arrow on every render — the #153-regression-1 shape
        return { query: async () => ({ items: [], totalItems: 0 }) };
      };
      const isManaged = $derived(resolveSource(getSource()).mode === 'server-managed');

      $effect(() => {
        void isManaged;
        effectRuns += 1;
      });
      flushSync();
      renderTrigger += 1;
      flushSync();
    });

    // The boolean derived re-evaluates but keeps its value, so the effect
    // does not re-run — the `hasQueryFn` technique, carried over.
    expect(effectRuns).toBe(1);
    cleanup();
  });
});
