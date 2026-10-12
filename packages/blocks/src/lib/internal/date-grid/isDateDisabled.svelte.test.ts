// @vitest-environment jsdom
/**
 * `isDateDisabled` is the one way to disable single days on Calendar, DatePicker,
 * DateRangePicker, Planner and ResourceTimeline. This file pins the three things
 * its JSDoc promises on each of them:
 *
 *  1. **What it receives** — a `Date` of its own for each day, on every call;
 *     in Europe/Berlin that is always local midnight.
 *  2. **A list, kept as a `Set` of `toIso` keys**, disables exactly the days it
 *     names: an entry with a time of day, one built by adding hours across the
 *     spring-forward switch, one parsed from a UTC instant. `list.includes(d)`
 *     disables none of them; comparing `getTime()` only the midnight one. A
 *     leftover `disabledDates` in a spread disables nothing and warns in DEV.
 *  3. **It is followed when it changes** — a predicate closing over `$state`,
 *     flipped after mount, and a predicate prop swapped for another, reach every
 *     path that consults it: the rendered cells, click and keyboard selection,
 *     the pickers' typed-input check, a range's two ends, Planner's
 *     `onDateSelect`, ResourceTimeline's `onCellClick`.
 *
 * The file pins TZ to Europe/Berlin, where 2026-03-29 is a 23-hour day, so the
 * DST cases mean the same on every runner; the first test is the positive
 * control that the switch took.
 */

import { fireEvent } from '@testing-library/dom';
import { type Component, flushSync, mount, unmount } from 'svelte';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import Calendar from '#lib/components/Calendar/Calendar.svelte';
import DateRangePickerHarness from '#lib/components/DatePicker/__fixtures__/DateRangePickerHarness.svelte';
import DatePicker from '#lib/components/DatePicker/DatePicker.svelte';
import Planner from '#lib/components/Planner/Planner.svelte';
import ResourceTimeline from '#lib/components/ResourceTimeline/ResourceTimeline.svelte';
import { toIso } from '#lib/date/index.js';

const previousTz = process.env.TZ;
process.env.TZ = 'Europe/Berlin';
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(component: unknown, props: Record<string, unknown>) {
  const instance = mount(component as Component<Record<string, unknown>>, {
    target: document.body,
    props
  });
  dispose = () => unmount(instance);
  flushSync();
}

const cell = (iso: string, scope = '[data-date]') =>
  document.querySelector<HTMLElement>(`${scope}[data-date="${iso}"]`);
const isDisabled = (iso: string, scope?: string) =>
  cell(iso, scope)?.getAttribute('aria-disabled') === 'true';

/** Every in-month day carrying `aria-disabled`, for the March 2026 grids. */
function disabledMarchDays(scope = '[data-date]'): string[] {
  const days = [...document.querySelectorAll<HTMLElement>(scope)]
    .filter((el) => el.dataset.date?.startsWith('2026-03-'))
    .filter((el) => el.getAttribute('aria-disabled') === 'true')
    .map((el) => el.dataset.date as string);
  return [...new Set(days)].sort();
}

const isLocalMidnight = (d: Date) =>
  d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

function openCalendar() {
  fireEvent.click(document.querySelector('button[aria-label="Open calendar"]') as HTMLElement);
  flushSync();
}

function typeAndLeave(text: string) {
  const input = document.querySelector<HTMLInputElement>('input:not([type="hidden"])');
  if (!input) throw new Error('picker input not rendered');
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: text } });
  fireEvent.focusOut(input);
  flushSync();
}

// ─── The list fixture ───────────────────────────────────────────────────────

/** Built fresh per use, so no test can lean on object identity. */
const holidayList = () => [
  new Date(2026, 2, 6), // local midnight
  new Date(2026, 2, 17, 14, 30), // a time of day
  new Date(2026, 2, 20, 23, 59, 59, 999), // the day's last millisecond
  new Date(new Date(2026, 2, 28).getTime() + 2 * 86_400_000), // +48 h across the switch: 30 Mar 01:00
  new Date('2026-03-24T23:30:00Z'), // a UTC instant: 25 Mar 00:30 local
  new Date(2026, 2, 29, 3, 0) // the switch day itself, after the switch
];

/** The local calendar days `holidayList()` names. */
const LISTED_DAYS = [
  '2026-03-06',
  '2026-03-17',
  '2026-03-20',
  '2026-03-25',
  '2026-03-29',
  '2026-03-30'
];

/** The replacement the JSDoc and MIGRATION.md give. */
function toIsoPredicate(list: Date[]) {
  const blocked = new Set(list.map(toIso));
  return (d: Date) => blocked.has(toIso(d));
}

