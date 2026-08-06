import { describe, expect, it } from 'vitest';
import type { TableViewFilter } from './table-view';
import {
  applyViewToSearchParams,
  assertValidViewSnapshot,
  searchParamsToViewPartial,
  searchParamsToViewSnapshot,
  type TableViewSnapshot,
  viewAxesNamedBy,
  viewSnapshotToSearchParams
} from './table-view';

/**
 * The view vocabulary's (de)serialization — the pure half of the URL binding
 * (`view-binding.svelte.test.ts` covers the reactive half). Pins the two
 * things the binding's phase contract leans on: the empty `filter=` marker
 * as a *claimed-as-empty* state (the compatible format extension), and
 * `viewAxesNamedBy` as the presence oracle behind "init absence means
 * unclaimed", with and without a prefix.
 */

const aFilter: TableViewFilter = { column: 'status', operator: 'equals', value: 'open' };

const baseDefaults: TableViewSnapshot = {
  search: '',
  sort: null,
  page: 1,
  pageSize: 10,
  filters: [],
  groupBy: null
};

const snapshot = (overrides: Partial<TableViewSnapshot> = {}): TableViewSnapshot => ({
  ...baseDefaults,
  ...overrides
});

describe('the empty filter marker — claimed as empty, not absent', () => {
  it('parses `filter=` as an empty filter list that claims the axis', () => {
    const partial = searchParamsToViewPartial(new URLSearchParams('filter='), baseDefaults);
    expect(partial.filters).toEqual([]); // present — not `undefined`
    expect(viewAxesNamedBy(new URLSearchParams('filter='))).toContain('filters');
  });

  it('writes the marker only against filtering defaults — a defaultless clear elides', () => {
    const filtering: TableViewSnapshot = { ...baseDefaults, filters: [aFilter] };
    // Cleared against a filtering default: the marker is the only way the
    // URL can say "no filters" without falling back to the defaults.
    expect(viewSnapshotToSearchParams(snapshot(), filtering).toString()).toBe('filter=');
    // Cleared against an already-empty default: nothing to say, full elision.
    expect(viewSnapshotToSearchParams(snapshot(), baseDefaults).toString()).toBe('');
  });

  it('round-trips: the written marker reads back as the claimed-empty state', () => {
    const filtering: TableViewSnapshot = { ...baseDefaults, filters: [aFilter] };
    const sp = viewSnapshotToSearchParams(snapshot(), filtering);
    const partial = searchParamsToViewPartial(sp, filtering);
    expect(partial.filters).toEqual([]);
  });
});

describe('viewAxesNamedBy — the presence oracle', () => {
  it('names exactly the axes the URL carries, in vocabulary order', () => {
    expect(viewAxesNamedBy(new URLSearchParams('q=ada&sort=name&filter='))).toEqual([
      'search',
      'sort',
      'filters'
    ]);
    expect(viewAxesNamedBy(new URLSearchParams('page=2&size=25&group=team'))).toEqual([
      'page',
      'pageSize',
      'groupBy'
    ]);
    expect(viewAxesNamedBy(new URLSearchParams())).toEqual([]);
  });

  it('with a prefix, only prefixed keys count — foreign and unprefixed ones are invisible', () => {
    const sp = new URLSearchParams('t_q=ada&q=foreign&t_group=team&page=3');
    expect(viewAxesNamedBy(sp, 't_')).toEqual(['search', 'groupBy']);
    // …and the prefixless reading sees the complementary slice.
    expect(viewAxesNamedBy(sp)).toEqual(['search', 'page']);
  });
});

