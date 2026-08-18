import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import {
  findColumnById,
  formatCellValue,
  getNestedValue,
  groupItems,
  normalizeItems,
  normalizeSummaryConfigs,
  resolveColumnLabel,
  splitSearchSegments
} from './index';

describe('resolveColumnLabel', () => {
  it('prefers menuTitle over title', () => {
    const column: Column = { id: 'actions', title: '', menuTitle: 'Aktionen' };
    expect(resolveColumnLabel(column)).toBe('Aktionen');
  });

  it('uses title when no menuTitle is set', () => {
    const column: Column = { accessor: 'name', title: 'Name' };
    expect(resolveColumnLabel(column)).toBe('Name');
  });

  it('humanizes the id when title is empty (icon-only columns)', () => {
    expect(resolveColumnLabel({ id: 'actions', title: '' })).toBe('Actions');
    expect(resolveColumnLabel({ id: 'quickActions', title: '' })).toBe('Quick Actions');
    expect(resolveColumnLabel({ id: 'quick-actions', title: '' })).toBe('Quick Actions');
    expect(resolveColumnLabel({ id: 'quick_actions', title: '' })).toBe('Quick Actions');
  });

  it('humanizes the implicit string-accessor id', () => {
    const column: Column = { accessor: 'createdAt', title: '' };
    expect(resolveColumnLabel(column)).toBe('Created At');
  });

  it('never returns an empty label for a resolvable column', () => {
    expect(resolveColumnLabel({ id: 'x', title: '' })).toBe('X');
  });
});

describe('findColumnById', () => {
  // Also the engine behind TableProvider's DEV warn for a view sort column
  // that matches no column (the Provider effect itself needs render infra).
  const columns: Column[] = [
    { accessor: 'name', title: 'Name' },
    { id: 'deptCode', accessor: () => 'x', title: 'Dept' },
    { id: 'actions', title: '' }
  ];

  it('resolves string-accessor, explicit-id, and synthetic columns', () => {
    expect(findColumnById(columns, 'name')).toBe(columns[0]);
    expect(findColumnById(columns, 'deptCode')).toBe(columns[1]);
    expect(findColumnById(columns, 'actions')).toBe(columns[2]);
  });

  it('returns undefined for an unknown id (seeded-sort warn path)', () => {
    expect(findColumnById(columns, 'salary')).toBeUndefined();
    expect(findColumnById([], 'name')).toBeUndefined();
  });
});

describe('getNestedValue', () => {
  it('returns a top-level value', () => {
    expect(getNestedValue({ name: 'Alice' }, 'name')).toBe('Alice');
  });

  it('resolves dot-notation paths', () => {
    const item = { address: { city: 'Berlin' } };
    expect(getNestedValue(item, 'address.city')).toBe('Berlin');
  });

  it('returns undefined for missing keys', () => {
    expect(getNestedValue({ name: 'Alice' }, 'age')).toBeUndefined();
  });

  it('returns undefined for null/undefined item', () => {
    expect(getNestedValue(null, 'name')).toBeUndefined();
    expect(getNestedValue(undefined, 'name')).toBeUndefined();
  });

  it('returns undefined for empty key', () => {
    expect(getNestedValue({ name: 'Alice' }, '')).toBeUndefined();
  });

  it('handles deeply nested paths', () => {
    const item = { a: { b: { c: { d: 42 } } } };
    expect(getNestedValue(item, 'a.b.c.d')).toBe(42);
  });

  it('returns undefined when intermediate is null', () => {
    const item = { a: { b: null } };
    expect(getNestedValue(item, 'a.b.c')).toBeUndefined();
  });
});

