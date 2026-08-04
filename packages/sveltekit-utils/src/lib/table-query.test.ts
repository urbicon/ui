import { describe, expect, it } from 'vitest';
import {
  applyTableQueryToSearchParams,
  searchParamsToTableQuery,
  searchParamsToTableViewState,
  type TableQueryParams,
  tableQueryToSearchParams
} from './table-query';

/** Table's uncontrolled initial state — the implicit elision baseline. */
const defaultQuery: TableQueryParams = {
  page: 1,
  itemsPerPage: 10,
  sortColumn: '',
  sortDirection: 'asc',
  searchTerm: '',
  activeFilters: [],
  groupByKey: null
};

function query(overrides: Partial<TableQueryParams>): TableQueryParams {
  return { ...defaultQuery, ...overrides };
}

describe('tableQueryToSearchParams', () => {
  it('elides everything for a query in its default state', () => {
    expect(tableQueryToSearchParams(defaultQuery).toString()).toBe('');
  });

  it('elides values equal to custom defaults', () => {
    const q = query({ page: 3, itemsPerPage: 25, sortColumn: 'name', groupByKey: 'team' });
    const sp = tableQueryToSearchParams(q, {
      defaults: { page: 3, itemsPerPage: 25, sortColumn: 'name', groupByKey: 'team' }
    });
    expect(sp.toString()).toBe('');
  });

  it('writes only the non-default values in a fixed key order', () => {
    const sp = tableQueryToSearchParams(
      query({ searchTerm: 'ada', page: 2, itemsPerPage: 50, sortColumn: 'name' })
    );
    expect(sp.toString()).toBe('q=ada&page=2&size=50&sort=name');
  });

  it('writes dir only for descending sorts', () => {
    expect(tableQueryToSearchParams(query({ sortColumn: 'name' })).toString()).toBe('sort=name');
    expect(
      tableQueryToSearchParams(query({ sortColumn: 'name', sortDirection: 'desc' })).toString()
    ).toBe('sort=name&dir=desc');
  });

  it('normalizes the direction away when unsorted', () => {
    // Direction is meaningless without a column — no params, no `dir` leak.
    expect(tableQueryToSearchParams(query({ sortDirection: 'desc' })).toString()).toBe('');
  });

  it('marks "explicitly unsorted" only when the defaults specify a sort', () => {
    const sp = tableQueryToSearchParams(defaultQuery, {
      defaults: { sortColumn: 'createdAt', sortDirection: 'desc' }
    });
    expect(sp.toString()).toBe('sort=');
  });

  it('marks "explicitly ungrouped" only when the defaults specify a group', () => {
    const sp = tableQueryToSearchParams(defaultQuery, { defaults: { groupByKey: 'team' } });
    expect(sp.toString()).toBe('group=');
  });

  it('serializes filters as repeated params with encoded column and value', () => {
    const sp = tableQueryToSearchParams(
      query({
        activeFilters: [
          { column: 'status', operator: 'equals', value: 'open' },
          { column: 'meta:tag', operator: 'contains', value: 'a:b c' }
        ]
      })
    );
    expect(sp.getAll('filter')).toEqual(['status:equals:open', 'meta%3Atag:contains:a%3Ab%20c']);
  });

  it('prefixes every key when a prefix is configured', () => {
    const sp = tableQueryToSearchParams(
      query({
        searchTerm: 'ada',
        page: 2,
        sortColumn: 'name',
        sortDirection: 'desc',
        groupByKey: 'team',
        activeFilters: [{ column: 'status', operator: 'equals', value: 'open' }]
      }),
      { prefix: 't_' }
    );
    expect([...sp.keys()]).toEqual(['t_q', 't_page', 't_sort', 't_dir', 't_group', 't_filter']);
  });

  describe('write strictness', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws for invalid page %p',
      (page) => {
        expect(() => tableQueryToSearchParams(query({ page }))).toThrow(TypeError);
      }
    );

    it('throws for a non-positive itemsPerPage', () => {
      expect(() => tableQueryToSearchParams(query({ itemsPerPage: 0 }))).toThrow(TypeError);
    });

    it('throws for an invalid sort direction', () => {
      const invalid = query({ sortDirection: 'up' as unknown as 'asc' });
      expect(() => tableQueryToSearchParams(invalid)).toThrow(TypeError);
    });

    it('throws for an empty groupByKey string', () => {
      expect(() => tableQueryToSearchParams(query({ groupByKey: '' }))).toThrow(TypeError);
    });

    it('throws for an unknown filter operator', () => {
      const invalid = query({
        activeFilters: [{ column: 'a', operator: 'matches' as unknown as 'equals', value: 'x' }]
      });
      expect(() => tableQueryToSearchParams(invalid)).toThrow(TypeError);
    });

    it('throws for a filter without a column', () => {
      const invalid = query({ activeFilters: [{ column: '', operator: 'equals', value: 'x' }] });
      expect(() => tableQueryToSearchParams(invalid)).toThrow(TypeError);
    });
  });
});

