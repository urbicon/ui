/**
 * The two URL writers against the mocked `$app` trio (see src/test-support/):
 * both hand `goto` the pathname-qualified address, never a bare `?query`. The
 * assertions read `goto`'s argument verbatim rather than the URL it resolves
 * to — the two forms resolve alike here, which is how the writers came to
 * disagree without a test noticing.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { navigationLog, resetMockApp } from '../test-support/app-harness.svelte';
import { createUrlParam, updateUrlSearchParams } from './url.svelte';

const START = 'films?sort=title&page=3';

const pageParam = createUrlParam<number>('page', {
  parse: (sp) => Number(sp.get('page') ?? '1'),
  serialize: (v) => new URLSearchParams({ page: String(v) }),
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
  it('rewrites only the serialized keys, at a pathname-qualified address', () => {
    pageParam.set(4);
    expect(navigationLog.targets).toEqual(['/films?sort=title&page=4']);
  });
});

it('both writers reach the same address for the same patch', () => {
  updateUrlSearchParams(new URLSearchParams({ page: '4' }));
  const viaPatch = navigationLog.targets[0];

  resetMockApp(START);
  pageParam.set(4);

  expect(navigationLog.targets).toEqual([viaPatch]);
});
