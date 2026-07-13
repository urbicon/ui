import type { TableQueryFilter, TableQueryParams } from '@urbicon-ui/sveltekit-utils/table-query';
import { describe, expect, it } from 'vitest';
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
});