describe('searchParamsToTableQuery', () => {
  it('returns the defaults for empty params', () => {
    expect(searchParamsToTableQuery(new URLSearchParams())).toEqual(defaultQuery);
    expect(
      searchParamsToTableQuery(new URLSearchParams(), {
        defaults: { page: 2, itemsPerPage: 25, sortColumn: 'name', sortDirection: 'desc' }
      })
    ).toEqual(query({ page: 2, itemsPerPage: 25, sortColumn: 'name', sortDirection: 'desc' }));
  });

  it('parses an explicit sort with implied ascending direction', () => {
    const parsed = searchParamsToTableQuery(new URLSearchParams('sort=name'), {
      defaults: { sortDirection: 'desc' }
    });
    // `dir` absent means asc — never the default direction of a different column.
    expect(parsed.sortColumn).toBe('name');
    expect(parsed.sortDirection).toBe('asc');
  });

  it('parses the explicit unsorted/ungrouped markers', () => {
    const parsed = searchParamsToTableQuery(new URLSearchParams('sort=&group='), {
      defaults: { sortColumn: 'createdAt', sortDirection: 'desc', groupByKey: 'team' }
    });
    expect(parsed.sortColumn).toBe('');
    expect(parsed.sortDirection).toBe('asc');
    expect(parsed.groupByKey).toBeNull();
  });

  describe('read tolerance', () => {
    it.each(['abc', '0', '-2', '2.5', '1e3', ''])(
      'falls back to the default page for page=%s',
      (raw) => {
        const parsed = searchParamsToTableQuery(new URLSearchParams(`page=${raw}`));
        expect(parsed.page).toBe(1);
      }
    );

    it('falls back to the default size for a non-numeric size', () => {
      expect(searchParamsToTableQuery(new URLSearchParams('size=lots')).itemsPerPage).toBe(10);
    });

    it('treats an unknown dir as ascending', () => {
      const parsed = searchParamsToTableQuery(new URLSearchParams('sort=name&dir=sideways'));
      expect(parsed.sortDirection).toBe('asc');
    });

    it('skips malformed filter entries but keeps valid ones', () => {
      const sp = new URLSearchParams();
      sp.append('filter', 'status:equals:open'); // valid
      sp.append('filter', 'broken'); // wrong shape
      sp.append('filter', 'a:matches:x'); // unknown operator
      sp.append('filter', 'a:equals:x:y'); // too many parts
      sp.append('filter', ':equals:x'); // empty column
      sp.append('filter', '%GG:equals:x'); // broken percent-encoding
      expect(searchParamsToTableQuery(sp).activeFilters).toEqual([
        { column: 'status', operator: 'equals', value: 'open' }
      ]);
    });
  });

  it('reads only its own keys when a prefix is configured', () => {
    const sp = new URLSearchParams('q=global&t_q=scoped&t_page=3');
    const parsed = searchParamsToTableQuery(sp, { prefix: 't_' });
    expect(parsed.searchTerm).toBe('scoped');
    expect(parsed.page).toBe(3);
    // Unprefixed params belong to someone else.
    expect(searchParamsToTableQuery(sp).searchTerm).toBe('global');
  });
});

describe('roundtrip', () => {
  it('serialize → parse reproduces the query exactly', () => {
    const original = query({
      page: 4,
      itemsPerPage: 50,
      sortColumn: 'amount',
      sortDirection: 'desc',
      searchTerm: 'Müller & Söhne',
      groupByKey: 'expenseType',
      activeFilters: [
        { column: 'status', operator: 'equals', value: 'open' },
        { column: 'amount', operator: 'greaterThan', value: '1000' },
        { column: 'note', operator: 'contains', value: 'a:b=c&d ä' }
      ]
    });
    const sp = tableQueryToSearchParams(original);
    expect(searchParamsToTableQuery(sp)).toEqual(original);
  });

  it('survives URL string re-parsing (real-world transport)', () => {
    const original = query({
      searchTerm: 'a&b=c',
      page: 2,
      activeFilters: [{ column: 'meta:tag', operator: 'contains', value: '50%:done' }]
    });
    const url = new URL(`https://example.test/list?${tableQueryToSearchParams(original)}`);
    expect(searchParamsToTableQuery(url.searchParams)).toEqual(original);
  });

  it('roundtrips against custom defaults', () => {
    const options = {
      defaults: { itemsPerPage: 25, sortColumn: 'createdAt', sortDirection: 'desc' }
    } as const;
    const original = query({ itemsPerPage: 25, sortColumn: 'createdAt', sortDirection: 'asc' });
    const sp = tableQueryToSearchParams(original, options);
    expect(sp.toString()).toBe('sort=createdAt');
    expect(searchParamsToTableQuery(sp, options)).toEqual(original);
  });
});

