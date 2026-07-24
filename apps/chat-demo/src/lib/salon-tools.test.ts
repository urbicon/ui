import { describe, expect, it } from 'vitest';
import { executeSalonTool, SALON_TOOLS } from './salon-tools';

describe('executeSalonTool', () => {
  it('returns services and stylists without a date', () => {
    const out = executeSalonTool('get_salon_info', {});
    expect(Array.isArray(out.services)).toBe(true);
    expect(Array.isArray(out.stylists)).toBe(true);
    expect(out.availability).toBeUndefined();
    expect(out.error).toBeUndefined();
  });

  it('returns per-stylist availability for a workday, deterministically', () => {
    // 2026-08-12 is a Wednesday.
    const first = executeSalonTool('get_salon_info', { date: '2026-08-12' });
    const second = executeSalonTool('get_salon_info', { date: '2026-08-12' });
    expect(second).toEqual(first);

    const availability = first.availability as Array<{ stylistId: string; slots: string[] }>;
    expect(availability).toHaveLength(3);
    for (const entry of availability) {
      for (const slot of entry.slots) expect(slot).toMatch(/^\d{2}:\d{2}$/);
    }
    // At least one stylist works Wednesdays and has offered slots.
    expect(availability.some((entry) => entry.slots.length > 0)).toBe(true);
  });

  it('gives a non-working stylist an empty slot list', () => {
    // 2026-08-11 is a Tuesday — Ayla (workdays Mon/Wed/Fri/Sat) is off.
    const out = executeSalonTool('get_salon_info', { date: '2026-08-11' });
    const availability = out.availability as Array<{ stylistId: string; slots: string[] }>;
    expect(availability.find((entry) => entry.stylistId === 'ayla')?.slots).toEqual([]);
  });

  it('reports Sundays as closed with empty availability', () => {
    // 2026-08-16 is a Sunday.
    const out = executeSalonTool('get_salon_info', { date: '2026-08-16' });
    expect(out.availability).toEqual([]);
    expect(String(out.note)).toMatch(/closed/i);
  });

  it('fails loud (error field, no throw) on bad input and unknown tools', () => {
    expect(executeSalonTool('get_salon_info', { date: 'tomorrow' }).error).toBeTruthy();
    expect(executeSalonTool('get_salon_info', { date: 42 }).error).toBeTruthy();
    expect(executeSalonTool('get_salon_info', null).availability).toBeUndefined();
    expect(executeSalonTool('drop_tables', {}).error).toBeTruthy();
  });

  it('rejects non-existent calendar days instead of letting JS Date roll them over', () => {
    // new Date('2026-02-30…') silently becomes March 2 — the tool must not
    // answer for a different day than it was asked about.
    expect(executeSalonTool('get_salon_info', { date: '2026-02-30' }).error).toBeTruthy();
    expect(executeSalonTool('get_salon_info', { date: '2026-04-31' }).error).toBeTruthy();
    // A real leap day stays valid.
    expect(executeSalonTool('get_salon_info', { date: '2028-02-29' }).error).toBeUndefined();
  });

  it('exposes exactly the tools the relay advertises', () => {
    expect(SALON_TOOLS.map((tool) => tool.name)).toEqual(['get_salon_info']);
  });
});