it('runs in Europe/Berlin, where 29 Mar 2026 switches to summer time', () => {
  expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-60);
  expect(new Date(2026, 2, 30, 12).getTimezoneOffset()).toBe(-120);
});

// ─── 1 + 2: what it receives, and the list replacement ─────────────────────

describe('a list kept as a Set of toIso keys', () => {
  it('Calendar disables exactly the listed days', () => {
    render(Calendar, {
      defaultDate: new Date(2026, 2, 15),
      isDateDisabled: toIsoPredicate(holidayList())
    });
    expect(disabledMarchDays()).toEqual(LISTED_DAYS);
  });

  it('DatePicker disables them in the calendar and rejects them typed', () => {
    const onValueChange = vi.fn();
    render(DatePicker, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: toIsoPredicate(holidayList()),
      onValueChange
    });
    openCalendar();
    expect(disabledMarchDays()).toEqual(LISTED_DAYS);

    // Typed: the six listed days are rejected, their neighbours accepted.
    const accepted: number[] = [];
    for (const day of [6, 16, 17, 20, 24, 25, 29, 30]) {
      onValueChange.mockClear();
      typeAndLeave(`${String(day).padStart(2, '0')}.03.2026`);
      if (onValueChange.mock.calls.length > 0) accepted.push(day);
    }
    expect(accepted).toEqual([16, 24]);
  });

  it('DateRangePicker disables them in the calendar', () => {
    render(DateRangePickerHarness, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: toIsoPredicate(holidayList())
    });
    openCalendar();
    expect(disabledMarchDays()).toEqual(LISTED_DAYS);
  });

  it('Planner disables exactly the listed days', () => {
    render(Planner, {
      view: 'month',
      value: new Date(2026, 2, 15),
      items: [],
      getDate: () => '2026-03-01',
      isDateDisabled: toIsoPredicate(holidayList())
    });
    expect(disabledMarchDays('[role="gridcell"]')).toEqual(LISTED_DAYS);
  });

  it('ResourceTimeline disables exactly the listed days, in every lane', () => {
    render(ResourceTimeline, {
      view: 'days',
      days: 31,
      value: new Date(2026, 2, 1),
      resources: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' }
      ],
      items: [],
      getResourceId: () => 'a',
      getRange: () => ({ start: '2026-03-01', end: '2026-03-01' }),
      isDateDisabled: toIsoPredicate(holidayList())
    });
    expect(disabledMarchDays('[role="gridcell"][data-lane="0"]')).toEqual(LISTED_DAYS);
    expect(disabledMarchDays('[role="gridcell"][data-lane="1"]')).toEqual(LISTED_DAYS);
  });

  it('a naive predicate does not: includes matches none, getTime only the midnight entry', () => {
    const list = holidayList();
    render(Calendar, {
      defaultDate: new Date(2026, 2, 15),
      isDateDisabled: (d: Date) => list.includes(d)
    });
    expect(disabledMarchDays()).toEqual([]);
    dispose?.();

    render(Calendar, {
      defaultDate: new Date(2026, 2, 15),
      isDateDisabled: (d: Date) => list.some((l) => l.getTime() === d.getTime())
    });
    expect(disabledMarchDays()).toEqual(['2026-03-06']);
  });
});

