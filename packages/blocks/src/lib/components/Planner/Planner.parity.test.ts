/**
 * The Calendar↔Planner API parity pass (issue #97), over an SSR render.
 *
 * Two groups:
 *
 *  1. What Planner gained from Calendar — `minDate`/`maxDate`,
 *     `disabledDates`/`isDateDisabled`, `fixedWeeks`, and the
 *     `showWeekNumber` → `showWeekNumbers` rename. The bounds and the
 *     predicate were already implemented in the shared `DateGridController`;
 *     Planner simply never passed them, which is precisely the kind of gap
 *     nothing fails on — so each one is asserted through to the rendered
 *     gridcell rather than at the controller.
 *
 *  2. Planner's own `highlightToday`, which gated the cell date but never the
 *     week column's header number. Switching the marker off still left today
 *     bold and primary-coloured at the top of the column.
 *
 * SSR (the file's `node` env) rather than jsdom: every one of these surfaces as
 * an attribute or a class in the server output — `aria-disabled` on the
 * gridcell, the week-number rowheader, the row count, the header class string.
 * A jsdom harness would add mounting machinery without adding assurance.
 *
 * Dates are pinned to June 2026 except in the `highlightToday` block, which has
 * to pin the *clock* instead: `today` comes from `new Date()` inside the
 * controller. Assertions stay off formatted date text (vitest runs under Node
 * with LANG=de_DE).
 */

import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlannerProps } from './index';
import Planner from './Planner.svelte';

interface Meal {
  id: string;
  date: string;
}

const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026
const getMealDate = (m: Meal) => m.date;

function renderPlanner(props: Partial<PlannerProps<Meal>>) {
  return render(Planner, {
    props: { getDate: getMealDate, ...props } as unknown as ComponentProps<typeof Planner>
  });
}

/** The gridcell opening tag for a given local date. */
function cellTag(body: string, iso: string): string {
  return body.match(new RegExp(`<div[^>]*data-date="${iso}"[^>]*>`))?.[0] ?? '';
}

describe('Planner navigation constraints (mirrored from Calendar)', () => {
  it('disables days before minDate', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor, minDate: new Date(2026, 5, 17) });
    expect(cellTag(body, '2026-06-16')).toContain('aria-disabled="true"');
    expect(cellTag(body, '2026-06-17')).not.toContain('aria-disabled="true"');
  });

  it('disables days after maxDate', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor, maxDate: new Date(2026, 5, 17) });
    expect(cellTag(body, '2026-06-17')).not.toContain('aria-disabled="true"');
    expect(cellTag(body, '2026-06-18')).toContain('aria-disabled="true"');
  });

  it('disables the dates listed in disabledDates', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      disabledDates: [new Date(2026, 5, 17)]
    });
    expect(cellTag(body, '2026-06-17')).toContain('aria-disabled="true"');
    expect(cellTag(body, '2026-06-18')).not.toContain('aria-disabled="true"');
  });

  it('disables the dates isDateDisabled rejects', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      // Weekends closed — the shape the predicate exists for.
      isDateDisabled: (d: Date) => d.getDay() === 0 || d.getDay() === 6
    });
    expect(cellTag(body, '2026-06-20')).toContain('aria-disabled="true"'); // Sat
    expect(cellTag(body, '2026-06-21')).toContain('aria-disabled="true"'); // Sun
    expect(cellTag(body, '2026-06-19')).not.toContain('aria-disabled="true"'); // Fri
  });

  it('combines disabledDates with isDateDisabled rather than replacing it', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      disabledDates: [new Date(2026, 5, 16)],
      isDateDisabled: (d: Date) => d.getDate() === 18
    });
    expect(cellTag(body, '2026-06-16')).toContain('aria-disabled="true"');
    expect(cellTag(body, '2026-06-18')).toContain('aria-disabled="true"');
    expect(cellTag(body, '2026-06-17')).not.toContain('aria-disabled="true"');
  });
});

describe('Planner renders the constraints, not just announces them', () => {
  // Without this the props were screen-reader-only: a blocked day carried
  // `aria-disabled` and otherwise looked exactly like a bookable one — same
  // surface, same border, same date colour, same cursor.
  const cellBody = (body: string, isoDate: string) =>
    body.split(`data-date="${isoDate}"`)[1]?.split('data-date=')[0] ?? '';

  it('dims and re-cursors a day outside minDate', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor, minDate: new Date(2026, 5, 17) });
    expect(cellBody(body, '2026-06-16')).toContain('opacity-40 cursor-not-allowed');
    expect(cellBody(body, '2026-06-17')).not.toContain('cursor-not-allowed');
  });

  it('greys the date number of a disabled day', () => {
    // The number lives in Planner's own cellHeader, out of reach of the
    // consumer's `cell` snippet — so `PlannerCellContext.isDisabled` alone
    // would have left it at full contrast.
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      disabledDates: [new Date(2026, 5, 17)]
    });
    expect(cellBody(body, '2026-06-17')).toContain('text-text-disabled');
    expect(cellBody(body, '2026-06-18')).toContain('text-text-secondary');
  });

  it('lets disabled outrank the today marker, like CalendardayState', () => {
    const NOW = new Date(2026, 5, 15, 9, 0);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      // Today itself blocked (minDate tomorrow): the ladder puts `disabled`
      // above `today`, so no primary pill.
      const { body } = renderPlanner({ view: 'week', minDate: new Date(2026, 5, 16) });
      expect(cellBody(body, '2026-06-15')).toContain('text-text-disabled');
      expect(cellBody(body, '2026-06-15')).not.toContain('bg-primary text-text-on-primary');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dims every cell when the whole grid is disabled, as Calendar does', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor, disabled: true });
    expect(cellBody(body, '2026-06-17')).toContain('opacity-40 cursor-not-allowed');
  });
});

