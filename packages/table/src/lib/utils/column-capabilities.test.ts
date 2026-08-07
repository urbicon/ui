import { describe, expect, it } from 'vitest';
import type { Column } from '../types';
import {
  isColumnGroupable,
  isColumnSearchable,
  isColumnSortable,
  isColumnSummable
} from './column-capabilities';

/**
 * Capability follows configuration, never the column's name.
 *
 * Until 2026-07-31 the summable decision was a regex over the column id —
 * `/^(age|salary|price|amount|count|number|projectsCompleted|rating|score)$/i` —
 * carried in three places. These cases pin what replaced it, including the two
 * failures the old rule produced in both directions, because "no more regex" is
 * not something a reader can verify by looking at the current code.
 *
 * The three siblings were added when `groupable` turned out to be answered
 * *differently* by the header menu and the filter bar's grouping tool. The
 * fix was to delete both copies rather than to compare them, so what these
 * cases pin is the rule; that only one function holds it is a property of the
 * module, not something a test can assert.
 */

const col = (over: Partial<Column> = {}): Column =>
  ({ accessor: 'x', title: 'X', ...over }) as Column;

const synthetic = (over: Record<string, unknown> = {}): Column =>
  ({ title: 'Actions', ...over }) as Column;

describe('isColumnSortable', () => {
  it('sorts by default — the flag exists to take it away', () => {
    expect(isColumnSortable(col())).toBe(true);
    expect(isColumnSortable(col({ sortable: true }))).toBe(true);
    expect(isColumnSortable(col({ sortable: false }))).toBe(false);
  });

  it('never sorts a synthetic column', () => {
    expect(isColumnSortable(synthetic())).toBe(false);
    expect(isColumnSortable(synthetic({ sortable: true }))).toBe(false);
  });
});

describe('isColumnSearchable', () => {
  it('matches by default — the flag exists to take it away', () => {
    expect(isColumnSearchable(col())).toBe(true);
    expect(isColumnSearchable(col({ searchable: true }))).toBe(true);
    expect(isColumnSearchable(col({ searchable: false }))).toBe(false);
  });

  it('never searches a synthetic column', () => {
    expect(isColumnSearchable(synthetic())).toBe(false);
    expect(isColumnSearchable(synthetic({ searchable: true }))).toBe(false);
  });
});

describe('isColumnGroupable', () => {
  it('is opt-in, unlike sorting and searching', () => {
    // The asymmetry is the point: bucketing an email or a free-text note
    // produces one group per row.
    expect(isColumnGroupable(col())).toBe(false);
    expect(isColumnGroupable(col({ groupable: true }))).toBe(true);
    expect(isColumnGroupable(col({ groupable: false }))).toBe(false);
  });

  it('falls back to sortable: true when groupable is unset', () => {
    expect(isColumnGroupable(col({ sortable: true }))).toBe(true);
    expect(isColumnGroupable(col({ sortable: false }))).toBe(false);
  });

  it('lets an explicit groupable win over sortable in both directions', () => {
    // This pair is what the two former copies disagreed on: a column with
    // `sortable: true, groupable: false` was absent from the toolbar's list
    // and offered in the header menu.
    expect(isColumnGroupable(col({ sortable: true, groupable: false }))).toBe(false);
    expect(isColumnGroupable(col({ sortable: false, groupable: true }))).toBe(true);
  });

  it('never groups a synthetic column', () => {
    expect(isColumnGroupable(synthetic())).toBe(false);
    expect(isColumnGroupable(synthetic({ groupable: true }))).toBe(false);
  });
});

describe('isColumnSummable', () => {
  describe('explicit configuration wins', () => {
    it('honours summable: true even for a text column', () => {
      expect(isColumnSummable(col({ summable: true, dataType: 'text' }))).toBe(true);
    });

    it('honours summable: false even for a number column', () => {
      expect(isColumnSummable(col({ summable: false, dataType: 'number' }))).toBe(false);
    });
  });

  describe('otherwise the declared type decides', () => {
    it('offers a summary for dataType number', () => {
      expect(isColumnSummable(col({ dataType: 'number' }))).toBe(true);
    });

    it('does not for text, date, boolean, email or url', () => {
      for (const dataType of ['text', 'date', 'boolean', 'email', 'url'] as const) {
        expect(isColumnSummable(col({ dataType })), dataType).toBe(false);
      }
    });

    it('does not when no type is declared at all', () => {
      expect(isColumnSummable(col())).toBe(false);
    });
  });

  describe('the name is not consulted — in either direction', () => {
    it('a column called "price" holding strings is not offered a sum', () => {
      // The reported failure: the menu promised an operation the data cannot
      // support, and the result was a dash indistinguishable from "no rows".
      expect(isColumnSummable(col({ accessor: 'price' }))).toBe(false);
      expect(isColumnSummable(col({ accessor: 'salary' }))).toBe(false);
      expect(isColumnSummable(col({ accessor: 'amount' }))).toBe(false);
    });

    it('a numeric column called "throughput" IS offered one', () => {
      // The mirror failure, and the one nobody reports because it presents as an
      // absent feature rather than a broken one. Nine hardcoded English nouns
      // also meant the feature did not exist for non-English column names.
      expect(isColumnSummable(col({ accessor: 'throughput', dataType: 'number' }))).toBe(true);
      expect(isColumnSummable(col({ accessor: 'umsatz', dataType: 'number' }))).toBe(true);
    });
  });

  it('never offers a summary for a synthetic column', () => {
    // No accessor means no source value to reduce — an action or checkbox
    // column. This held before the change and must keep holding: `summable:
    // true` on a synthetic column is a consumer error, not an override.
    expect(isColumnSummable({ title: 'Actions' } as Column)).toBe(false);
    expect(isColumnSummable({ title: 'Actions', summable: true } as Column)).toBe(false);
  });
});
