// @vitest-environment jsdom
import { searchParamsToTableViewState } from '@urbicon-ui/sveltekit-utils/table-query';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter } from '$lib/types/tableTypes';
import { bindViewToStorage, bindViewToUrl, FakeUrl } from './bindings.svelte';
import { searchParamsToViewPartial, viewToSearchParams } from './serialize';
import { createTableView, type TableView } from './view.svelte';

/**
 * SPIKE §7.2 — binding composition: the phase contract, claims with
 * fail-loud, registration-order independence, the four wiring combinations
 * of today's `persistControlled` matrix re-expressed in the target model,
 * both variants of the open UX question, and the §3.2 format extension
 * measured against the REAL shipped read side.
 */

const aFilter: Filter = { column: 'name', operator: 'contains', value: 'ad' };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

let storage: Storage;

beforeEach(() => {
  vi.useFakeTimers();
  storage = memoryStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

const KEY = 'urbicon_table_view_comp_v1';
const storedView = (): Record<string, unknown> | null => {
  const raw = storage.getItem(KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
};
const seedStorage = (value: Record<string, unknown>) => {
  storage.setItem(KEY, JSON.stringify(value));
};

/** Drain the FakeUrl's microtask-applied goto, then let effects react. */
async function settleUrl(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

describe('claims — fail-loud composition (Prüfstein 16)', () => {
  it('two URL bindings on the same axis throw', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl(''), { axes: ['sort', 'page'] });
      expect(() => bindViewToUrl(view, new FakeUrl(''), { axes: ['page'] })).toThrow(
        /two url bindings claim the axis "page"/
      );
    });
    cleanup();
  });

  it('two URL bindings on disjoint axes are legal', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl(''), { axes: ['sort'] });
      expect(() => bindViewToUrl(view, new FakeUrl(''), { axes: ['page'] })).not.toThrow();
    });
    cleanup();
  });

  it('a URL binding and a storage binding may share an axis — that is the composition', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl(''));
      expect(() => bindViewToStorage(view, { key: 'comp', storage })).not.toThrow();
    });
    cleanup();
  });
});

describe('phase contract — defaults → URL (init, sync) → storage (post-hydration)', () => {
  it('URL init applies synchronously, before any effect has run', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl('?sort=amount&dir=desc&q=ada'));
      // No flushSync yet — this is what SSR sees.
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('ada');
      expect(view.page).toBe(1); // unnamed axis keeps its default
    });
    cleanup();
  });

  it('storage applies only after hydration, and only to axes the URL did not name at init', () => {
    seedStorage({ sort: { column: 'name', direction: 'asc' }, search: 'stored' });
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, new FakeUrl('?sort=amount&dir=desc'));
      bindViewToStorage(view, { key: 'comp', storage });

      // Before hydration: URL yes, storage no — the client's first render
      // agrees with the server's HTML.
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('');

      flushSync(); // hydration boundary

      // After: the URL-named axis stands (URL > storage), the unnamed one is
      // seeded from storage.
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });
      expect(view.search).toBe('stored');
    });
    cleanup();
  });

  it('registration order does not matter — storage before URL yields the same result', () => {
    const run = (order: 'url-first' | 'storage-first'): { sort: unknown; search: string } => {
      const local = memoryStorage();
      local.setItem(
        KEY,
        JSON.stringify({ sort: { column: 'name', direction: 'asc' }, search: 'stored' })
      );
      let result = { sort: undefined as unknown, search: '' };
      const cleanup = $effect.root(() => {
        const view = createTableView();
        if (order === 'url-first') {
          bindViewToUrl(view, new FakeUrl('?sort=amount&dir=desc'));
          bindViewToStorage(view, { key: 'comp', storage: local });
        } else {
          bindViewToStorage(view, { key: 'comp', storage: local });
          bindViewToUrl(view, new FakeUrl('?sort=amount&dir=desc'));
        }
        flushSync();
        result = { sort: view.sort, search: view.search };
      });
      cleanup();
      return result;
    };

    // The decision which axes storage may seed is taken in the hydration
    // effect — after every init claim is registered — so both orders agree.
    expect(run('storage-first')).toEqual(run('url-first'));
    expect(run('storage-first')).toEqual({
      sort: { column: 'amount', direction: 'desc' },
      search: 'stored'
    });
  });

  it('“stored empty is a real state”: a stored null sort beats a non-empty default after hydration', () => {
    seedStorage({ sort: null });
    const cleanup = $effect.root(() => {
      const view = createTableView({
        defaults: { sort: { column: 'date', direction: 'desc' } }
      });
      bindViewToStorage(view, { key: 'comp', storage });
      expect(view.sort).toEqual({ column: 'date', direction: 'desc' }); // first render
      flushSync();
      expect(view.sort).toBeNull(); // the cleared state the reader chose
    });
    cleanup();
  });

  it('“empty is a value” on the URL: ?sort= with a default sort renders unsorted, synchronously', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView({
        defaults: { sort: { column: 'date', direction: 'desc' } }
      });
      bindViewToUrl(view, new FakeUrl('?sort='));
      expect(view.sort).toBeNull();
    });
    cleanup();
  });
});

