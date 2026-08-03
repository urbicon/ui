/**
 * `highlightToday` + `timeGridHourHeight` (issue #97) over an SSR render.
 *
 * Calendar draws today in FIVE places, only one of which goes through the tv()
 * `dayState` variant — the other four compose inline class strings. That is
 * exactly why a prop bolted onto one view would have looked done and left the
 * week header (the case the issue was filed over) untouched, so every path gets
 * its own case here, on and off.
 *
 * Two invariants are asserted as loudly as the styling:
 *
 *  - `aria-current="date"` NEVER depends on `highlightToday`. It is a semantic
 *    pointer; a consumer switching off a colour must not cost a screen-reader
 *    user the "which cell is today" answer.
 *  - the time grid's current-time line is NOT gated either. It marks the current
 *    *time*, not the day — a different piece of information that happens to be
 *    derived from the same clock.
 *
 * `today` comes from the wall clock (`stripTime(new Date())` in the controller),
 * so unlike the other Calendar suites this one cannot simply pin its dates: it
 * pins the clock with fake timers instead. Assertions stay on classes and
 * attributes, never on formatted date text — vitest runs under Node with
 * LANG=de_DE and asserting rendered month/day names would test the runtime.
 */

import { render } from 'svelte/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar.svelte';
import type { CalendarEvent } from './calendar.types';

// Mon 15 Jun 2026, 10:30 local — inside the default 7–20 time-grid window, so
// the current-time line renders and can be asserted on.
const NOW = new Date(2026, 5, 15, 10, 30);
const TODAY_ISO = '2026-06-15';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const events: CalendarEvent[] = [
  { id: 'today', title: 'On today', start: new Date(2026, 5, 15), allDay: true },
  { id: 'timed', title: 'Timed', start: new Date(2026, 5, 15, 9), end: new Date(2026, 5, 15, 10) }
];

/** The opening tag of the first element carrying `attr`, e.g. `data-date="…"`. */
function tagWith(body: string, attr: string): string {
  const match = body.match(new RegExp(`<[a-zA-Z]+[^>]*${attr}[^>]*>`));
  return match?.[0] ?? '';
}

function renderCalendar(props: Record<string, unknown>): string {
  // No `value`: a selected today would resolve to the `todaySelected` state and
  // hide the plain `today` path under test.
  return render(Calendar, { props }).body;
}

describe('Calendar highlightToday', () => {
  describe('month view (the tv() dayState path)', () => {
    it('marks today by default', () => {
      const cell = tagWith(renderCalendar({ view: 'month' }), `data-date="${TODAY_ISO}"`);
      expect(cell).toContain('data-state="today"');
    });

    it('falls back to the default state when switched off', () => {
      const cell = tagWith(
        renderCalendar({ view: 'month', highlightToday: false }),
        `data-date="${TODAY_ISO}"`
      );
      expect(cell).toContain('data-state="default"');
      expect(cell).not.toContain('data-state="today"');
    });

    it('keeps aria-current="date" either way', () => {
      for (const highlightToday of [true, false]) {
        const cell = tagWith(
          renderCalendar({ view: 'month', highlightToday }),
          `data-date="${TODAY_ISO}"`
        );
        expect(cell).toContain('aria-current="date"');
      }
    });

    it('keeps the selection ring on a selected today when switched off', () => {
      // The ladder must degrade to `selected`, not all the way to `default` —
      // switching off the today marker must not also drop the selection.
      const cell = tagWith(
        renderCalendar({ view: 'month', highlightToday: false, value: new Date(2026, 5, 15) }),
        `data-date="${TODAY_ISO}"`
      );
      expect(cell).toContain('data-state="selected"');
    });
  });

  describe('week view (the inline column header — the reported case)', () => {
    it('paints the header block by default', () => {
      const header = tagWith(renderCalendar({ view: 'week' }), 'aria-current="date"');
      expect(header).toContain('text-text-on-primary');
    });

    it('drops the block but keeps aria-current when switched off', () => {
      const header = tagWith(
        renderCalendar({ view: 'week', highlightToday: false }),
        'aria-current="date"'
      );
      expect(header).toContain('aria-current="date"');
      expect(header).not.toContain('text-text-on-primary');
    });
  });

  describe('mini calendar (inline)', () => {
    const props = { view: 'week' as const, showMiniCalendar: true };

    it('marks today by default', () => {
      const day = tagWith(renderCalendar(props), `data-mini-date="${TODAY_ISO}"`);
      expect(day).toContain('text-text-on-primary');
    });

    it('drops the mark but keeps aria-current when switched off', () => {
      const day = tagWith(
        renderCalendar({ ...props, highlightToday: false }),
        `data-mini-date="${TODAY_ISO}"`
      );
      expect(day).toContain('aria-current="date"');
      expect(day).not.toContain('text-text-on-primary');
    });
  });

  describe('year view (inline — current month ring + today pill)', () => {
    it('rings the current month by default', () => {
      expect(renderCalendar({ view: 'year' })).toContain('bg-primary-subtle ring-primary ring-1');
    });

    it('drops the ring when switched off', () => {
      const body = renderCalendar({ view: 'year', highlightToday: false });
      expect(body).not.toContain('bg-primary-subtle ring-primary ring-1');
      // …and the today pill inside the mini month goes with it.
      expect(body).not.toContain('bg-primary text-text-on-primary rounded-full');
    });
  });

  describe('agenda view (inline day header)', () => {
    // `bg-surface-base/95` is unique to the agendaDayHeader slot, so it pins the
    // assertion to that element rather than to any `text-primary` on the page.
    // (`backdrop-blur-sm` alone is not: the Popover surface carries it too, and
    // Calendar renders a closed one for the event popover.)
    const dayHeader = (body: string) => tagWith(body, 'bg-surface-base/95');

    it('emphasises today by default', () => {
      expect(dayHeader(renderCalendar({ view: 'agenda', events }))).toContain(
        'text-primary font-bold'
      );
    });

    it('drops the emphasis when switched off', () => {
      expect(
        dayHeader(renderCalendar({ view: 'agenda', events, highlightToday: false }))
      ).not.toContain('text-primary font-bold');
    });
  });

  describe('time grid current-time line', () => {
    it('renders regardless of highlightToday', () => {
      // Deliberately NOT gated: it marks the current time, not the day. `bg-live`
      // is the line's dot and appears nowhere else in the tree.
      for (const highlightToday of [true, false]) {
        expect(renderCalendar({ view: 'week', events, highlightToday })).toContain('bg-live');
      }
    });
  });
});

describe('Calendar timeGridHourHeight', () => {
  it('follows size when unset', () => {
    expect(renderCalendar({ view: 'week', size: 'sm' })).toContain('height: 40px;');
    expect(renderCalendar({ view: 'week', size: 'md' })).toContain('height: 48px;');
    expect(renderCalendar({ view: 'week', size: 'lg' })).toContain('height: 64px;');
  });

  it('overrides the size coupling when set', () => {
    const body = renderCalendar({ view: 'week', size: 'lg', timeGridHourHeight: 24 });
    expect(body).toContain('height: 24px;');
    expect(body).not.toContain('height: 64px;');
  });

  it('halves per slot at a 30-minute interval, like the size-derived default', () => {
    const body = renderCalendar({ view: 'week', timeGridHourHeight: 30, timeGridInterval: 30 });
    expect(body).toContain('height: 15px;');
  });
});
