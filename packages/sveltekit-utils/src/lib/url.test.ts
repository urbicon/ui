/**
 * The two URL writers against the mocked `$app` trio (see src/test-support/):
 * both hand `goto` the pathname-qualified address, never a bare `?query`. The
 * assertions read `goto`'s argument verbatim rather than the URL it resolves
 * to — the two forms resolve alike here, which is how the writers came to
 * disagree without a test noticing.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { navigationLog, resetMockApp } from '../test-support/app-harness.svelte';
import { createUrlParam, updateUrlSearchParams, useUrlArrayParam, useUrlParam } from './url.svelte';

const START = 'films?sort=title&page=3';

const pageParam = createUrlParam<number>('page', {
  parse: (sp) => Number(sp.get('page') ?? '1'),
  serialize: (v) => String(v),
  initial: 1
});

beforeEach(() => {
  resetMockApp(START);
});

describe('updateUrlSearchParams', () => {
  it('navigates to the pathname-qualified address of the patch', () => {
    updateUrlSearchParams({ page: '4', tag: ['a', 'b'], sort: null });
    expect(navigationLog.targets).toEqual(['/films?page=4&tag=a&tag=b']);
  });

  it('navigates to the bare pathname once the patch empties the query', () => {
    updateUrlSearchParams({ sort: null, page: null });
    expect(navigationLog.targets).toEqual(['/films']);
  });
});

describe('createUrlParam().set', () => {
  it('rewrites only its own key, at a pathname-qualified address', () => {
    pageParam.set(4);
    expect(navigationLog.targets).toEqual(['/films?sort=title&page=4']);
  });
});

/** What `write` hands `goto` when the page is at `start`. */
function targetsFrom(start: string, write: () => void): string[] {
  resetMockApp(start);
  write();
  return [...navigationLog.targets];
}

// Each start carries a foreign param on either side of the managed key, so one
// assertion pins both that they stay and that they keep their order.
describe('a setter removes its key for an empty value', () => {
  it('useUrlArrayParam, repeat: [] removes every entry, an array fills the first slot', () => {
    const [, setTags] = useUrlArrayParam('tag', { initial: [] });
    const start = 'films?sort=x&tag=a&q=1&tag=b';

    expect(targetsFrom(start, () => setTags([]))).toEqual(['/films?sort=x&q=1']);
    expect(targetsFrom(start, () => setTags(['c', 'd']))).toEqual([
      '/films?sort=x&tag=c&tag=d&q=1'
    ]);
  });

  it('useUrlArrayParam, csv: [] removes the param, an array replaces it in place', () => {
    const [, setCats] = useUrlArrayParam('cat', { initial: [], strategy: 'csv' });
    const start = 'films?sort=x&cat=a%2Cb&q=1';

    expect(targetsFrom(start, () => setCats([]))).toEqual(['/films?sort=x&q=1']);
    expect(targetsFrom(start, () => setCats(['c', 'd']))).toEqual(['/films?sort=x&cat=c%2Cd&q=1']);
  });

  it('useUrlParam: null removes the param, a value replaces it in place', () => {
    const [, setSlug] = useUrlParam<string | null>('c', {
      parse: (sp) => sp.get('c'),
      serialize: (value) => value,
      initial: null
    });
    const start = 'films?sort=x&c=slug&q=1';

    expect(targetsFrom(start, () => setSlug(null))).toEqual(['/films?sort=x&q=1']);
    expect(targetsFrom(start, () => setSlug('other'))).toEqual(['/films?sort=x&c=other&q=1']);
  });
});

it('both writers reach the same address for the same patch', () => {
  updateUrlSearchParams(new URLSearchParams({ page: '4' }));
  const viaPatch = navigationLog.targets[0];

  resetMockApp(START);
  pageParam.set(4);

  expect(navigationLog.targets).toEqual([viaPatch]);
});
