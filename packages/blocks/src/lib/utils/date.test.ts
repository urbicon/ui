import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coerceToDate, fromDateInputValue, toDateInputValue } from './date';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('coerceToDate', () => {
  it('returns Date instance unchanged', () => {
    const d = new Date(2026, 2, 15);
    expect(coerceToDate(d)).toBe(d);
  });

  it('returns undefined and warns for Invalid Date instance', () => {
    expect(coerceToDate(new Date('invalid'))).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid Date instance'),
      expect.any(Object)
    );
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const result = coerceToDate('2026-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(0);
  });

  it('tolerates 1-digit month/day (canonicalised before the strict isoToDate parse)', () => {
    const result = coerceToDate('2026-6-5');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(5);
  });

  it('parses full ISO timestamp through native Date', () => {
    const result = coerceToDate('2026-03-15T12:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(new Date('2026-03-15T12:00:00Z').getTime());
  });

  it('returns undefined for empty / whitespace strings', () => {
    expect(coerceToDate('')).toBeUndefined();
    expect(coerceToDate('   ')).toBeUndefined();
    expect(coerceToDate(null)).toBeUndefined();
    expect(coerceToDate(undefined)).toBeUndefined();
  });

  it('returns undefined and warns for unparseable strings', () => {
    expect(coerceToDate('foo')).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns undefined for out-of-range date-only strings', () => {
    expect(coerceToDate('2026-02-30')).toBeUndefined();
    expect(coerceToDate('2026-13-01')).toBeUndefined();
  });

  it('rejects ambiguous small numbers (year/day mistaken for epoch ms)', () => {
    expect(coerceToDate(42)).toBeUndefined();
    expect(coerceToDate(2026)).toBeUndefined();
    expect(coerceToDate(0)).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('accepts legitimate epoch ms (modern date)', () => {
    const ts = new Date(2026, 2, 15).getTime();
    const result = coerceToDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });

  it('accepts pre-2001 epoch ms (e.g. 1995 birthday)', () => {
    const ts = new Date(1995, 5, 15).getTime();
    const result = coerceToDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(1995);
  });

  it('accepts negative epoch ms (pre-1970)', () => {
    const ts = new Date(1965, 0, 1).getTime();
    expect(ts).toBeLessThan(0);
    const result = coerceToDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(1965);
  });

  it('rejects NaN and Infinity numbers', () => {
    expect(coerceToDate(NaN)).toBeUndefined();
    expect(coerceToDate(Infinity)).toBeUndefined();
    expect(coerceToDate(-Infinity)).toBeUndefined();
  });
});

describe('toDateInputValue', () => {
  it('formats as YYYY-MM-DD in local timezone', () => {
    expect(toDateInputValue(new Date(2026, 2, 15))).toBe('2026-03-15');
    expect(toDateInputValue(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('returns empty for null/undefined', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
  });
});

describe('fromDateInputValue', () => {
  it('parses YYYY-MM-DD as local midnight (matches toDateInputValue round-trip)', () => {
    const original = new Date(2026, 2, 15);
    const iso = toDateInputValue(original);
    const parsed = fromDateInputValue(iso);
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(2);
    expect(parsed!.getDate()).toBe(15);
  });

  it('tolerates 1-digit month/day (canonicalised before the strict isoToDate parse)', () => {
    const parsed = fromDateInputValue('2026-6-5');
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(5);
    expect(parsed!.getDate()).toBe(5);
  });

  it('returns null for empty / whitespace', () => {
    expect(fromDateInputValue('')).toBeNull();
    expect(fromDateInputValue('   ')).toBeNull();
    expect(fromDateInputValue(null)).toBeNull();
  });

  it('returns null and warns for out-of-range YYYY-MM-DD', () => {
    expect(fromDateInputValue('2026-02-30')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('out-of-range date-only'),
      expect.any(Object)
    );
  });

  it('returns null and warns for unparseable input', () => {
    expect(fromDateInputValue('not-a-date')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not parse'),
      expect.any(Object)
    );
  });

  it('parses full ISO timestamp via native Date', () => {
    const result = fromDateInputValue('2026-03-15T12:00:00Z');
    expect(result!.getTime()).toBe(new Date('2026-03-15T12:00:00Z').getTime());
  });
});
