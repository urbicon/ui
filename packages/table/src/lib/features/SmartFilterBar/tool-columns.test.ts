import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import {
  buildColumnVisibilityEntries,
  buildGroupingEntries,
  buildSortEntries,
  selectGroupableColumns,
  selectHideableColumns,
  selectSortableColumns
} from './tool-columns';

const col = (accessor: string, extra: Partial<Column> = {}): Column =>
  ({ accessor, title: accessor, ...extra }) as Column;

/** No accessor — the shape a render-only column has. */
const synthetic = (id: string, extra: Partial<Column> = {}): Column =>
  ({ id, title: id, ...extra }) as unknown as Column;

describe('selectSortableColumns', () => {
  it('takes columns that neither lack an accessor nor opt out', () => {
    const columns = [
      col('name'),
      col('role', { sortable: true }),
      col('team', { sortable: false })
    ];
    expect(selectSortableColumns(columns).map((c) => c.accessor)).toEqual(['name', 'role']);
  });

  it('drops synthetic columns — sorting by a column with no accessor is undefined', () => {
    expect(selectSortableColumns([synthetic('actions'), col('name')])).toHaveLength(1);
  });

  it('keeps a synthetic column out even when it declares itself sortable', () => {
    expect(selectSortableColumns([synthetic('actions', { sortable: true })])).toEqual([]);
  });
});

describe('selectGroupableColumns', () => {
  it('honours an explicit groupable flag over the sortable-derived default', () => {
    const columns = [
      col('name', { sortable: true, groupable: false }),
      col('team', { sortable: false, groupable: true })
    ];
    expect(selectGroupableColumns(columns).map((c) => c.accessor)).toEqual(['team']);
  });

  it('derives from sortable when groupable is unset', () => {
    const columns = [col('name', { sortable: true }), col('note')];
    expect(selectGroupableColumns(columns).map((c) => c.accessor)).toEqual(['name']);
  });

  it('never groups by a column name — `transaction` is groupable like any other', () => {
    // Regression guard for the name-guessing rule this replaced
    // (`!id.includes('action')`), which was wrong in both directions.
    const columns = [col('transaction', { sortable: true }), col('actionType', { sortable: true })];
    expect(selectGroupableColumns(columns).map((c) => c.accessor)).toEqual([
      'transaction',
      'actionType'
    ]);
  });
});

describe('buildGroupingEntries', () => {
  const columns = [col('name', { sortable: true }), col('note')];

  it('keeps the declared key listed even while nothing is grouped', () => {
    const entries = buildGroupingEntries(columns, 'day', null);
    expect(entries.map((e) => e.id)).toEqual(['name', 'day']);
    // Humanised, so the row reads like the grouping chip does.
    expect(entries.find((e) => e.id === 'day')?.label).toBe('Day');
  });

  it('lists an active key that is neither declared nor a groupable column', () => {
    expect(buildGroupingEntries(columns, null, 'note').map((e) => e.id)).toEqual(['name', 'note']);
  });

  it('prefers the real column label over the humanised id', () => {
    const labelled = [col('name', { sortable: true }), col('day', { title: 'Weekday' })];
    expect(buildGroupingEntries(labelled, 'day', null).find((e) => e.id === 'day')?.label).toBe(
      'Weekday'
    );
  });

  it('adds each fallback key once, even when declared and active agree', () => {
    expect(buildGroupingEntries(columns, 'day', 'day').filter((e) => e.id === 'day')).toHaveLength(
      1
    );
  });
});

describe('selectHideableColumns', () => {
  it('pins columns that opt out of hiding', () => {
    const columns = [col('name', { hideable: false }), col('role')];
    expect(selectHideableColumns(columns).map((c) => c.accessor)).toEqual(['role']);
  });

  it('treats an unset flag as hideable', () => {
    expect(selectHideableColumns([col('name')]).map((c) => c.accessor)).toEqual(['name']);
  });
});

describe('buildColumnVisibilityEntries', () => {
  it('carries the pinning rule through to the entry rows', () => {
    const columns = [col('name', { hideable: false }), col('role', { title: 'Role' })];
    expect(buildColumnVisibilityEntries(columns)).toEqual([{ id: 'role', label: 'Role' }]);
  });
});

describe('entries carry resolved labels', () => {
  it('falls back from menuTitle to title to the humanised id', () => {
    const columns = [
      col('name', { menuTitle: 'Full name', title: 'Name' }),
      col('role', { title: 'Role' }),
      // No title at all — the id is humanised.
      { accessor: 'teamLead' } as Column
    ];
    expect(buildSortEntries(columns)).toEqual([
      { id: 'name', label: 'Full name' },
      { id: 'role', label: 'Role' },
      { id: 'teamLead', label: 'Team Lead' }
    ]);
  });
});
