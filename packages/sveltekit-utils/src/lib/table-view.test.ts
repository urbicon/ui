import { describe, expect, it } from 'vitest';
import type { TableQueryFilter } from './table-query';
import {
  searchParamsToViewPartial,
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

const aFilter: TableQueryFilter = { column: 'status', operator: 'equals', value: 'open' };

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