describe('formatCellValue', () => {
  it('returns string representation of primitive values', () => {
    const col: Column = { accessor: 'name', title: 'Name' };
    expect(formatCellValue({ name: 'Alice' }, col, 'en')).toBe('Alice');
    expect(formatCellValue({ name: 42 }, col, 'en')).toBe('42');
  });

  it('returns empty string for null/undefined values', () => {
    const col: Column = { accessor: 'name', title: 'Name' };
    expect(formatCellValue({ name: null }, col, 'en')).toBe('');
    expect(formatCellValue({ name: undefined }, col, 'en')).toBe('');
    expect(formatCellValue({}, col, 'en')).toBe('');
  });

  it('formats booleans as Yes/No', () => {
    const col: Column = { accessor: 'active', title: 'Active' };
    expect(formatCellValue({ active: true }, col, 'en')).toBe('Yes');
    expect(formatCellValue({ active: false }, col, 'en')).toBe('No');
  });

  it('uses custom formatter when provided', () => {
    const col: Column = {
      accessor: 'price',
      title: 'Price',
      formatter: (v) => `$${Number(v).toFixed(2)}`
    };
    expect(formatCellValue({ price: 9.5 }, col, 'en')).toBe('$9.50');
  });

  it('formats a Date in the locale it is given, not the host locale', () => {
    // The default path for a plain `Date` column — no `component: DateCell`
    // needed, so this is what most tables actually render. It used to call
    // `toLocaleDateString()` with no argument, which follows the *runtime*
    // locale: the server process on one side of hydration, the browser on the
    // other. Two locales, asserted against each other, so the test cannot pass
    // by accident on a host that happens to match.
    const col: Column = { accessor: 'created', title: 'Created' };
    const item = { created: new Date('2026-03-12T10:30:00Z') };

    expect(formatCellValue(item, col, 'de-DE')).toBe('12.3.2026');
    expect(formatCellValue(item, col, 'en-US')).toBe('3/12/2026');
  });

  it('still reports an unparseable Date rather than formatting it', () => {
    const col: Column = { accessor: 'created', title: 'Created' };
    expect(formatCellValue({ created: new Date('nonsense') }, col, 'en')).toBe('Invalid Date');
  });

  it('falls back to default when formatter returns null', () => {
    const col: Column = {
      accessor: 'name',
      title: 'Name',
      formatter: () => null
    };
    expect(formatCellValue({ name: 'Alice' }, col, 'en')).toBe('Alice');
  });

  it('uses a function accessor when defined', () => {
    const col: Column<{ user: { name: string } }> = {
      id: 'userName',
      accessor: (item) => item.user.name,
      title: 'Name'
    };
    expect(formatCellValue({ user: { name: 'Alice' } }, col, 'en')).toBe('Alice');
  });
});

describe('groupItems', () => {
  type Row = { id: number; status?: string; name: string };
  const items: Row[] = [
    { id: 1, status: 'active', name: 'A' },
    { id: 2, status: 'inactive', name: 'B' },
    { id: 3, status: 'active', name: 'C' }
  ];
  const columns: Column<Row>[] = [{ accessor: 'status', title: 'Status' }];

  it('returns all items under "ungrouped" when key is null', () => {
    const result = groupItems(items, columns, null);
    expect(result).toHaveProperty('ungrouped');
    expect(result.ungrouped).toHaveLength(3);
  });

  it('groups items by a given column id', () => {
    const result = groupItems(items, columns, 'status');
    expect(Object.keys(result)).toContain('active');
    expect(Object.keys(result)).toContain('inactive');
    expect(result.active).toHaveLength(2);
    expect(result.inactive).toHaveLength(1);
  });

  it('assigns "Unassigned" for items with undefined group value', () => {
    const itemsWithMissing: Row[] = [...items, { id: 4, name: 'D' }];
    const result = groupItems(itemsWithMissing, columns, 'status');
    expect(result.Unassigned).toHaveLength(1);
    expect(result.Unassigned[0].name).toBe('D');
  });
});

