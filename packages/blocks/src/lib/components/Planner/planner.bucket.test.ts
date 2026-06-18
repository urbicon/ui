import { describe, expect, it } from 'vitest';
import { bucketItemsByDate, toDateKey } from './planner.bucket';

interface Meal {
  id: string;
  date: string | Date;
  order: number;
}

describe('toDateKey', () => {
  it('reduces a Date to its local calendar day', () => {
    // 16 Jun 2026, 23:30 local — the local day must win, not a UTC shift.
    expect(toDateKey(new Date(2026, 5, 16, 23, 30))).toBe('2026-06-16');
  });

  it('takes the date part of a local ISO string verbatim (no UTC parse)', () => {
    // Parsing '2026-06-16' as a Date reads UTC midnight and shifts a day west of
    // Greenwich. Slicing keeps the authored day regardless of the test timezone.
    expect(toDateKey('2026-06-16')).toBe('2026-06-16');
  });

  it('slices a date-time ISO string to its date part', () => {
    expect(toDateKey('2026-06-16T14:00:00Z')).toBe('2026-06-16');
    expect(toDateKey('2026-12-31T23:59:59+02:00')).toBe('2026-12-31');
  });

  it('handles year boundaries from a Date', () => {
    expect(toDateKey(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
    expect(toDateKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });
});

describe('bucketItemsByDate', () => {
  it('groups items by their local day in input order', () => {
    const items: Meal[] = [
      { id: 'a', date: '2026-06-16', order: 2 },
      { id: 'b', date: '2026-06-16', order: 1 },
      { id: 'c', date: '2026-06-17', order: 1 }
    ];
    const buckets = bucketItemsByDate(items, (m) => m.date);
    expect([...buckets.keys()]).toEqual(['2026-06-16', '2026-06-17']);
    expect(buckets.get('2026-06-16')!.map((m) => m.id)).toEqual(['a', 'b']);
    expect(buckets.get('2026-06-17')!.map((m) => m.id)).toEqual(['c']);
  });

  it('sorts each bucket in place when a comparator is given', () => {
    const items: Meal[] = [
      { id: 'a', date: '2026-06-16', order: 3 },
      { id: 'b', date: '2026-06-16', order: 1 },
      { id: 'c', date: '2026-06-16', order: 2 }
    ];
    const buckets = bucketItemsByDate(
      items,
      (m) => m.date,
      (x, y) => x.order - y.order
    );
    expect(buckets.get('2026-06-16')!.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('buckets Date and string inputs onto the same key', () => {
    const items: Meal[] = [
      { id: 'a', date: new Date(2026, 5, 16, 8) },
      { id: 'b', date: '2026-06-16' }
    ].map((m, i) => ({ ...m, order: i }));
    const buckets = bucketItemsByDate(items, (m) => m.date);
    expect(buckets.size).toBe(1);
    expect(buckets.get('2026-06-16')!.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('omits days with no items', () => {
    const buckets = bucketItemsByDate(
      [{ id: 'a', date: '2026-06-16', order: 0 }] as Meal[],
      (m) => m.date
    );
    expect(buckets.has('2026-06-15')).toBe(false);
    expect(buckets.has('2026-06-17')).toBe(false);
  });

  it('returns an empty map for no items', () => {
    expect(bucketItemsByDate([] as Meal[], (m) => m.date).size).toBe(0);
  });
});
