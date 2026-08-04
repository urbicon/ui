import type {
  TableQueryFilter,
  TableQueryParams,
  TableQueryViewState
} from '@urbicon-ui/sveltekit-utils/table-query';
import { describe, expect, it } from 'vitest';
import type { TableViewState } from '$lib/stores/TableStore.svelte';
import type { Filter, TableQuery } from './tableTypes';

/**
 * `@urbicon-ui/sveltekit-utils/table-query` mirrors `TableQuery` structurally
 * (deliberately, so it carries no dependency on this package). This test pins
 * the two shapes together: if `TableQuery` / `Filter` gain, lose or re-type a
 * field, the assignability assertions below stop compiling and force the
 * mirror in `packages/sveltekit-utils/src/lib/table-query.ts` to be updated.
 *
 * Note: `@urbicon-ui/sveltekit-utils` must be built (`dist/`) for its types to
 * resolve — same as this package's other workspace dev-dependencies.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('TableQuery ↔ TableQueryParams structural parity', () => {
  it('keeps TableQuery and TableQueryParams mutually assignable', () => {
    const queryParity: MutuallyAssignable<TableQuery, TableQueryParams> = true;
    expect(queryParity).toBe(true);
  });

  it('keeps Filter and TableQueryFilter mutually assignable', () => {
    const filterParity: MutuallyAssignable<Filter, TableQueryFilter> = true;
    expect(filterParity).toBe(true);
  });

  it('keeps TableViewState and TableQueryViewState mutually assignable', () => {
    // The partial half, and the one that actually crosses the package boundary
    // at runtime: `searchParamsToTableViewState` produces a
    // `TableQueryViewState` and it is handed straight to the table's `query`
    // prop, typed `TableViewState`. Unpinned, a field added on one side would
    // pass silently — and the tests that exercise the wiring would paper over
    // it with a cast.
    const viewParity: MutuallyAssignable<TableViewState, TableQueryViewState> = true;
    expect(viewParity).toBe(true);
  });
});