describe('the load path resolves against the view defaults, not a second spelling', () => {
  /**
   * `searchParamsToViewSnapshot` takes the *same* defaults object the
   * component hands `createTableView`, and — since the query and view
   * vocabularies were unified (#162) — hands back the very shape a managed
   * `source.query` receives. The retired wire-vocabulary parser took its
   * baseline in a second spelling with no filter field at all, so the two
   * assertions below are what that spelling could not express.
   */
  it('an absent param resolves to the view default, in view vocabulary', () => {
    const query = searchParamsToViewSnapshot(new URLSearchParams('q=ada'), {
      pageSize: 25,
      sort: { column: 'date', direction: 'desc' },
      groupBy: 'team'
    });
    expect(query).toEqual({
      page: 1,
      pageSize: 25,
      sort: { column: 'date', direction: 'desc' },
      search: 'ada',
      filters: [],
      groupBy: 'team'
    });
  });

  it('carries a default filter set — the axis the wire defaults had no field for', () => {
    const query = searchParamsToViewSnapshot(new URLSearchParams(), { filters: [aFilter] });
    expect(query.filters).toEqual([aFilter]);

    // …and the empty marker still means "explicitly none", not "unset".
    expect(
      searchParamsToViewSnapshot(new URLSearchParams('filter='), { filters: [aFilter] }).filters
    ).toEqual([]);
  });

  it('resolves the same view a URL binding would apply at init', () => {
    const defaults = { pageSize: 25, sort: { column: 'date', direction: 'desc' as const } };
    const sp = new URLSearchParams('page=3&sort=');
    const resolved = searchParamsToViewSnapshot(sp, defaults);
    expect(resolved).toEqual({
      search: '',
      sort: null, // `sort=` — explicitly unsorted beats the default
      page: 3,
      pageSize: 25,
      filters: [],
      groupBy: null
    });
  });
});

describe('filter parsing — garbage is dropped element-wise', () => {
  it('keeps valid entries, skips malformed ones, and still claims the axis', () => {
    const sp = new URLSearchParams();
    sp.append('filter', 'status:equals:open'); // valid
    sp.append('filter', 'garbage'); // not column:operator:value
    sp.append('filter', 'name:matches:x'); // operator not in the whitelist
    sp.append('filter', '%GG:contains:x'); // decodeURIComponent throws

    const partial = searchParamsToViewPartial(sp, baseDefaults);
    expect(partial.filters).toEqual([aFilter]); // the survivors, not `undefined`
  });

  it('an all-garbage filter list claims the axis as empty', () => {
    const sp = new URLSearchParams('filter=nonsense');
    const partial = searchParamsToViewPartial(sp, baseDefaults);
    expect(partial.filters).toEqual([]);
  });
});

describe('roundtrip: serialize → parse reproduces the view exactly', () => {
  // Ported from the retired `table-query` suite, whose codec these two
  // functions absorbed when the wire and view vocabularies were unified
  // (#162). The transport cases are the point: `:` separators and `&` inside
  // a search term or a filter value have to survive the URL, not just the
  // `URLSearchParams` object.
  it('carries every axis through, including separators and non-ASCII', () => {
    const original = snapshot({
      page: 4,
      pageSize: 50,
      sort: { column: 'amount', direction: 'desc' },
      search: 'Müller & Söhne',
      groupBy: 'expenseType',
      filters: [
        { column: 'status', operator: 'equals', value: 'open' },
        { column: 'amount', operator: 'greaterThan', value: '1000' },
        { column: 'note', operator: 'contains', value: 'a:b=c&d ä' }
      ]
    });
    const sp = viewSnapshotToSearchParams(original, baseDefaults);
    expect(searchParamsToViewSnapshot(sp)).toEqual(original);
  });

  it('survives URL string re-parsing (real-world transport)', () => {
    const original = snapshot({
      search: 'a&b=c',
      page: 2,
      filters: [{ column: 'meta:tag', operator: 'contains', value: '50%:done' }]
    });
    const url = new URL(
      `https://example.test/list?${viewSnapshotToSearchParams(original, baseDefaults)}`
    );
    expect(searchParamsToViewSnapshot(url.searchParams)).toEqual(original);
  });

  it('roundtrips against custom defaults', () => {
    const defaults: TableViewSnapshot = {
      ...baseDefaults,
      pageSize: 25,
      sort: { column: 'createdAt', direction: 'desc' }
    };
    const original = snapshot({ pageSize: 25, sort: { column: 'createdAt', direction: 'asc' } });
    const sp = viewSnapshotToSearchParams(original, defaults);
    expect(sp.toString()).toBe('sort=createdAt');
    expect(searchParamsToViewSnapshot(sp, defaults)).toEqual(original);
  });
});