describe('normalizeItems', () => {
  it('preserves items that already have an id', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    const result = normalizeItems(items);
    expect(result[0]).toBe(items[0]);
    expect(result[1]).toBe(items[1]);
    expect(result[0]).not.toHaveProperty('__index');
  });

  it('adds __index to items without id', () => {
    const items = [{ name: 'Alice' }, { name: 'Bob' }];
    const result = normalizeItems(items);
    expect((result[0] as unknown as { __index: number }).__index).toBe(0);
    expect((result[1] as unknown as { __index: number }).__index).toBe(1);
    expect(result[0].name).toBe('Alice');
  });

  it('handles mixed items (some with id, some without)', () => {
    const items = [{ id: 'a', name: 'Alice' }, { name: 'Bob' }, { id: 42, name: 'Charlie' }];
    const result = normalizeItems(items);
    expect(result[0]).toBe(items[0]);
    expect(result[0]).not.toHaveProperty('__index');
    expect((result[1] as unknown as { __index: number }).__index).toBe(1);
    expect(result[2]).toBe(items[2]);
    expect(result[2]).not.toHaveProperty('__index');
  });

  it('returns empty array for empty input', () => {
    expect(normalizeItems([])).toEqual([]);
  });

  it('preserves id: 0 as a valid id (does not assign __index)', () => {
    const items = [{ id: 0, name: 'Zero' }];
    const result = normalizeItems(items);
    expect(result[0]).toBe(items[0]);
    expect(result[0]).not.toHaveProperty('__index');
  });
});

describe('normalizeSummaryConfigs', () => {
  it('collapses duplicates last-wins, keeping the first occurrence position', () => {
    const result = normalizeSummaryConfigs([
      { column: 'age', type: 'sum' },
      { column: 'salary', type: 'count' },
      { column: 'age', type: 'avg' }
    ]);
    expect(result).toEqual([
      { column: 'age', type: 'avg' },
      { column: 'salary', type: 'count' }
    ]);
  });

  it('returns a fresh array even when nothing collapses', () => {
    // The seed path relies on this: the consumer's defaults array must never
    // alias the state.
    const input = [{ column: 'age', type: 'sum' as const }];
    const result = normalizeSummaryConfigs(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('passes an empty set through', () => {
    expect(normalizeSummaryConfigs([])).toEqual([]);
  });
});

describe('splitSearchSegments', () => {
  it('returns single unhighlighted segment when no search term', () => {
    const result = splitSearchSegments('Hello World', '');
    expect(result).toEqual([{ text: 'Hello World', highlighted: false }]);
  });

  it('returns single unhighlighted segment when no text', () => {
    const result = splitSearchSegments('', 'search');
    expect(result).toEqual([{ text: '', highlighted: false }]);
  });

  it('highlights a single match', () => {
    const result = splitSearchSegments('Hello World', 'World');
    expect(result).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'World', highlighted: true }
    ]);
  });

  it('highlights case-insensitively', () => {
    const result = splitSearchSegments('Hello World', 'world');
    expect(result).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'World', highlighted: true }
    ]);
  });

  it('highlights multiple occurrences', () => {
    const result = splitSearchSegments('foo bar foo', 'foo');
    expect(result).toEqual([
      { text: 'foo', highlighted: true },
      { text: ' bar ', highlighted: false },
      { text: 'foo', highlighted: true }
    ]);
  });

  it('highlights the entire text when it equals the search term', () => {
    const result = splitSearchSegments('test', 'test');
    expect(result).toEqual([{ text: 'test', highlighted: true }]);
  });

  it('returns unhighlighted text when search term is not found', () => {
    const result = splitSearchSegments('Hello World', 'xyz');
    expect(result).toEqual([{ text: 'Hello World', highlighted: false }]);
  });

  it('escapes regex special characters in search term', () => {
    const result = splitSearchSegments('price is $10.00', '$10.00');
    expect(result).toEqual([
      { text: 'price is ', highlighted: false },
      { text: '$10.00', highlighted: true }
    ]);
  });

  it('handles search term at the start of text', () => {
    const result = splitSearchSegments('Hello World', 'Hello');
    expect(result).toEqual([
      { text: 'Hello', highlighted: true },
      { text: ' World', highlighted: false }
    ]);
  });

  it('handles adjacent matches without gaps', () => {
    const result = splitSearchSegments('aaa', 'a');
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.highlighted)).toBe(true);
  });
});