describe('Planner marks today for screen readers', () => {
  // Planner had no `aria-current` at all — the largest a11y asymmetry left
  // between the two components, and the exact thing defended for Calendar.
  const NOW = new Date(2026, 5, 15, 9, 0);

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('sets aria-current="date" on today', () => {
    const { body } = renderPlanner({ view: 'week' });
    expect(cellTag(body, '2026-06-15')).toContain('aria-current="date"');
    expect(cellTag(body, '2026-06-16')).not.toContain('aria-current');
  });

  it('keeps it when highlightToday is off', () => {
    // The same rule as Calendar: the visual preference must not cost the
    // semantic pointer.
    const { body } = renderPlanner({ view: 'week', highlightToday: false });
    expect(cellTag(body, '2026-06-15')).toContain('aria-current="date"');
  });
});

describe('Planner fixedWeeks (mirrored from Calendar)', () => {
  // June 2026 starts on a Monday and has 30 days → exactly 5 Monday-weeks.
  const rowsIn = (body: string) => body.match(/role="row"/g)?.length ?? 0;

  it('renders the natural row count by default', () => {
    // 1 weekday-header row + 5 week rows.
    expect(rowsIn(renderPlanner({ view: 'month', value: anchor }).body)).toBe(6);
  });

  it('pads to 6 week rows when set', () => {
    const { body } = renderPlanner({ view: 'month', value: anchor, fixedWeeks: true });
    expect(rowsIn(body)).toBe(7);
    expect(body).toContain('data-date="2026-07-06"'); // the padded sixth week
  });
});

describe('Planner showWeekNumbers (renamed from showWeekNumber)', () => {
  const weekNumberColumn = /role="rowheader"/;

  it('is off by default', () => {
    expect(renderPlanner({ view: 'week', value: anchor }).body).not.toMatch(weekNumberColumn);
  });

  it('renders the column under the plural name', () => {
    expect(renderPlanner({ view: 'week', value: anchor, showWeekNumbers: true }).body).toMatch(
      weekNumberColumn
    );
  });

  it('still honours the deprecated singular name', () => {
    // Kept working on purpose: a silent rename would just stop rendering the
    // column, with nothing in the consumer's code to grep for.
    expect(renderPlanner({ view: 'week', value: anchor, showWeekNumber: true }).body).toMatch(
      weekNumberColumn
    );
  });

  it('lets an explicit new-name false beat the deprecated name', () => {
    // The mid-migration combination. Resolved with `??` on an undefined-default
    // sentinel, so "passed at all" beats "passed truthy" — with `||` the old
    // name would have overridden the new one's explicit `false`.
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      showWeekNumbers: false,
      showWeekNumber: true
    });
    expect(body).not.toMatch(weekNumberColumn);
  });

  it('lets an explicit new-name true win over a deprecated false', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      showWeekNumbers: true,
      showWeekNumber: false
    });
    expect(body).toMatch(weekNumberColumn);
  });
});

describe('Planner highlightToday reaches the week column header', () => {
  const NOW = new Date(2026, 5, 15, 10, 30); // Mon 15 Jun 2026

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  // The header number lives in the columnheader row, the cell date in the
  // gridcell — `columnheader` scopes the assertion to the former.
  function headerRow(body: string): string {
    return body.split('role="row"')[1]?.split('</div>')[0] ?? '';
  }

  it('marks the header number by default', () => {
    const { body } = renderPlanner({ view: 'week' });
    expect(headerRow(body)).toContain('text-primary font-bold');
  });

  it('drops the header mark when switched off', () => {
    // The bug this pass fixes: only the cell date was gated, so the header
    // number stayed bold and primary-coloured with highlightToday={false}.
    const { body } = renderPlanner({ view: 'week', highlightToday: false });
    expect(headerRow(body)).not.toContain('text-primary font-bold');
  });

  it('drops the cell date mark when switched off', () => {
    const on = renderPlanner({ view: 'week' }).body;
    const off = renderPlanner({ view: 'week', highlightToday: false }).body;
    expect(on).toContain('bg-primary text-text-on-primary rounded-full');
    expect(off).not.toContain('bg-primary text-text-on-primary rounded-full');
  });
});