describe('the four wiring combinations (today’s persistControlled matrix, §7.2)', () => {
  it('1 — no bindings: changes stay in the view, nothing is written anywhere', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      view.sort = { column: 'name', direction: 'asc' };
      flushSync();
    });
    vi.advanceTimersByTime(1000);
    expect(storage.length).toBe(0);
    cleanup();
  });

  it('2 — URL only: a user change reaches the URL after the debounce; storage stays empty', async () => {
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 300 });
      flushSync();
      view.sort = { column: 'amount', direction: 'desc' };
      flushSync();
    });
    vi.advanceTimersByTime(300);
    await settleUrl();

    expect(url.search).toBe('sort=amount&dir=desc');
    expect(storage.length).toBe(0);
    cleanup();
  });

  it('3 — URL + storage: a user change reaches both; a linked-in view stores nothing (Prüfstein 4)', async () => {
    const url = new FakeUrl('?q=linked');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 300 });
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 300 });
      flushSync(); // hydration — the linked-in `q` was applied at init, external

      view.filters = [aFilter]; // the reader's own change
      flushSync();
    });
    vi.advanceTimersByTime(300);
    await settleUrl();

    // The reader's filter is in both places…
    expect(url.search).toContain('filter=name%3Acontains%3Aad');
    expect(storedView()).toEqual({ filters: [aFilter] });
    // …the linked-in search is in neither storage nor lost from the URL.
    expect(storedView()).not.toHaveProperty('search');
    expect(url.search).toContain('q=linked');
    cleanup();
  });

  it('4 — storage only: today’s persistence behaviour (write on change, hydrate on load)', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 300 });
      flushSync();
      view.groupBy = 'status';
      flushSync();
    });
    vi.advanceTimersByTime(300);
    expect(storedView()).toEqual({ groupBy: 'status' });
    cleanup();

    // Second visit.
    const cleanup2 = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 300 });
      flushSync();
      expect(view.groupBy).toBe('status');
    });
    cleanup2();
  });
});

describe('back button (Prüfstein 2/17)', () => {
  it('navigating back to a bare URL restores the DEFAULT, not the storage value', async () => {
    seedStorage({ sort: { column: 'amount', direction: 'desc' } });
    const url = new FakeUrl('');
    let view!: TableView;
    const cleanup = $effect.root(() => {
      view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100, replaceState: false });
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 100 });
      flushSync(); // hydration: storage seeds the sort (URL named nothing)
      expect(view.sort).toEqual({ column: 'amount', direction: 'desc' });

      view.page = 2; // an interaction pushes a history entry carrying the seed
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();
    expect(url.search).toBe('page=2&sort=amount&dir=desc');
    expect(url.pushCount).toBe(1);

    url.back(); // → bare URL
    flushSync();

    // Runtime absence on a bound axis means "default" — storage does NOT
    // re-apply (it applies exactly once, at hydration).
    expect(view.sort).toBeNull();
    expect(view.page).toBe(1);
    // And the back navigation stored nothing (origin external).
    vi.advanceTimersByTime(200);
    expect(storedView()).toEqual({ sort: { column: 'amount', direction: 'desc' } });
    cleanup();
  });
});

