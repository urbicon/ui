/**
 * The agenda's window (#95, third defect — 2026-08-12).
 *
 * The list used to start at the 1st of the displayed month and walk
 * `agendaDays` from there, so `defaultDate` + `agendaDays={1}` — "today's list",
 * the smallest honest configuration — showed *the 1st*, almost always empty. The
 * landing tile hit exactly that: "No events" under an "August 2026" title while
 * 47 events sat on the displayed day.
 *
 * The window now runs `agendaDays` days FROM the reference date, both ends
 * inclusive, and the title names that window rather than the month it starts in.
 *
 * Rendered through `svelte/server` like `Calendar.eventTime.test.ts` —
 * everything asserted here is in the first paint. The `locale` prop is explicit
 * on every render: vitest runs under the machine's LANG (de_DE), so a
 * default-locale assertion would measure the runtime instead of the component.
 * The i18n bundle is a separate axis and resolves to English without a provider,
 * which is what makes the aria-label assertions readable.
 */

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import en from '$lib/translations/en';
import Calendar from './Calendar.svelte';
import type { CalendarEvent } from './calendar.types';

const bt = en.calendar;

/** Tue 16 Jun 2026 — mid-month, so "the 1st" and "the anchor" cannot coincide. */
const ANCHOR = new Date(2026, 5, 16);

/**
 * An event on `day` of June 2026, titled so that no title is a prefix of
 * another: "day 1" would otherwise match inside "day 16" and every negative
 * assertion below would hold for the wrong reason.
 */
const onDay = (day: number): CalendarEvent => ({
  id: `d${day}`,
  title: `[the ${day}th]`,
  start: new Date(2026, 5, day, 9, 0),
  allDay: false
});
const title = (day: number) => `[the ${day}th]`;

function agenda(props: Record<string, unknown>) {
  return render(Calendar, {
    props: { view: 'agenda', locale: 'en-GB', ...props }
  }).body;
}

describe('Calendar agenda window — anchored on the reference date', () => {
  it('lists the reference day at agendaDays={1} (#95 repro)', () => {
    const body = agenda({
      defaultDate: ANCHOR,
      agendaDays: 1,
      events: [onDay(1), onDay(16)]
    });

    // The regression: the 1st was the only day the window covered, so the day
    // the consumer pointed at was invisible and the list read as empty.
    expect(body).toContain(title(16));
    expect(body).not.toContain(title(1));
    expect(body).not.toContain(bt.noEvents);
  });

  it('starts at the reference date, not at the 1st of its month', () => {
    const body = agenda({ defaultDate: ANCHOR, events: [onDay(2), onDay(20)] });

    expect(body).toContain(title(20));
    expect(body).not.toContain(title(2));
  });

  it('covers agendaDays days with both ends inclusive', () => {
    const body = agenda({
      defaultDate: ANCHOR,
      agendaDays: 3,
      events: [onDay(16), onDay(18), onDay(19)]
    });

    expect(body).toContain(title(16)); // first day
    expect(body).toContain(title(18)); // last day — inclusive
    expect(body).not.toContain(title(19)); // one past the window
  });

  it('renders the empty state when the window holds nothing', () => {
    // The positive control's negative half: without it, the "does not contain
    // the 1st" assertions above would also hold for a component rendering
    // nothing at all.
    const body = agenda({ defaultDate: ANCHOR, agendaDays: 1, events: [onDay(1)] });
    expect(body).toContain(bt.noEvents);
  });

  it('anchors on the selection when there is one', () => {
    // `value` outranks `defaultDate` for the reference date, and the agenda
    // inherits that ordering rather than having an anchor of its own.
    const body = agenda({ value: new Date(2026, 5, 20), agendaDays: 1, events: [onDay(20)] });
    expect(body).toContain(title(20));
  });
});

describe('Calendar agenda window — the header names the window', () => {
  it('titles a one-day window as a day', () => {
    const body = agenda({ defaultDate: ANCHOR, agendaDays: 1 });

    // en-GB day title: "Tue, 16 June 2026" — the point is that it names the
    // DAY. The old title was the month ("June 2026"), which is exactly what a
    // one-day list must not claim.
    expect(body).toContain('16 June 2026');
  });

  it('titles a multi-day window as a range over its own ends', () => {
    const body = agenda({ defaultDate: ANCHOR, agendaDays: 30 });

    // 16 Jun 2026 + 29 days = 15 Jul 2026. Both ends are asserted separately:
    // the separator between them is ICU's business, not this test's.
    expect(body).toContain('16 Jun');
    expect(body).toContain('15 Jul');
  });

  it('labels the arrows for what they step', () => {
    const oneDay = agenda({ defaultDate: ANCHOR, agendaDays: 1 });
    expect(oneDay).toContain(`aria-label="${bt.nextDay}"`);
    expect(oneDay).toContain(`aria-label="${bt.previousDay}"`);

    const window = agenda({ defaultDate: ANCHOR, agendaDays: 7 });
    expect(window).toContain(`aria-label="${bt.nextRange}"`);
    expect(window).toContain(`aria-label="${bt.previousRange}"`);
    // The month labels were the giveaway of the old month coupling.
    expect(window).not.toContain(`aria-label="${bt.nextMonth}"`);
  });
});
