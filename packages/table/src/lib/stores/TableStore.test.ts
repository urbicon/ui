import { describe, expect, it } from 'vitest';
import { calculateSummary, getNestedValue, groupItems, matchesFilter } from '$lib/utils';

const sampleItems = [
  { id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, salary: 45000, department: 'Design' },
  { id: 3, name: 'Charlie', age: 35, salary: 60000, department: 'Engineering' },
  { id: 4, name: 'Diana', age: 28, salary: 52000, department: 'Marketing' },
  { id: 5, name: 'Eve', age: 32, salary: 48000, department: 'Design' }
];

describe('calculateSummary', () => {
  it('calculates sum correctly', () => {
    const result = calculateSummary(sampleItems, [{ column: 'salary', type: 'sum' }]);
    expect(result.salary).toBe(255000);
  });

  it('calculates average correctly', () => {
    const result = calculateSummary(sampleItems, [{ column: 'age', type: 'avg' }]);
    expect(result.age).toBe(30);
  });

  it('calculates count correctly', () => {
    const result = calculateSummary(sampleItems, [{ column: 'name', type: 'count' }]);
    expect(result.name).toBe(5);
  });

  it('calculates min correctly', () => {
    const result = calculateSummary(sampleItems, [{ column: 'age', type: 'min' }]);
    expect(result.age).toBe(25);
  });

  it('calculates max correctly', () => {
    const result = calculateSummary(sampleItems, [{ column: 'salary', type: 'max' }]);
    expect(result.salary).toBe(60000);
  });

  it('handles multiple configs at once', () => {
    const result = calculateSummary(sampleItems, [
      { column: 'salary', type: 'sum' },
      { column: 'age', type: 'avg' },
      { column: 'name', type: 'count' }
    ]);
    expect(result.salary).toBe(255000);
    expect(result.age).toBe(30);
    expect(result.name).toBe(5);
  });

  it('returns NaN for empty items (no value, not a false zero)', () => {
    const result = calculateSummary([], [{ column: 'salary', type: 'sum' }]);
    expect(result.salary).toBeNaN();
  });

  it('skips non-numeric values for numeric operations', () => {
    const items = [
      { id: 1, value: 10 },
      { id: 2, value: 'not a number' },
      { id: 3, value: 20 }
    ];
    const result = calculateSummary(items, [{ column: 'value', type: 'sum' }]);
    expect(result.value).toBe(30);
  });

  it('skips null and undefined values', () => {
    const items = [
      { id: 1, value: 10 },
      { id: 2, value: null },
      { id: 3, value: undefined },
      { id: 4, value: 20 }
    ];
    const result = calculateSummary(items, [{ column: 'value', type: 'count' }]);
    expect(result.value).toBe(2);
  });

  it('honours a custom getValue resolver (column-aware lookup)', () => {
    const items = [
      { id: 1, stats: { score: 80 } },
      { id: 2, stats: { score: 90 } },
      { id: 3, stats: { score: 70 } }
    ];
    const result = calculateSummary(
      items,
      [{ column: 'score', type: 'avg' }],
      (item) => (item as { stats: { score: number } }).stats.score
    );
    expect(result.score).toBe(80);
  });

  it('handles nested column keys via the default getNestedValue fallback', () => {
    const items = [
      { id: 1, stats: { score: 80 } },
      { id: 2, stats: { score: 90 } },
      { id: 3, stats: { score: 70 } }
    ];
    const result = calculateSummary(items, [{ column: 'stats.score', type: 'avg' }]);
    expect(result['stats.score']).toBe(80);
  });
});

describe('matchesFilter', () => {
  it('matches "contains" operator', () => {
    expect(matchesFilter('Hello World', 'world', 'contains')).toBe(true);
    expect(matchesFilter('Hello World', 'xyz', 'contains')).toBe(false);
  });

  it('matches "equals" operator (case-insensitive)', () => {
    expect(matchesFilter('Active', 'active', 'equals')).toBe(true);
    expect(matchesFilter('Active', 'inactive', 'equals')).toBe(false);
  });

  it('matches "startsWith" operator', () => {
    expect(matchesFilter('Engineering', 'eng', 'startsWith')).toBe(true);
    expect(matchesFilter('Engineering', 'design', 'startsWith')).toBe(false);
  });

  it('matches "endsWith" operator', () => {
    expect(matchesFilter('Engineering', 'ring', 'endsWith')).toBe(true);
    expect(matchesFilter('Engineering', 'sign', 'endsWith')).toBe(false);
  });

  it('matches "greaterThan" operator numerically', () => {
    expect(matchesFilter('50', '30', 'greaterThan')).toBe(true);
    expect(matchesFilter('20', '30', 'greaterThan')).toBe(false);
  });

  it('matches "lessThan" operator numerically', () => {
    expect(matchesFilter('20', '30', 'lessThan')).toBe(true);
    expect(matchesFilter('50', '30', 'lessThan')).toBe(false);
  });

  it('excludes rows for unknown operators (fail-loud, not silent pass-through)', () => {
    expect(matchesFilter('any', 'value', 'unknownOp')).toBe(false);
  });
});