describe('assertValidViewSnapshot — the write-strict half', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws for invalid page %p',
    (page) => {
      expect(() => assertValidViewSnapshot(snapshot({ page }))).toThrow(TypeError);
    }
  );

  it('throws for a non-positive pageSize', () => {
    expect(() => assertValidViewSnapshot(snapshot({ pageSize: 0 }))).toThrow(TypeError);
  });

  it('throws for an invalid sort direction', () => {
    const invalid = snapshot({
      sort: { column: 'name', direction: 'up' as unknown as 'asc' }
    });
    expect(() => assertValidViewSnapshot(invalid)).toThrow(TypeError);
  });

  it('throws for a sort with an empty column — `null` is how you say unsorted', () => {
    // The axis the v8 vocabulary made unrepresentable at the type level but
    // that a cast still reaches: `{ column: '', direction }` is the v7 empty
    // sentinel, and it would serialize as the "explicitly unsorted" marker
    // while claiming to be a sort.
    expect(() =>
      assertValidViewSnapshot(snapshot({ sort: { column: '', direction: 'asc' } }))
    ).toThrow(TypeError);
  });

  it('accepts a null sort', () => {
    expect(() => assertValidViewSnapshot(snapshot({ sort: null }))).not.toThrow();
  });

  it('throws for an empty groupBy string', () => {
    expect(() => assertValidViewSnapshot(snapshot({ groupBy: '' }))).toThrow(TypeError);
  });

  it('throws for an unknown filter operator', () => {
    const invalid = snapshot({
      filters: [{ column: 'a', operator: 'matches' as unknown as 'equals', value: 'x' }]
    });
    expect(() => assertValidViewSnapshot(invalid)).toThrow(TypeError);
  });

  it('throws for a filter without a column', () => {
    const invalid = snapshot({ filters: [{ column: '', operator: 'equals', value: 'x' }] });
    expect(() => assertValidViewSnapshot(invalid)).toThrow(TypeError);
  });

  it('is NOT applied by the binding serializer — a bad page costs a URL, not the page', () => {
    // The deliberate asymmetry: `viewSnapshotToSearchParams` runs inside the
    // URL binding on every view change, so it must not throw over a
    // `view.page = 0` a consumer wrote.
    expect(() => viewSnapshotToSearchParams(snapshot({ page: 0 }), baseDefaults)).not.toThrow();
  });
});

describe('applyViewToSearchParams — merge into existing params', () => {
  it('preserves unmanaged params and does not mutate the input', () => {
    const existing = new URLSearchParams('tab=billing&page=9');
    const next = applyViewToSearchParams(existing, snapshot({ page: 2 }), baseDefaults);
    expect(next.get('tab')).toBe('billing');
    expect(next.get('page')).toBe('2');
    expect(existing.get('page')).toBe('9');
  });

  it('removes managed keys whose axis returned to its default', () => {
    const existing = new URLSearchParams('q=ada&page=3&filter=status:equals:open&tab=billing');
    const next = applyViewToSearchParams(existing, snapshot(), baseDefaults);
    expect(next.toString()).toBe('tab=billing');
  });

  it('replaces stale filters wholesale', () => {
    const existing = new URLSearchParams('filter=status:equals:open&filter=a:contains:b');
    const next = applyViewToSearchParams(
      existing,
      snapshot({ filters: [{ column: 'status', operator: 'equals', value: 'closed' }] }),
      baseDefaults
    );
    expect(next.getAll('filter')).toEqual(['status:equals:closed']);
  });

  it('only touches keys with the configured prefix', () => {
    const existing = new URLSearchParams('q=global&t_q=old&t_page=5');
    const next = applyViewToSearchParams(
      existing,
      snapshot({ search: 'new' }),
      baseDefaults,
      undefined,
      't_'
    );
    expect(next.get('q')).toBe('global');
    expect(next.get('t_q')).toBe('new');
    expect(next.get('t_page')).toBeNull();
  });

  it('leaves an unbound axis alone in the existing params', () => {
    // What the axis argument buys over the retired wholesale merge: a table
    // that binds only search must not clear a `page` another binding owns.
    const existing = new URLSearchParams('q=old&page=7');
    const next = applyViewToSearchParams(
      existing,
      snapshot({ search: 'new', page: 2 }),
      baseDefaults,
      ['search']
    );
    expect(next.get('q')).toBe('new');
    expect(next.get('page')).toBe('7');
  });
});