describe('a disabledDates left in a spread disables nothing and warns once', () => {
  // Written in markup it is a type error; a spread of an object type-checks.
  const march = { locale: 'de-DE', defaultMonth: 2, defaultYear: 2026 };
  it.each([
    ['Calendar', Calendar, { defaultDate: new Date(2026, 2, 15) }, false],
    ['DatePicker', DatePicker, march, true],
    ['DateRangePicker', DateRangePickerHarness, march, true],
    [
      'Planner',
      Planner,
      { view: 'month', value: new Date(2026, 2, 15), items: [], getDate: () => '2026-03-01' },
      false
    ]
  ] as const)('%s', (name, component, props, popup) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const leftover: Record<string, unknown> = { disabledDates: holidayList() };
    try {
      render(component, { ...props, ...leftover });
      if (popup) openCalendar();
      expect(disabledMarchDays()).toEqual([]);
      const warnings = warn.mock.calls.filter(([m]) => String(m).includes('disabledDates'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toContain(`[${name}]`);
      expect(warnings[0][0]).toContain('isDateDisabled={(d) => blocked.has(toIso(d))}');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('every date the predicate receives is at local midnight', () => {
  function recorder() {
    const received: Date[] = [];
    const predicate = (d: Date) => {
      received.push(d);
      return false;
    };
    return { received, predicate };
  }

  // The control each view selects a day with: the month grid's day, the week
  // view's column heading, the mini calendar's day. The year view selects none.
  it.each([
    ['month', 'button[data-date="2026-03-29"]'],
    ['week', 'button[data-weekday="6"]'],
    ['day', 'button[data-mini-date="2026-03-29"]'],
    ['agenda', 'button[data-mini-date="2026-03-29"]'],
    ['year', null]
  ] as const)('Calendar, view=%s', (view, selectControl) => {
    const { received, predicate } = recorder();
    render(Calendar, {
      view,
      defaultDate: new Date(2026, 2, 29),
      showMiniCalendar: true,
      isDateDisabled: predicate
    });
    if (selectControl) {
      fireEvent.click(document.querySelector(selectControl) as HTMLElement);
      flushSync();
      expect(received.map(toIso)).toContain('2026-03-29');
    }
    expect(received.filter((d) => !isLocalMidnight(d))).toEqual([]);
  });

  it('DatePicker: the calendar and the typed check', () => {
    const { received, predicate } = recorder();
    render(DatePicker, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: predicate
    });
    typeAndLeave('29.03.2026');
    const typedCalls = received.length;
    openCalendar();
    expect(typedCalls).toBeGreaterThan(0);
    expect(received.length).toBeGreaterThan(typedCalls);
    expect(received.filter((d) => !isLocalMidnight(d))).toEqual([]);
  });

  it('DateRangePicker: the typed check of both ends', () => {
    const { received, predicate } = recorder();
    render(DateRangePickerHarness, { locale: 'de-DE', isDateDisabled: predicate });
    typeAndLeave('28.03.2026 – 30.03.2026');
    expect(received.map(toIso)).toEqual(['2026-03-28', '2026-03-30']);
    expect(received.filter((d) => !isLocalMidnight(d))).toEqual([]);
  });

  it.each(['month', 'week', 'range'] as const)('Planner, view=%s', (view) => {
    const { received, predicate } = recorder();
    render(Planner, {
      view,
      value: new Date(2026, 2, 29),
      rangeStart: new Date(2026, 2, 27),
      rangeEnd: new Date(2026, 3, 2),
      items: [],
      getDate: () => '2026-03-01',
      isDateDisabled: predicate
    });
    expect(received.length).toBeGreaterThan(0);
    expect(received.filter((d) => !isLocalMidnight(d))).toEqual([]);
  });

  it.each(['week', 'days'] as const)('ResourceTimeline, view=%s', (view) => {
    const { received, predicate } = recorder();
    render(ResourceTimeline, {
      view,
      days: 5,
      value: new Date(2026, 2, 28),
      resources: [{ id: 'a', label: 'A' }],
      items: [],
      getResourceId: () => 'a',
      getRange: () => ({ start: '2026-03-01', end: '2026-03-01' }),
      isDateDisabled: predicate
    });
    expect(received.length).toBeGreaterThan(0);
    expect(received.filter((d) => !isLocalMidnight(d))).toEqual([]);
  });
});

// ─── 3: a predicate that changes is followed ────────────────────────────────

/** Closes the 12th while `gate.closed` is set — a predicate that reads `$state`. */
const gate = $state({ closed: false });
const closesThe12th = (d: Date) => gate.closed && toIso(d) === '2026-03-12';
afterEach(() => {
  gate.closed = false;
});

function setGate(closed: boolean) {
  gate.closed = closed;
  flushSync();
}

describe('Calendar follows the predicate', () => {
  const grid = () => document.querySelector<HTMLElement>('[role="grid"]') as HTMLElement;
  const key = (k: string) => {
    fireEvent.keyDown(grid(), { key: k });
    flushSync();
  };

  it('in the rendered cell', () => {
    render(Calendar, { defaultDate: new Date(2026, 2, 11), isDateDisabled: closesThe12th });
    expect(isDisabled('2026-03-12')).toBe(false);
    setGate(true);
    expect(isDisabled('2026-03-12')).toBe(true);
    // `aria-disabled` alone: a browser does not focus a disabled button, and
    // the arrows must land on it. Where focus goes: e2e/calendar.spec.ts.
    expect((cell('2026-03-12') as HTMLButtonElement).disabled).toBe(false);
    setGate(false);
    expect(isDisabled('2026-03-12')).toBe(false);
  });

  it('in keyboard selection', () => {
    const onValueChange = vi.fn();
    render(Calendar, {
      defaultDate: new Date(2026, 2, 11),
      isDateDisabled: closesThe12th,
      onValueChange
    });
    setGate(true);
    key('ArrowRight'); // focus 11 → 12, onto the disabled day
    key('Enter');
    expect(onValueChange).not.toHaveBeenCalled();

    setGate(false);
    key('Enter');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(toIso(onValueChange.mock.calls[0][0])).toBe('2026-03-12');
  });

  // Only the month grid marks a disabled day; these controls select through
  // the same controller, so the predicate still gates them.
  it.each([
    ['week', 'button[data-weekday="3"]'],
    ['day', 'button[data-mini-date="2026-03-12"]']
  ] as const)('in the %s view’s selection control', (view, control) => {
    const onValueChange = vi.fn();
    render(Calendar, {
      view,
      defaultDate: new Date(2026, 2, 12),
      showMiniCalendar: true,
      isDateDisabled: closesThe12th,
      onValueChange
    });
    setGate(true);
    fireEvent.click(document.querySelector(control) as HTMLElement);
    flushSync();
    expect(onValueChange).not.toHaveBeenCalled();

    setGate(false);
    fireEvent.click(document.querySelector(control) as HTMLElement);
    flushSync();
    expect(onValueChange.mock.calls.map(([d]) => toIso(d))).toEqual(['2026-03-12']);
  });

  it('when the prop is swapped for another predicate', () => {
    const props = $state({
      defaultDate: new Date(2026, 2, 11),
      isDateDisabled: (_d: Date): boolean => false
    });
    render(Calendar, props);
    expect(isDisabled('2026-03-12')).toBe(false);
    props.isDateDisabled = (d: Date) => toIso(d) === '2026-03-12';
    flushSync();
    expect(isDisabled('2026-03-12')).toBe(true);
  });
});

describe('DatePicker follows the predicate', () => {
  it('in the open calendar', () => {
    render(DatePicker, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: closesThe12th
    });
    openCalendar();
    expect(isDisabled('2026-03-12')).toBe(false);
    setGate(true);
    expect(isDisabled('2026-03-12')).toBe(true);
  });

  it('in the typed-input check', () => {
    const onValueChange = vi.fn();
    render(DatePicker, { locale: 'de-DE', isDateDisabled: closesThe12th, onValueChange });
    setGate(true);
    typeAndLeave('12.03.2026');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('outside the allowed range');

    setGate(false);
    typeAndLeave('12.03.2026');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(toIso(onValueChange.mock.calls[0][0])).toBe('2026-03-12');
  });

  it('when the prop is swapped for another predicate', () => {
    const onValueChange = vi.fn();
    const props = $state({
      locale: 'de-DE',
      onValueChange,
      isDateDisabled: (_d: Date): boolean => false
    });
    render(DatePicker, props);
    props.isDateDisabled = (d: Date) => toIso(d) === '2026-03-12';
    flushSync();
    typeAndLeave('12.03.2026');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('DateRangePicker follows the predicate', () => {
  const rangeState = () => document.querySelector<HTMLElement>('[data-testid="range-state"]');
  const range = () => `${rangeState()?.dataset.start}..${rangeState()?.dataset.end}`;
  const pick = (iso: string) => {
    fireEvent.click(cell(iso) as HTMLElement);
    flushSync();
  };

  it('in the open calendar', () => {
    render(DateRangePickerHarness, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: closesThe12th
    });
    openCalendar();
    expect(isDisabled('2026-03-12')).toBe(false);
    setGate(true);
    expect(isDisabled('2026-03-12')).toBe(true);
  });

  it('checks only a range’s two ends: it may span a disabled day, not start or end on one', () => {
    render(DateRangePickerHarness, {
      locale: 'de-DE',
      defaultMonth: 2,
      defaultYear: 2026,
      isDateDisabled: closesThe12th
    });
    setGate(true);
    openCalendar();
    pick('2026-03-12'); // disabled: no range starts on it
    expect(range()).toBe('..');
    pick('2026-03-10');
    pick('2026-03-14');
    expect(range()).toBe('2026-03-10..2026-03-14');

    openCalendar();
    pick('2026-03-10');
    pick('2026-03-12'); // disabled: the range stays open on its start
    expect(range()).toBe('2026-03-10..2026-03-10');

    setGate(false);
    pick('2026-03-12');
    expect(range()).toBe('2026-03-10..2026-03-12');
  });

  it('in the typed-input check of both ends', () => {
    render(DateRangePickerHarness, { locale: 'de-DE', isDateDisabled: closesThe12th });
    setGate(true);
    typeAndLeave('10.03.2026 – 12.03.2026');
    expect(range()).toBe('..');
    expect(document.body.textContent).toContain('outside the allowed range');
    typeAndLeave('12.03.2026 – 14.03.2026');
    expect(range()).toBe('..');
    typeAndLeave('10.03.2026 – 14.03.2026');
    expect(range()).toBe('2026-03-10..2026-03-14');

    setGate(false);
    typeAndLeave('10.03.2026 – 12.03.2026');
    expect(range()).toBe('2026-03-10..2026-03-12');
  });
});

describe('Planner follows the predicate', () => {
  const plannerCell = (iso: string) => cell(iso, '[role="gridcell"]') as HTMLElement;
  const baseProps = () => ({
    view: 'month',
    value: new Date(2026, 2, 11),
    items: [],
    getDate: () => '2026-03-01'
  });

  it('in the rendered cell, click and keyboard selection', () => {
    const onDateSelect = vi.fn();
    render(Planner, { ...baseProps(), isDateDisabled: closesThe12th, onDateSelect });
    setGate(true);
    expect(isDisabled('2026-03-12', '[role="gridcell"]')).toBe(true);
    fireEvent.click(plannerCell('2026-03-12'));
    flushSync();
    fireEvent.keyDown(plannerCell('2026-03-11'), { key: 'ArrowRight' });
    flushSync();
    fireEvent.keyDown(plannerCell('2026-03-12'), { key: 'Enter' });
    flushSync();
    expect(onDateSelect).not.toHaveBeenCalled();

    setGate(false);
    expect(isDisabled('2026-03-12', '[role="gridcell"]')).toBe(false);
    fireEvent.keyDown(plannerCell('2026-03-12'), { key: 'Enter' });
    flushSync();
    fireEvent.click(plannerCell('2026-03-12'));
    flushSync();
    expect(onDateSelect).toHaveBeenCalledTimes(2);
    expect(onDateSelect.mock.calls.map(([d]) => toIso(d))).toEqual(['2026-03-12', '2026-03-12']);
  });

  it('when the prop is swapped for another predicate', () => {
    const props = $state({ ...baseProps(), isDateDisabled: (_d: Date): boolean => false });
    render(Planner, props);
    expect(isDisabled('2026-03-12', '[role="gridcell"]')).toBe(false);
    props.isDateDisabled = (d: Date) => toIso(d) === '2026-03-12';
    flushSync();
    expect(isDisabled('2026-03-12', '[role="gridcell"]')).toBe(true);
  });
});

describe('ResourceTimeline follows the predicate', () => {
  const baseProps = () => ({
    view: 'days',
    days: 3,
    value: new Date(2026, 2, 11),
    resources: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ],
    items: [],
    getResourceId: () => 'a',
    getRange: () => ({ start: '2026-03-01', end: '2026-03-01' })
  });
  const lane = (n: number, _iso?: string) => `[role="gridcell"][data-lane="${n}"]`;
  const at = (n: number, iso: string) => cell(iso, lane(n, iso)) as HTMLElement;

  it('in every lane’s cell, and in click and keyboard activation', () => {
    const onCellClick = vi.fn();
    render(ResourceTimeline, { ...baseProps(), isDateDisabled: closesThe12th, onCellClick });
    setGate(true);
    expect(isDisabled('2026-03-12', lane(0, '2026-03-12'))).toBe(true);
    expect(isDisabled('2026-03-12', lane(1, '2026-03-12'))).toBe(true);
    // The keys act on the roving cursor, which starts on the window's first day.
    fireEvent.keyDown(at(0, '2026-03-11'), { key: 'ArrowRight' });
    flushSync();
    fireEvent.keyDown(at(0, '2026-03-12'), { key: 'Enter' });
    flushSync();
    fireEvent.click(at(1, '2026-03-12'));
    flushSync();
    expect(onCellClick).not.toHaveBeenCalled();

    setGate(false);
    expect(isDisabled('2026-03-12', lane(1, '2026-03-12'))).toBe(false);
    // The blocked click still moved the cursor to lane B.
    fireEvent.keyDown(at(1, '2026-03-12'), { key: 'Enter' });
    flushSync();
    fireEvent.click(at(0, '2026-03-12'));
    flushSync();
    expect(onCellClick.mock.calls.map(([r, d]) => `${r.id}:${toIso(d)}`)).toEqual([
      'b:2026-03-12',
      'a:2026-03-12'
    ]);
  });

  it('when the prop is swapped for another predicate', () => {
    const props = $state({ ...baseProps(), isDateDisabled: (_d: Date): boolean => false });
    render(ResourceTimeline, props);
    expect(isDisabled('2026-03-12', lane(0, '2026-03-12'))).toBe(false);
    props.isDateDisabled = (d: Date) => toIso(d) === '2026-03-12';
    flushSync();
    expect(isDisabled('2026-03-12', lane(0, '2026-03-12'))).toBe(true);
  });
});
