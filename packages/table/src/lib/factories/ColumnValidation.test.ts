import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import { ColumnValidation } from './ColumnValidation';

describe('ColumnValidation.validateColumn', () => {
  it('accepts a regular data column', () => {
    const column: Column = { accessor: 'name', title: 'Name' };
    expect(ColumnValidation.validateColumn(column)).toEqual({ isValid: true, errors: [] });
  });

  it('accepts an icon-only synthetic column with empty title (documented actions idiom)', () => {
    const column: Column = { id: 'actions', title: '' };
    expect(ColumnValidation.validateColumn(column)).toEqual({ isValid: true, errors: [] });
  });

  it('rejects a column whose title is not a string', () => {
    const column = { id: 'broken', title: 42 } as unknown as Column;
    const result = ColumnValidation.validateColumn(column);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('`title`'))).toBe(true);
  });

  it('rejects a column without a title', () => {
    const column = { id: 'untitled' } as unknown as Column;
    const result = ColumnValidation.validateColumn(column);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('`title`'))).toBe(true);
  });
});

describe('ColumnValidation.validateColumns', () => {
  it('passes a typical column set ending in an untitled actions column', () => {
    const columns: Column[] = [
      { accessor: 'name', title: 'Name' },
      { accessor: 'status', title: 'Status' },
      { id: 'actions', title: '' }
    ];
    expect(ColumnValidation.validateColumns(columns)).toEqual({ isValid: true, errors: [] });
  });

  it('still reports duplicate ids', () => {
    const columns: Column[] = [
      { accessor: 'name', title: 'Name' },
      { id: 'name', accessor: () => '', title: 'Name 2' }
    ];
    const result = ColumnValidation.validateColumns(columns);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate column id'))).toBe(true);
  });
});