describe('serialization details the roundtrip only reaches implicitly', () => {
  // Also ported from the retired `table-query` suite. The roundtrip above
  // proves the pair agrees with itself; these pin what actually lands in the
  // URL, which is what a hand-written deep link and a backend both read.
  it('writes only the non-default values, in a fixed key order', () => {
    const sp = viewSnapshotToSearchParams(
      snapshot({
        search: 'ada',
        page: 2,
        pageSize: 50,
        sort: { column: 'name', direction: 'asc' }
      }),
      baseDefaults
    );
    expect(sp.toString()).toBe('q=ada&page=2&size=50&sort=name');
  });

  it('writes dir only for descending sorts', () => {
    expect(
      viewSnapshotToSearchParams(
        snapshot({ sort: { column: 'name', direction: 'asc' } }),
        baseDefaults
      ).toString()
    ).toBe('sort=name');
    expect(
      viewSnapshotToSearchParams(
        snapshot({ sort: { column: 'name', direction: 'desc' } }),
        baseDefaults
      ).toString()
    ).toBe('sort=name&dir=desc');
  });

  it('marks "explicitly unsorted" only when the defaults specify a sort', () => {
    const sorting: TableViewSnapshot = {
      ...baseDefaults,
      sort: { column: 'createdAt', direction: 'desc' }
    };
    expect(viewSnapshotToSearchParams(snapshot(), sorting).toString()).toBe('sort=');
    // A null sort against a null default has nothing to say.
    expect(viewSnapshotToSearchParams(snapshot(), baseDefaults).toString()).toBe('');
  });

  it('marks "explicitly ungrouped" only when the defaults specify a group', () => {
    const grouping: TableViewSnapshot = { ...baseDefaults, groupBy: 'team' };
    expect(viewSnapshotToSearchParams(snapshot(), grouping).toString()).toBe('group=');
  });

  it('serializes filters as repeated params with encoded column and value', () => {
    const sp = viewSnapshotToSearchParams(
      snapshot({
        filters: [
          { column: 'status', operator: 'equals', value: 'open' },
          { column: 'meta:tag', operator: 'contains', value: 'a:b c' }
        ]
      }),
      baseDefaults
    );
    expect(sp.getAll('filter')).toEqual(['status:equals:open', 'meta%3Atag:contains:a%3Ab%20c']);
  });

  it('prefixes every key when a prefix is configured', () => {
    const sp = viewSnapshotToSearchParams(
      snapshot({
        search: 'ada',
        page: 2,
        sort: { column: 'name', direction: 'desc' },
        groupBy: 'team',
        filters: [{ column: 'status', operator: 'equals', value: 'open' }]
      }),
      baseDefaults,
      undefined,
      't_'
    );
    expect([...sp.keys()]).toEqual(['t_q', 't_page', 't_sort', 't_dir', 't_group', 't_filter']);
  });
});

describe('read tolerance — an unparsable value never throws', () => {
  it.each(['abc', '0', '-2', '2.5', '1e3', ''])(
    'falls back to the default page for page=%s',
    (raw) => {
      expect(searchParamsToViewSnapshot(new URLSearchParams(`page=${raw}`)).page).toBe(1);
    }
  );

  it('falls back to the default size for a non-numeric size', () => {
    expect(searchParamsToViewSnapshot(new URLSearchParams('size=lots')).pageSize).toBe(10);
  });

  it('treats an unknown dir as ascending', () => {
    const parsed = searchParamsToViewSnapshot(new URLSearchParams('sort=name&dir=sideways'));
    expect(parsed.sort).toEqual({ column: 'name', direction: 'asc' });
  });

  it('skips malformed filter entries but keeps valid ones', () => {
    const sp = new URLSearchParams();
    sp.append('filter', 'status:equals:open'); // valid
    sp.append('filter', 'broken'); // wrong shape
    sp.append('filter', 'a:matches:x'); // unknown operator
    sp.append('filter', 'a:equals:x:y'); // too many parts
    sp.append('filter', ':equals:x'); // empty column
    sp.append('filter', '%GG:equals:x'); // broken percent-encoding
    expect(searchParamsToViewSnapshot(sp).filters).toEqual([aFilter]);
  });

  it('reads only its own keys when a prefix is configured', () => {
    const sp = new URLSearchParams('q=global&t_q=scoped&t_page=3');
    const parsed = searchParamsToViewSnapshot(sp, {}, 't_');
    expect(parsed.search).toBe('scoped');
    expect(parsed.page).toBe(3);
    // Unprefixed params belong to someone else.
    expect(searchParamsToViewSnapshot(sp).search).toBe('global');
  });
});
