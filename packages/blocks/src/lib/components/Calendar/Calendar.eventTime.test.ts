/**
 * The list-based views as an appointment list (#95).
 *
 * Two defects lived here, both invisible in week/day view because the time grid
 * positions a block by its hour rather than by its index in the array:
 *
 *   1. `eventContent` never printed a time, so a day of appointments rendered as
 *      titles with no hours — although `allDay: false` states that the event
 *      happens AT a time.
 *   2. A day rendered in array order. Events generated per resource (chairs,
 *      rooms, staff) arrive grouped by resource, so the agenda read
 *      12:20, 12:15, 13:20, 13:15.
 *
 * Rendered through `svelte/server` like `Calendar.smoke.test.ts`: everything
 * asserted here is in the first paint, and SSR keeps the suite in the fast node
 * environment. The locale is passed explicitly on every render — vitest runs
 * under the machine's LANG (de_DE), so a default-locale assertion would measure
 * the runtime rather than the component.
 *
 * The i18n locale is a different axis and stays at the base bundle: no
 * `<I18nProvider>` is mounted, so `bt()` resolves English ("until …") while the
 * clock itself follows the `locale` prop.
 */

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Calendar from './Calendar.svelte';
import type { CalendarEvent } from './calendar.types';

const DAY = new Date(2026, 5, 16); // Tue 16 Jun 2026
const at = (hour: number, minute: number) => new Date(2026, 5, 16, hour, minute);

/** Two resources' appointments, interleaved exactly as the issue reports them. */
const interleaved: CalendarEvent[] = [
  { id: 'c1-a', title: 'Chair 1 first', start: at(12, 20), allDay: false },
  { id: 'c1-b', title: 'Chair 1 second', start: at(13, 20), allDay: false },
  { id: 'c2-a', title: 'Chair 2 first', start: at(12, 15), allDay: false },
  { id: 'c2-b', title: 'Chair 2 second', start: at(13, 15), allDay: false }
];

/** Positions of `needles` in render order; -1 for anything missing. */
function positions(body: string, needles: string[]): number[] {
  return needles.map((needle) => body.indexOf(needle));
}

function expectAscending(found: number[]): void {
  expect(found.every((index) => index >= 0)).toBe(true);
  expect([...found].sort((a, b) => a - b)).toEqual(found);
}

/**
 * The `<button …>…</button>` whose content carries `needle` — the header's own
 * navigation buttons come first in the body, so a plain `indexOf('<button')`
 * measures those instead.
 */
function buttonAround(body: string, needle: string): string {
  const hit = body.indexOf(needle);
  expect(hit).toBeGreaterThan(-1);
  return body.slice(body.lastIndexOf('<button', hit), body.indexOf('</button>', hit));
}