describe('applyTableQueryToSearchParams', () => {
  it('preserves unmanaged params and does not mutate the input', () => {
    const existing = new URLSearchParams('tab=billing&page=9');
    const next = applyTableQueryToSearchParams(existing, query({ page: 2 }));
    expect(next.get('tab')).toBe('billing');
    expect(next.get('page')).toBe('2');
    expect(existing.get('page')).toBe('9');
  });

  it('removes managed keys whose value returned to the default', () => {
    const existing = new URLSearchParams('q=ada&page=3&filter=status:equals:open&tab=billing');
    const next = applyTableQueryToSearchParams(existing, defaultQuery);
    expect(next.toString()).toBe('tab=billing');
  });

  it('replaces stale filters wholesale', () => {
    const existing = new URLSearchParams('filter=status:equals:open&filter=a:contains:b');
    const next = applyTableQueryToSearchParams(
      existing,
      query({ activeFilters: [{ column: 'status', operator: 'equals', value: 'closed' }] })
    );
    expect(next.getAll('filter')).toEqual(['status:equals:closed']);
  });

  it('only touches keys with the configured prefix', () => {
    const existing = new URLSearchParams('q=global&t_q=old&t_page=5');
    const next = applyTableQueryToSearchParams(existing, query({ searchTerm: 'new' }), {
      prefix: 't_'
    });
    expect(next.get('q')).toBe('global');
    expect(next.get('t_q')).toBe('new');
    expect(next.get('t_page')).toBeNull();
  });
});

describe('searchParamsToTableViewState', () => {
  /**
   * The partial twin of `searchParamsToTableQuery`, and the difference is the
   * whole point: the table's `query` prop reads by field **presence**, so an
   * object that answers every axis claims every axis. Handing it the complete
   * parser switched `persistenceConfig` and every `initial*` seed off, on any
   * URL — including one with no parameters, where each field was a default the
   * parser invented.
   */
  it('answers nothing for a URL that carries nothing', () => {
    expect(searchParamsToTableViewState(new URLSearchParams())).toEqual({});
    // The contrast that makes it worth having two functions.
    expect(Object.keys(searchParamsToTableQuery(new URLSearchParams()))).toHaveLength(7);
  });

  it('answers only the axes the URL names', () => {
    expect(searchParamsToTableViewState(new URLSearchParams('q=ada&page=3'))).toEqual({
      searchTerm: 'ada',
      page: 3
    });
  });

  it('emits sort column and direction as a pair, never one alone', () => {
    // A direction without a column is a half-controlled sort the table would
    // have to arbitrate against storage. Unrepresentable from here.
    expect(searchParamsToTableViewState(new URLSearchParams('dir=desc'))).toEqual({});
    expect(searchParamsToTableViewState(new URLSearchParams('sort=amount&dir=desc'))).toEqual({
      sortColumn: 'amount',
      sortDirection: 'desc'
    });
    expect(searchParamsToTableViewState(new URLSearchParams('sort=amount'))).toEqual({
      sortColumn: 'amount',
      sortDirection: 'asc'
    });
  });

  it('keeps an explicitly emptied axis, because emptying it is a choice', () => {
    // `?sort=` is not `?sort` missing: the reader cleared the sort, and that has
    // to outrank a stored one.
    expect(searchParamsToTableViewState(new URLSearchParams('sort='))).toEqual({
      sortColumn: '',
      sortDirection: 'asc'
    });
    expect(searchParamsToTableViewState(new URLSearchParams('group='))).toEqual({
      groupByKey: null
    });
    expect(searchParamsToTableViewState(new URLSearchParams('q='))).toEqual({ searchTerm: '' });
  });

  it('stays read-tolerant without losing the axis', () => {
    // The key was there, so the axis is controlled — the unparsable value falls
    // back to the default rather than dropping the field and handing the axis
    // back to persistence.
    expect(searchParamsToTableViewState(new URLSearchParams('page=nope'))).toEqual({ page: 1 });
    expect(
      searchParamsToTableViewState(new URLSearchParams('size=x'), {
        defaults: { itemsPerPage: 25 }
      })
    ).toEqual({ itemsPerPage: 25 });
  });

  it('skips malformed filters individually and keeps the rest', () => {
    const view = searchParamsToTableViewState(
      new URLSearchParams('filter=status:equals:open&filter=broken&filter=name:nope:x')
    );
    expect(view.activeFilters).toEqual([{ column: 'status', operator: 'equals', value: 'open' }]);
  });

  it('honours the prefix', () => {
    expect(
      searchParamsToTableViewState(new URLSearchParams('q=global&t_q=scoped'), {
        prefix: 't_'
      })
    ).toEqual({ searchTerm: 'scoped' });
  });

  it('round-trips a written query back to the same axes', () => {
    // What the table emits → URL → back. Elided defaults come back as absent,
    // which is the same statement they made going out: "no opinion".
    const written = applyTableQueryToSearchParams(
      new URLSearchParams(),
      query({ searchTerm: 'ada', sortColumn: 'amount', sortDirection: 'desc', page: 2 })
    );
    expect(searchParamsToTableViewState(written)).toEqual({
      searchTerm: 'ada',
      sortColumn: 'amount',
      sortDirection: 'desc',
      page: 2
    });
  });
});
