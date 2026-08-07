import type {
  TableViewFilter,
  TableViewLike,
  TableViewSnapshot as TableViewSnapshotMirror
} from '@urbicon-ui/sveltekit-utils';
import { describe, expect, it } from 'vitest';
import type { TableView, TableViewSnapshot } from '$lib/view/view.svelte';
import type { Filter } from './tableTypes';

/**
 * `@urbicon-ui/sveltekit-utils` mirrors this package's view types
 * structurally (deliberately, so it carries no dependency on
 * `@urbicon-ui/table`). This test pins the shapes together: if a mirrored
 * type gains, loses or re-types a field, the assignability assertions below
 * stop compiling and force the mirror in
 * `packages/sveltekit-utils/src/lib/table-view.ts` to be updated.
 *
 * There used to be a second pair here — `TableQuery` against
 * `TableQueryParams` — because the query spoke its own vocabulary. Since #162
 * it does not: the snapshot below IS what a managed `source.query` receives,
 * so one parity block covers both roles, and the kit's `./table-query` module
 * that held the second spelling is gone.
 *
 * The view-side mirror is the v8 structure contract: `TableViewSnapshot` must
 * be the same shape on both sides, and the real `TableView` class must be
 * usable wherever `bindViewToUrl` expects a `TableViewLike` — that
 * assignability is the entire mechanism by which the kit-side binding
 * decorates the table-side view without importing it.
 *
 * The view types are imported from the package ROOT (which re-exports
 * `./table-view`); the `./table-view` subpath is exported too, but the root
 * import keeps this file working even against an older built `dist/`.
 *
 * Note: `@urbicon-ui/sveltekit-utils` must be built (`dist/`) for its types to
 * resolve — same as this package's other workspace dev-dependencies.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Extends<A, B> = [A] extends [B] ? true : false;

describe('Filter ↔ TableViewFilter structural parity', () => {
  it('keeps Filter and TableViewFilter mutually assignable', () => {
    const filterParity: MutuallyAssignable<Filter, TableViewFilter> = true;
    expect(filterParity).toBe(true);
  });
});

describe('TableView ↔ table-view mirror structural parity', () => {
  it('keeps the two TableViewSnapshot shapes mutually assignable', () => {
    // The shape that crosses the package boundary at runtime: the URL parser
    // produces partial mirror snapshots and `applyExternal` consumes them.
    // Unpinned, a field added on one side would pass silently.
    const snapshotParity: MutuallyAssignable<TableViewSnapshot, TableViewSnapshotMirror> = true;
    expect(snapshotParity).toBe(true);
  });

  it('keeps the real TableView assignable to TableViewLike', () => {
    // One direction, deliberately: `TableViewLike` is the *surface* the URL
    // binding needs (fields, applyExternal, claims, origins), not a full
    // re-statement of the class — so the class must satisfy it, never the
    // other way around.
    const bindable: Extends<TableView, TableViewLike> = true;
    expect(bindable).toBe(true);
  });
});