describe('Calendar list views — event time', () => {
  it('renders start and end of a timed event in the agenda', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [
          { id: 'a', title: 'Standup', start: at(9, 5), end: at(10, 30), allDay: false }
        ] satisfies CalendarEvent[]
      }
    });
    expect(body).toContain('09:05');
    expect(body).toContain('10:30');
    // Machine-readable start on the <time> element, in local wall-clock form.
    expect(body).toContain('datetime="2026-06-16T09:05"');
  });

  it('renders the start alone when the event has no end', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [{ id: 'a', title: 'Delivery', start: at(9, 5), allDay: false }]
      }
    });
    expect(body).toContain('>9:05<');
  });

  it('follows the locale hour cycle instead of a hardcoded 24h clock', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'en-US',
        events: [{ id: 'a', title: 'Standup', start: at(14, 0), allDay: false }]
      }
    });
    // One separator before the marker, not an optional one: measured 2026-08-12
    // it is a plain U+0020 in Node 25.2.1, Node 26.3.0 and Bun 1.4.0 alike (an
    // earlier comment here claimed U+202F, which none of the three produces).
    // `\s` still covers the narrow no-break space a later CLDR could switch to.
    expect(body).toMatch(/2:00\sPM/);
    // Only the visible text: `datetime` is a 24h machine value by definition.
    expect(body).not.toMatch(/>14:00</);
  });

  it('shows no time for an all-day event — there is none to show', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [
          { id: 'a', title: 'Holiday', start: DAY, allDay: true },
          // `allDay` omitted: the documented default is `true`.
          { id: 'b', title: 'Deadline', start: at(23, 0) }
        ]
      }
    });
    expect(body).toContain('Holiday');
    expect(body).toContain('Deadline');
    expect(body).not.toContain('<time');
    expect(body).not.toContain('23:00');
  });

  it('states each day of a multi-day event with the time that is true for it', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [
          {
            id: 'a',
            title: 'Conference',
            start: at(9, 0),
            end: new Date(2026, 5, 18, 17, 0),
            allDay: false
          }
        ]
      }
    });
    // Three day groups, two <time> elements: the start on day 1, the end on
    // day 3, nothing on day 2. `event.start` is the same instant on all three
    // rows, so an unqualified 9:00 on day 2 would claim the conference starts
    // this morning — and without the end row the 17:00 would appear nowhere,
    // since a cross-day range would print both full dates.
    expect(body.split('Conference').length - 1).toBeGreaterThanOrEqual(3);
    expect(body.split('<time').length - 1).toBe(2);
    expect(body).toContain('>9:00<');
    expect(body).toContain('until 17:00');
    // Each <time> points at the instant its own text states.
    expect(body).toContain('datetime="2026-06-16T09:00"');
    expect(body).toContain('datetime="2026-06-18T17:00"');
  });

  it('shows no time on any row of an all-day span', () => {
    // `end` is what makes an event span days, so a timed event without one is
    // always single-day; the multi-day row that carries no clock statement at
    // either end is the all-day span.
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [
          {
            id: 'a',
            title: 'Trade fair',
            start: at(9, 0),
            end: new Date(2026, 5, 18),
            allDay: true
          }
        ]
      }
    });
    expect(body).not.toContain('<time');
  });

  it('names a clickable event from its own content, not from a label attribute', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        onEventClick: () => {},
        events: [
          {
            id: 'a',
            title: 'Standup',
            description: 'Room 2',
            start: at(9, 5),
            allDay: false
          }
        ]
      }
    });
    // An aria-label on the button would REPLACE all of this for a screen
    // reader: it used to carry the title alone, which silently dropped the
    // time, the description, the helper text and the "Day n of m" badge.
    const button = buttonAround(body, 'Standup');
    expect(button).not.toContain('aria-label=');
    expect(button).toContain('>9:05<');
    expect(button).toContain('Standup');
    expect(button).toContain('Room 2');
  });

  it("keeps a multi-day row's badge inside the accessible name", () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        onEventClick: () => {},
        events: [
          {
            id: 'a',
            title: 'Conference',
            start: at(9, 0),
            end: new Date(2026, 5, 18, 17, 0),
            allDay: false
          }
        ]
      }
    });
    // Day 2 of 3 renders no time at all, so the badge is the only thing that
    // tells its row apart from the other two — it must reach a listener.
    expect(body).toContain('Day 2 of 3');
    expect(body).not.toContain('aria-label="Conference"');
  });
});

describe('Calendar list views — chronological order', () => {
  it('sorts an interleaved day in the agenda (#95 repro)', () => {
    const { body } = render(Calendar, {
      props: { view: 'agenda', value: DAY, locale: 'de-DE', events: interleaved }
    });
    expectAscending(
      positions(body, ['Chair 2 first', 'Chair 1 first', 'Chair 2 second', 'Chair 1 second'])
    );
  });

  it('sorts the same day in the month event list', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'month',
        value: DAY,
        locale: 'de-DE',
        showEventList: true,
        events: interleaved
      }
    });
    expectAscending(
      positions(body, ['Chair 2 first', 'Chair 1 first', 'Chair 2 second', 'Chair 1 second'])
    );
  });

  it('heads the day with its all-day events, whatever their clock time', () => {
    const { body } = render(Calendar, {
      props: {
        view: 'agenda',
        value: DAY,
        locale: 'de-DE',
        events: [
          { id: 'timed', title: 'Early appointment', start: at(8, 0), allDay: false },
          { id: 'allday', title: 'Public holiday', start: at(12, 0), allDay: true }
        ]
      }
    });
    expectAscending(positions(body, ['Public holiday', 'Early appointment']));
  });

  it('orders what the month cell itself shows — its dots and its tooltip', () => {
    // The cell reads the same index (`getEventsForDate`) and takes the FIRST
    // three for both its dots and its native tooltip, so before the central sort
    // it truncated by array position rather than by time.
    const { body } = render(Calendar, {
      props: {
        view: 'month',
        value: DAY,
        locale: 'de-DE',
        showEventList: false,
        events: interleaved
      }
    });
    expect(body).toContain('title="Chair 2 first\nChair 1 first\nChair 2 second\n+1"');
  });
});
