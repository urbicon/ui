import { describe, expect, it } from 'vitest';
import type { Column } from '../types';
import { isColumnSummable } from './summable';

/**
 * Capability follows configuration, never the column's name.
 *
 * Until 2026-07-31 this decision was a regex over the column id —
 * `/^(age|salary|price|amount|count|number|projectsCompleted|rating|score)$/i` —
 * carried in three places. These cases pin what replaced it, including the two
 * failures the old rule produced in both directions, because "no more regex" is
 * not something a reader can verify by looking at the current code.
 */

const col = (over: Partial<Column> = {}): Column =>
  ({ accessor: 'x', title: 'X', ...over }) as Column;

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
