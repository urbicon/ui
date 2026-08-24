import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import {
  buildColumnVisibilityEntries,
  buildFilterEntries,
  buildGroupingEntries,
  buildSortEntries,
  buildSummaryEntries,
  selectHideableColumns,
  type ToolColumnScope
} from './tool-columns';

/**
 * What the builders do with the two column lists — not what makes a column
 * eligible. That rule lives in `utils/column-capabilities.ts` and is pinned by
 * its own suite; this file used to hold a second copy of a few of those cases
 * through two `select…Columns` wrappers that no surface ever called.
 */

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

  // Removable always, editable only when the key names a column this table
  // declared and `searchable` accepts. A filter you cannot get rid of is the
  // defect the fallback row exists for; a full add form over a field the table
  // never declared is a different one.
  describe('editable', () => {
    it('gives the full form to a column that is merely hidden', () => {
      // The #253 case: declared, filterable, off screen. Nothing about the
      // form is wrong here — the operators come from a `dataType` the consumer
      // declared and the quick values scan a field the table knows.
      const entries = buildFilterEntries(withHidden(columns, 'city'), ['city']);
      expect(entries.find((e) => e.id === 'city')?.editable).toBe(true);
    });

    it('lists a filter on an undeclared key, but read-only', () => {
      // A filter restored from prefs or a URL for a column v2 removed. The row
      // is here so it can be removed; the form is not, because there is no
      // column to derive operators from and nothing declared to enumerate.
      const entries = buildFilterEntries(scope(columns), ['created_at']);
      expect(entries.map((e) => e.id)).toEqual(['name', 'city', 'created_at']);
      expect(entries.find((e) => e.id === 'created_at')?.editable).toBe(false);
    });

    it('lists a filter on a searchable:false column, but read-only', () => {
      // The flag is an explicit opt-out. Honouring it everywhere except in the
      // section that appears *because* a filter slipped past it would make it
      // mean nothing.
      const entries = buildFilterEntries(scope(columns), ['note']);
      expect(entries.map((e) => e.id)).toEqual(['name', 'city', 'note']);
      expect(entries.find((e) => e.id === 'note')?.editable).toBe(false);
    });

    it('marks every offered column editable', () => {
      expect(buildFilterEntries(scope(columns), []).every((e) => e.editable)).toBe(true);
    });
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
