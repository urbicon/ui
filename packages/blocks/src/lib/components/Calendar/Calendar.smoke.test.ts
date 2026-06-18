/**
 * SSR smoke render for the Calendar re-base onto DateGridController.
 *
 * Calendar has no DOM render tests (the vitest env is `node`), so these assert
 * the one thing static checks can't: every view renders to HTML without throwing
 * once the controller feeds the context facade. They are a coarse regression net
 * for the mechanics→facade wiring, not a layout/visual check.
 */

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Calendar from './Calendar.svelte';
import type { CalendarEvent, CalendarViewMode } from './calendar.types';

const VIEWS: CalendarViewMode[] = ['month', 'week', 'day', 'year', 'agenda'];

const anchor = new Date(2026, 5, 15); // 15 Jun 2026 (a Monday)

const events: CalendarEvent[] = [
  { id: 'a', title: 'Single day', start: new Date(2026, 5, 16), allDay: true },
  {
    id: 'b',
    title: 'Multi day',
    start: new Date(2026, 5, 17),
    end: new Date(2026, 5, 19),
    allDay: true,
    categoryId: 'work'
  },
  {
    id: 'c',
    title: 'Weekly standup',
    start: new Date(2026, 5, 15, 9, 0),
    end: new Date(2026, 5, 15, 9, 30),
    allDay: false,
    recurrence: { frequency: 'weekly', interval: 1 }
  }
];

const categories = [{ id: 'work', label: 'Work', color: 'oklch(0.65 0.15 250)' }];

describe('Calendar SSR smoke', () => {
  for (const view of VIEWS) {
    it(`renders the ${view} view without throwing`, () => {
      const { body } = render(Calendar, { props: { view, value: anchor } });
      expect(body.length).toBeGreaterThan(0);
      // The aria-live status region always carries the localized header title.
      expect(body).toContain('aria-live="polite"');
    });

    it(`renders the ${view} view with events + categories`, () => {
      const { body } = render(Calendar, {
        props: { view, value: anchor, events, categories }
      });
      expect(body.length).toBeGreaterThan(0);
    });
  }

  it('renders range selection without throwing', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'month',
        selectionMode: 'range',
        value: { start: new Date(2026, 5, 10), end: new Date(2026, 5, 14) }
      }
    });
    expect(body.length).toBeGreaterThan(0);
  });

  it('renders multiple selection without throwing', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'month',
        selectionMode: 'multiple',
        value: [new Date(2026, 5, 3), new Date(2026, 5, 7)]
      }
    });
    expect(body.length).toBeGreaterThan(0);
  });

  it('renders empty (uncontrolled, no value) without throwing', () => {
    const { body } = render(Calendar, { props: {} });
    expect(body).toContain('aria-live="polite"');
  });

  it('seeds the anchor from defaultMonth/defaultYear when no value', () => {
    const { body } = render(Calendar, {
      props: { view: 'month', defaultMonth: 0, defaultYear: 2030 }
    });
    // January 2030 must appear in the rendered header title.
    expect(body).toContain('2030');
  });

  // End-to-end wiring: controller geometry/selection must reach the DOM through
  // the context facade, not just render without throwing.
  it('month view renders the anchor month grid down to day cells', () => {
    const { body } = render(Calendar, { props: { view: 'month', value: anchor } });
    // CalendarDay stamps a local data-date per cell — the whole anchor month plus
    // its trailing spill (Jun 2026 starts Mon Jun 1, ends Tue Jun 30 → Jul spill).
    expect(body).toContain('data-date="2026-06-01"');
    expect(body).toContain('data-date="2026-06-15"');
    expect(body).toContain('data-date="2026-06-30"');
    // Outside (spill) days from the next month render too (showOutsideDays default).
    expect(body).toContain('data-date="2026-07-01"');
  });

  it('month view marks the single selection with aria-selected', () => {
    const { body } = render(Calendar, { props: { view: 'month', value: anchor } });
    // aria-selected precedes data-date in the button tag, so match the whole tag.
    const cell = body.match(/<button[^>]*data-date="2026-06-15"[^>]*>/)?.[0] ?? '';
    expect(cell).toContain('aria-selected="true"');
  });

  it('week view renders the weekday header columns', () => {
    const { body } = render(Calendar, { props: { view: 'week', value: anchor } });
    // CalendarWeekGrid stamps data-weekday on each of the seven day headers.
    expect(body).toContain('data-weekday="0"');
    expect(body).toContain('data-weekday="6"');
  });
});
