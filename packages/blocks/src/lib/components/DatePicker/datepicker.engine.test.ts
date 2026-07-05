import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDateInput,
  formatDateRangeInput,
  isDateAllowed,
  parseDateInput,
  parseDateRangeInput
} from './datepicker.engine';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatDateInput', () => {
  it('formats with de-DE default mask', () => {
    expect(formatDateInput(new Date(2026, 2, 15), 'de-DE')).toBe('15.03.2026');
  });

  it('formats with en-US default mask', () => {
    expect(formatDateInput(new Date(2026, 2, 15), 'en-US')).toBe('03/15/2026');
  });

  it('returns empty string for Invalid Date and warns', () => {
    const invalid = new Date('not-a-date');
    expect(formatDateInput(invalid, 'de-DE')).toBe('');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid Date'),
      expect.any(Object)
    );
  });

  it('falls back to ISO when Intl rejects options', () => {
    const result = formatDateInput(new Date(2026, 2, 15), 'de-DE', {
      year: 'wrong' as Intl.DateTimeFormatOptions['year']
    });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDateRangeInput', () => {
  it('emits both halves with a fixed en-dash separator', () => {
    // We deliberately don't use Intl#formatRange so the output round-trips
    // through parseDateRangeInput — both halves are always fully formatted.
    const result = formatDateRangeInput(new Date(2026, 2, 15), new Date(2026, 4, 22), 'de-DE');
    expect(result).toBe('15.03.2026 – 22.05.2026');
  });

  it('emits both halves for same-year ranges (no collapsing)', () => {
    const result = formatDateRangeInput(new Date(2026, 2, 15), new Date(2026, 2, 22), 'de-DE');
    expect(result).toBe('15.03.2026 – 22.03.2026');
  });

  it('emits both halves for same-day ranges', () => {
    const result = formatDateRangeInput(new Date(2026, 2, 15), new Date(2026, 2, 15), 'de-DE');
    expect(result).toBe('15.03.2026 – 15.03.2026');
  });

  it('returns empty and warns for Invalid Date inputs', () => {
    expect(formatDateRangeInput(new Date('invalid'), new Date(2026, 2, 22), 'de-DE')).toBe('');
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('parseDateInput — locale-aware', () => {
  it('parses de-DE DD.MM.YYYY', () => {
    const result = parseDateInput('15.03.2026', 'de-DE');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('parses en-US MM/DD/YYYY', () => {
    const result = parseDateInput('03/15/2026', 'en-US');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('parses 1-digit day and month (de-DE)', () => {
    const result = parseDateInput('5.3.2026', 'de-DE');
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });

  it('rejects DD.MM.YYYY in en-US locale (strict mask)', () => {
    expect(parseDateInput('15.03.2026', 'en-US')).toBeNull();
  });

  it('rejects out-of-range days (Feb 30)', () => {
    expect(parseDateInput('30.02.2026', 'de-DE')).toBeNull();
  });

  it('rejects garbage strings', () => {
    expect(parseDateInput('foo', 'de-DE')).toBeNull();
    expect(parseDateInput('hello world', 'de-DE')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseDateInput('', 'de-DE')).toBeNull();
    expect(parseDateInput('   ', 'de-DE')).toBeNull();
  });

  it('falls back to ISO YYYY-MM-DD as local-tz date', () => {
    const result = parseDateInput('2026-03-15', 'de-DE');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('rejects ISO with out-of-range day', () => {
    expect(parseDateInput('2026-02-30', 'de-DE')).toBeNull();
  });

  it('pivots 2-digit year around current century with warning', () => {
    const now = new Date().getFullYear();
    const century = Math.floor(now / 100) * 100;
    const result = parseDateInput('15.03.26', 'de-DE');
    expect(result!.getFullYear()).toBe(century + 26);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('2-digit year'),
      expect.any(Object)
    );
  });

  it('round-trips formatted output through parseDateInput (de-DE)', () => {
    const original = new Date(2026, 5, 7);
    const formatted = formatDateInput(original, 'de-DE');
    const parsed = parseDateInput(formatted, 'de-DE');
    expect(parsed!.getTime()).toBe(original.getTime());
  });

  it('round-trips formatted output through parseDateInput (en-US)', () => {
    const original = new Date(2026, 5, 7);
    const formatted = formatDateInput(original, 'en-US');
    const parsed = parseDateInput(formatted, 'en-US');
    expect(parsed!.getTime()).toBe(original.getTime());
  });

  it('round-trips formatted output through parseDateInput (en-GB)', () => {
    const original = new Date(2026, 5, 7);
    const formatted = formatDateInput(original, 'en-GB');
    const parsed = parseDateInput(formatted, 'en-GB');
    expect(parsed!.getTime()).toBe(original.getTime());
  });
});

describe('parseDateRangeInput', () => {
  it('parses en-dash separated range', () => {
    const result = parseDateRangeInput('15.03.2026 – 22.03.2026', 'de-DE');
    expect(result).not.toBeNull();
    expect(result!.start.getDate()).toBe(15);
    expect(result!.end.getDate()).toBe(22);
  });

  it('parses hyphen separated range (whitespace required)', () => {
    const result = parseDateRangeInput('15.03.2026 - 22.03.2026', 'de-DE');
    expect(result).not.toBeNull();
  });

  it('parses "bis" separator (German)', () => {
    const result = parseDateRangeInput('15.03.2026 bis 22.03.2026', 'de-DE');
    expect(result).not.toBeNull();
    expect(result!.start.getDate()).toBe(15);
    expect(result!.end.getDate()).toBe(22);
  });

  it('rejects inverted ranges', () => {
    expect(parseDateRangeInput('22.03.2026 – 15.03.2026', 'de-DE')).toBeNull();
  });

  it('accepts single date as a single-day range', () => {
    const result = parseDateRangeInput('15.03.2026', 'de-DE');
    expect(result).not.toBeNull();
    expect(result!.start.getDate()).toBe(15);
    expect(result!.end.getDate()).toBe(15);
  });

  it('rejects if one half is unparseable', () => {
    expect(parseDateRangeInput('15.03.2026 – foo', 'de-DE')).toBeNull();
  });

  it('does NOT split intra-date slashes (en-US)', () => {
    // "3/15/2026 – 5/22/2026" must split only on the em-dash, not on
    // the slashes inside each date. Restrictive separator regex fix.
    const result = parseDateRangeInput('3/15/2026 – 5/22/2026', 'en-US');
    expect(result).not.toBeNull();
    expect(result!.start.getMonth()).toBe(2);
    expect(result!.end.getMonth()).toBe(4);
  });

  it('does NOT split intra-date slashes (en-GB)', () => {
    const result = parseDateRangeInput('15/03/2026 – 22/05/2026', 'en-GB');
    expect(result).not.toBeNull();
    expect(result!.start.getDate()).toBe(15);
    expect(result!.end.getDate()).toBe(22);
  });

  it('round-trips formatDateRangeInput output through parseDateRangeInput (de-DE)', () => {
    const start = new Date(2026, 2, 15);
    const end = new Date(2026, 4, 22);
    const formatted = formatDateRangeInput(start, end, 'de-DE');
    const parsed = parseDateRangeInput(formatted, 'de-DE');
    expect(parsed!.start.getTime()).toBe(start.getTime());
    expect(parsed!.end.getTime()).toBe(end.getTime());
  });

  it('round-trips formatDateRangeInput output through parseDateRangeInput (en-US)', () => {
    const start = new Date(2026, 2, 15);
    const end = new Date(2026, 4, 22);
    const formatted = formatDateRangeInput(start, end, 'en-US');
    const parsed = parseDateRangeInput(formatted, 'en-US');
    expect(parsed!.start.getTime()).toBe(start.getTime());
    expect(parsed!.end.getTime()).toBe(end.getTime());
  });

  it('round-trips formatDateRangeInput output through parseDateRangeInput (en-GB)', () => {
    const start = new Date(2026, 2, 15);
    const end = new Date(2026, 4, 22);
    const formatted = formatDateRangeInput(start, end, 'en-GB');
    const parsed = parseDateRangeInput(formatted, 'en-GB');
    expect(parsed!.start.getTime()).toBe(start.getTime());
    expect(parsed!.end.getTime()).toBe(end.getTime());
  });

  it('round-trips same-day formatDateRangeInput output', () => {
    const d = new Date(2026, 2, 15);
    const formatted = formatDateRangeInput(d, d, 'de-DE');
    const parsed = parseDateRangeInput(formatted, 'de-DE');
    expect(parsed!.start.getTime()).toBe(d.getTime());
    expect(parsed!.end.getTime()).toBe(d.getTime());
  });
});

describe('isDateAllowed', () => {
  const day = (y: number, m: number, d: number) => new Date(y, m, d);

  it('allows date with no constraints', () => {
    expect(isDateAllowed(day(2026, 2, 15), {})).toBe(true);
  });

  it('respects minDate (inclusive)', () => {
    expect(isDateAllowed(day(2026, 2, 14), { minDate: day(2026, 2, 15) })).toBe(false);
    expect(isDateAllowed(day(2026, 2, 15), { minDate: day(2026, 2, 15) })).toBe(true);
    expect(isDateAllowed(day(2026, 2, 16), { minDate: day(2026, 2, 15) })).toBe(true);
  });

  it('respects maxDate (inclusive)', () => {
    expect(isDateAllowed(day(2026, 2, 16), { maxDate: day(2026, 2, 15) })).toBe(false);
    expect(isDateAllowed(day(2026, 2, 15), { maxDate: day(2026, 2, 15) })).toBe(true);
    expect(isDateAllowed(day(2026, 2, 14), { maxDate: day(2026, 2, 15) })).toBe(true);
  });

  it('respects disabledDates', () => {
    const disabled = [day(2026, 2, 15)];
    expect(isDateAllowed(day(2026, 2, 15), { disabledDates: disabled })).toBe(false);
    expect(isDateAllowed(day(2026, 2, 16), { disabledDates: disabled })).toBe(true);
  });

  it('respects isDateDisabled callback', () => {
    const onlyWeekdays = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
    // 2026-03-15 is a Sunday
    expect(isDateAllowed(day(2026, 2, 15), { isDateDisabled: onlyWeekdays })).toBe(false);
    // 2026-03-16 is a Monday
    expect(isDateAllowed(day(2026, 2, 16), { isDateDisabled: onlyWeekdays })).toBe(true);
  });

  it('treats date as allowed when isDateDisabled throws (with warning)', () => {
    const buggy = () => {
      throw new Error('boom');
    };
    expect(isDateAllowed(day(2026, 2, 15), { isDateDisabled: buggy })).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('isDateDisabled callback threw'),
      expect.any(Object)
    );
  });

  it('rejects Invalid Date', () => {
    expect(isDateAllowed(new Date('invalid'), {})).toBe(false);
  });

  it('warns and ignores Invalid minDate instead of silently disabling', () => {
    const invalid = new Date('invalid');
    expect(isDateAllowed(day(2026, 2, 15), { minDate: invalid })).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('minDate is Invalid Date'),
      expect.any(Object)
    );
  });

  it('warns and ignores Invalid maxDate instead of silently disabling', () => {
    const invalid = new Date('invalid');
    expect(isDateAllowed(day(2026, 2, 15), { maxDate: invalid })).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('maxDate is Invalid Date'),
      expect.any(Object)
    );
  });

  it('warns and skips Invalid entries in disabledDates', () => {
    const disabled = [new Date('invalid'), day(2026, 2, 15)];
    expect(isDateAllowed(day(2026, 2, 15), { disabledDates: disabled })).toBe(false);
    expect(isDateAllowed(day(2026, 2, 16), { disabledDates: disabled })).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('disabledDates contains Invalid Date'),
      expect.any(Object)
    );
  });

  it('warns when minDate > maxDate', () => {
    isDateAllowed(day(2026, 2, 15), {
      minDate: day(2026, 5, 1),
      maxDate: day(2026, 2, 1)
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('minDate > maxDate'),
      expect.any(Object)
    );
  });
});