describe('open UX question — mirroring a storage seed into the URL (§3.3)', () => {
  it('reflectExternal: false (today’s behaviour): the URL stays bare until the first interaction, which then carries the seed', async () => {
    seedStorage({ sort: { column: 'amount', direction: 'desc' } });
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100, reflectExternal: false });
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 100 });
      flushSync(); // seed applied (external)
    });
    vi.advanceTimersByTime(300);
    await settleUrl();
    expect(url.search).toBe(''); // address bar untouched — nothing to share yet
    expect(url.gotoCount).toBe(0);
    cleanup();

    // Variant with an interaction after the seed:
    const url2 = new FakeUrl('');
    const cleanup2 = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url2, { debounceMs: 100, reflectExternal: false });
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 100 });
      flushSync();
      view.page = 2;
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();
    // The full snapshot is serialized, so the seed piggybacks on the first
    // interaction — exactly today's semantics.
    expect(url2.search).toBe('page=2&sort=amount&dir=desc');
    cleanup2();
  });

  it('reflectExternal: true: the seed reaches the URL immediately, via replaceState — shareable without interaction', async () => {
    seedStorage({ sort: { column: 'amount', direction: 'desc' } });
    const url = new FakeUrl('');
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToUrl(view, url, { debounceMs: 100, reflectExternal: true });
      bindViewToStorage(view, { key: 'comp', storage, debounceMs: 100 });
      flushSync();
    });
    vi.advanceTimersByTime(100);
    await settleUrl();
    expect(url.search).toBe('sort=amount&dir=desc');
    expect(url.pushCount).toBe(0); // replaceState — no history entry appeared
    cleanup();
  });
});

describe('format extension — the empty filter marker (Prüfstein 8/23)', () => {
  it('a cleared filter set against non-empty defaults writes `filter=`', () => {
    const view = createTableView({ defaults: { filters: [aFilter] } });
    const sp = viewToSearchParams({ ...view.snapshot(), filters: [] }, view.defaults);
    expect(sp.toString()).toBe('filter=');
  });

  it('a cleared filter set against empty defaults elides — like every other axis', () => {
    const view = createTableView();
    const sp = viewToSearchParams(view.snapshot(), view.defaults);
    expect(sp.toString()).toBe('');
  });

  it('the SHIPPED read side already parses the marker as “claimed, empty”', () => {
    // The compatibility measurement: today's parser in sveltekit-utils treats
    // `filter=` as a present axis whose malformed entries are skipped — which
    // is exactly "claimed as empty". Old readers of new URLs stay correct.
    const parsed = searchParamsToTableViewState(new URLSearchParams('filter='));
    expect(parsed.activeFilters).toEqual([]);
    expect(Object.keys(parsed)).toEqual(['activeFilters']);
  });

  it('the spike read side round-trips the marker', () => {
    const partial = searchParamsToViewPartial(new URLSearchParams('filter='));
    expect(partial.filters).toEqual([]);
    expect(Object.keys(partial)).toEqual(['filters']);
  });

  it('an unbound axis never reaches the URL, whatever the view holds', () => {
    const view = createTableView();
    view.sort = { column: 'amount', direction: 'desc' };
    view.page = 3;
    // A binding restricted to page must not serialize the sort.
    const sp = viewToSearchParams(view.snapshot(), view.defaults, ['page']);
    expect(sp.toString()).toBe('page=3');
  });

  it('elision baseline is the view defaults, structurally (Prüfstein 7)', () => {
    const view = createTableView({
      defaults: { pageSize: 25, sort: { column: 'date', direction: 'desc' } }
    });
    // Default state ⇒ empty URL.
    expect(viewToSearchParams(view.snapshot(), view.defaults).toString()).toBe('');
    // Deviation on one axis ⇒ exactly that axis.
    view.pageSize = 50;
    expect(viewToSearchParams(view.snapshot(), view.defaults).toString()).toBe('size=50');
  });
});