describe('getNestedValue', () => {
  it('walks dot-notation paths', () => {
    const item = { user: { name: 'Alice', addr: { city: 'Berlin' } } };
    expect(getNestedValue(item, 'user.name')).toBe('Alice');
    expect(getNestedValue(item, 'user.addr.city')).toBe('Berlin');
  });

  it('returns undefined for missing paths', () => {
    expect(getNestedValue({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(getNestedValue(null, 'a')).toBeUndefined();
  });
});

describe('column visibility logic', () => {
  // The column-visibility concern keys hidden columns by their resolved id;
  // a small inline `Column`-like shape is enough to exercise the filter logic
  // without standing up the whole TableStore.
  const allColumns = [
    { id: 'name', title: 'Name' },
    { id: 'age', title: 'Age' },
    { id: 'department', title: 'Department' },
    { id: 'salary', title: 'Salary' }
  ];

  function getVisibleColumns(columns: typeof allColumns, hiddenIds: Set<string>) {
    return columns.filter((col) => !hiddenIds.has(col.id));
  }

  it('shows all columns when nothing is hidden', () => {
    const visible = getVisibleColumns(allColumns, new Set());
    expect(visible).toHaveLength(4);
  });

  it('hides a single column', () => {
    const visible = getVisibleColumns(allColumns, new Set(['salary']));
    expect(visible).toHaveLength(3);
    expect(visible.find((c) => c.id === 'salary')).toBeUndefined();
  });

  it('hides multiple columns', () => {
    const visible = getVisibleColumns(allColumns, new Set(['salary', 'age']));
    expect(visible).toHaveLength(2);
    expect(visible.map((c) => c.id)).toEqual(['name', 'department']);
  });

  it('toggle: hiding then showing restores the column', () => {
    const hidden = new Set<string>();
    hidden.add('age');
    expect(getVisibleColumns(allColumns, hidden)).toHaveLength(3);

    hidden.delete('age');
    expect(getVisibleColumns(allColumns, hidden)).toHaveLength(4);
  });

  it('showAll: clearing hidden set restores all columns', () => {
    const hidden = new Set(['name', 'age', 'department']);
    expect(getVisibleColumns(allColumns, hidden)).toHaveLength(1);

    hidden.clear();
    expect(getVisibleColumns(allColumns, hidden)).toHaveLength(4);
  });
});

describe('grouping with summary', () => {
  it('groups items and calculates per-group summary', () => {
    const columns = [{ accessor: 'department' as const, title: 'Department' }];
    const grouped = groupItems(sampleItems, columns, 'department');
    expect(Object.keys(grouped)).toContain('Engineering');
    expect(Object.keys(grouped)).toContain('Design');
    expect(Object.keys(grouped)).toContain('Marketing');

    const engSummary = calculateSummary(grouped.Engineering, [{ column: 'salary', type: 'sum' }]);
    expect(engSummary.salary).toBe(110000);

    const designSummary = calculateSummary(grouped.Design, [{ column: 'salary', type: 'avg' }]);
    expect(designSummary.salary).toBe(46500);
  });

  it('groups by a function-accessor column (computed value)', () => {
    type Row = { id: number; name: string; dept: { code: string } };
    const items: Row[] = [
      { id: 1, name: 'Alice', dept: { code: 'ENG' } },
      { id: 2, name: 'Bob', dept: { code: 'DES' } },
      { id: 3, name: 'Charlie', dept: { code: 'ENG' } }
    ];
    const columns = [{ id: 'deptCode', accessor: (r: Row) => r.dept.code, title: 'Dept' }];
    const grouped = groupItems(items, columns, 'deptCode');
    expect(grouped.ENG).toHaveLength(2);
    expect(grouped.DES).toHaveLength(1);
  });
});
