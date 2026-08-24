import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import {
  buildColumnVisibilityEntries,
  buildFilterEntries,
  buildGroupingEntries,
  buildSortEntries,
  buildSummaryEntries,
  selectGroupableColumns,
  selectHideableColumns,
  selectSortableColumns,
  type ToolColumnScope
} from './tool-columns';

const col = (accessor: string, extra: Partial<Column> = {}): Column =>
  ({ accessor, title: accessor, ...extra }) as Column;

/** No accessor — the shape a render-only column has. */
const synthetic = (id: string, extra: Partial<Column> = {}): Column =>
  ({ id, title: id, ...extra }) as unknown as Column;

/**
 * A scope with nothing hidden — `visible` and `declared` agree, which is every
 * table until the visibility tool is used. The hidden case passes both.
 */
const scope = (visible: Column[], declared: Column[] = visible): ToolColumnScope => ({
  visible,
  declared
});

/** A scope where `hide` has been taken off screen but is still declared. */
const withHidden = (declared: Column[], hiddenId: string): ToolColumnScope => ({
  visible: declared.filter((c) => (c.id ?? c.accessor) !== hiddenId),
  declared
});

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

describe('buildSortEntries', () => {
  const columns = [col('name'), col('city', { title: 'Location' }), synthetic('actions')];

  it('offers the sortable visible columns and nothing else', () => {
    expect(buildSortEntries(scope(columns), null).map((e) => e.id)).toEqual(['name', 'city']);
  });

  it('keeps the sorted column listed after it is hidden, under its real name', () => {
    const entries = buildSortEntries(withHidden(columns, 'city'), 'city');
    expect(entries.map((e) => e.id)).toEqual(['name', 'city']);
    // Resolved over the declared set — the visible one would degrade this to
    // the humanised "City" and disagree with the chip beside it.
    expect(entries.find((e) => e.id === 'city')?.label).toBe('Location');
  });

  it('adds no fallback row for a column that is still on screen', () => {
    expect(buildSortEntries(scope(columns), 'city').filter((e) => e.id === 'city')).toHaveLength(1);
  });

  it('adds no row while nothing is sorted', () => {
    expect(buildSortEntries(withHidden(columns, 'city'), null).map((e) => e.id)).toEqual(['name']);
  });
});

describe('buildFilterEntries', () => {
  const columns = [
    col('name'),
    col('city', { title: 'Location' }),
    col('note', { searchable: false })
  ];

  it('offers the searchable visible columns', () => {
    expect(buildFilterEntries(scope(columns), []).map((e) => e.id)).toEqual(['name', 'city']);
  });

  it('keeps a filtered column listed after it is hidden', () => {
    const entries = buildFilterEntries(withHidden(columns, 'city'), ['city']);
    expect(entries.map((e) => e.id)).toEqual(['name', 'city']);
    expect(entries.find((e) => e.id === 'city')?.label).toBe('Location');
  });

  it('gives a column one section however many filters it carries', () => {
    // A column takes any number of filters at once; the panel groups them
    // under one heading, so the entry list must dedup.
    const entries = buildFilterEntries(withHidden(columns, 'city'), ['city', 'city', 'city']);
    expect(entries.filter((e) => e.id === 'city')).toHaveLength(1);
  });

  it('lists a filter on a column that opted out of searching, once it is running', () => {
    // `searchable: false` keeps a column out of the offer, but a filter can
    // still reach it through the view axis (URL, storage, defaults) — and an
    // unremovable filter is worse than an unexpected section.
    expect(buildFilterEntries(scope(columns), ['note']).map((e) => e.id)).toEqual([
      'name',
      'city',
      'note'
    ]);
  });
});

describe('buildSummaryEntries', () => {
  const columns = [
    col('name'),
    col('amount', { title: 'Amount', dataType: 'number' }),
    col('price', { dataType: 'number' })
  ];

  it('offers the summable visible columns', () => {
    expect(buildSummaryEntries(scope(columns), []).map((e) => e.id)).toEqual(['amount', 'price']);
  });

  it('keeps a configured column listed after it is hidden', () => {
    const entries = buildSummaryEntries(withHidden(columns, 'amount'), ['amount']);
    expect(entries.map((e) => e.id)).toEqual(['price', 'amount']);
    expect(entries.find((e) => e.id === 'amount')?.label).toBe('Amount');
  });

  it('adds no fallback row for a configured column that is still on screen', () => {
    expect(
      buildSummaryEntries(scope(columns), ['amount']).filter((e) => e.id === 'amount')
    ).toHaveLength(1);
  });

  it('lists a configuration on a non-summable column, which setSummaryConfigs allows', () => {
    expect(buildSummaryEntries(scope(columns), ['name']).map((e) => e.id)).toEqual([
      'amount',
      'price',
      'name'
    ]);
  });
});

describe('buildGroupingEntries', () => {
  const columns = [col('name', { sortable: true }), col('note')];

  it('keeps the declared key listed even while nothing is grouped', () => {
    const entries = buildGroupingEntries(scope(columns), 'day', null);
    expect(entries.map((e) => e.id)).toEqual(['name', 'day']);
    // Humanised, so the row reads like the grouping chip does.
    expect(entries.find((e) => e.id === 'day')?.label).toBe('Day');
  });

  it('lists an active key that is neither declared nor a groupable column', () => {
    expect(buildGroupingEntries(scope(columns), null, 'note').map((e) => e.id)).toEqual([
      'name',
      'note'
    ]);
  });

  it('prefers the real column label over the humanised id', () => {
    const labelled = [col('name', { sortable: true }), col('day', { title: 'Weekday' })];
    expect(
      buildGroupingEntries(scope(labelled), 'day', null).find((e) => e.id === 'day')?.label
    ).toBe('Weekday');
  });

  it('keeps the real label when the grouped column is merely hidden', () => {
    const labelled = [col('name', { sortable: true }), col('day', { title: 'Weekday' })];
    expect(
      buildGroupingEntries(withHidden(labelled, 'day'), null, 'day').find((e) => e.id === 'day')
        ?.label
    ).toBe('Weekday');
  });

  it('adds each fallback key once, even when declared and active agree', () => {
    expect(
      buildGroupingEntries(scope(columns), 'day', 'day').filter((e) => e.id === 'day')
    ).toHaveLength(1);
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
    expect(buildSortEntries(scope(columns), null)).toEqual([
      { id: 'name', label: 'Full name' },
      { id: 'role', label: 'Role' },
      { id: 'teamLead', label: 'Team Lead' }
    ]);
  });

  it('humanises a fallback key that matches no column at all, on every axis', () => {
    // Persisted state can name a column the definition has since dropped, and
    // grouping accepts any item field. Neither is an error; both must read as
    // a name rather than a raw key.
    const columns = [col('name', { sortable: true, dataType: 'number' })];
    const s = scope(columns);
    expect(buildSortEntries(s, 'created_at').at(-1)?.label).toBe('Created At');
    expect(buildFilterEntries(s, ['created_at']).at(-1)?.label).toBe('Created At');
    expect(buildSummaryEntries(s, ['created_at']).at(-1)?.label).toBe('Created At');
    expect(buildGroupingEntries(s, null, 'created_at').at(-1)?.label).toBe('Created At');
  });
});
