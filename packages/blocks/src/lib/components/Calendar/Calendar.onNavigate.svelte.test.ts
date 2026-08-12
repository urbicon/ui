// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '$lib/translations/en';
import Calendar from './Calendar.svelte';
import type { DateRange } from './calendar.types';

/**
 * `onNavigate` across every built-in navigation surface (issue #97, PR review).
 *
 * The prop shipped wired to exactly two of the seven paths that move
 * `referenceDate`. Both were controller-driven; the five that assign it
 * directly reported only their view-specific callback, so the header's month
 * picker, the year grid's month tile, the mini calendar's neighbouring-month
 * day and — in year view — the arrows and swipe all moved the grid without a
 * word. The prop's own docs promise "fires after **any** navigation, in every
 * view", so a data loader wired to it rendered September's events under an
 * October heading.
 *
 * Every case here drives the REAL surface — a click on the rendered control —
 * rather than calling the context method, because "the method emits" was never
 * in doubt; "the button reaches a method that emits" is what broke. jsdom is
 * required for that: unlike the rest of this component's suites, none of it is
 * observable in SSR output.
 *
 * Selectors come from `$lib/translations/en` rather than hardcoded strings:
 * with no `<I18nProvider>` mounted, blocks i18n resolves to the base locale
 * (`en`) deterministically, independent of the runtime `LANG` — but importing
 * the bundle keeps the test honest if a label is ever reworded.
 */

const bt = en.calendar;

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

type NavCall = { date: Date; range: DateRange };

function renderCalendar(props: Partial<ComponentProps<typeof Calendar>> = {}) {
  const calls: NavCall[] = [];
  const onNavigate = vi.fn((date: Date, range: DateRange) => {
    calls.push({ date, range });
  });
  const instance = mount(Calendar, {
    target: document.body,
    props: { onNavigate, ...props } as ComponentProps<typeof Calendar>
  });
  dispose = () => unmount(instance);
  flushSync();
  return { calls, onNavigate };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function byLabel(label: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!el) throw new Error(`no element labelled "${label}"`);
  return el;
}

function click(el: HTMLElement) {
  el.click();
  flushSync();
}

// A fixed anchor, so nothing here depends on the wall clock.
const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026

describe('Calendar onNavigate — header arrows, every view', () => {
  // The arrow path runs through `controller.navigate` for month/week/day,
  // through `navigateYear` for year — the one that bypassed the controller —
  // and through `navigateAgenda` for the agenda, whose window is its own step
  // (hence the range label, not a month's).
  const cases = [
    { view: 'month', next: bt.nextMonth },
    { view: 'week', next: bt.nextWeek },
    { view: 'day', next: bt.nextDay },
    { view: 'agenda', next: bt.nextRange },
    { view: 'year', next: bt.nextYear }
  ] as const;

  for (const { view, next } of cases) {
    it(`fires when the forward arrow is used in ${view} view`, () => {
      const { onNavigate, calls } = renderCalendar({ view, defaultDate: anchor });
      click(byLabel(next));
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(calls[0].range.start).toBeInstanceOf(Date);
      expect(calls[0].range.end.getTime()).toBeGreaterThanOrEqual(calls[0].range.start.getTime());
    });
  }

  it('reports the year as 1 Jan–31 Dec after a year-view arrow', () => {
    // The documented year range — and the one that could never be observed,
    // because year-view arrows emitted nothing at all.
    const { calls } = renderCalendar({ view: 'year', defaultDate: anchor });
    click(byLabel(bt.nextYear));
    expect(iso(calls[0].range.start)).toBe('2027-01-01');
    expect(iso(calls[0].range.end)).toBe('2027-12-31');
  });

  it('reports a padded 6-week window after a month-view arrow', () => {
    const { calls } = renderCalendar({ view: 'month', defaultDate: anchor, fixedWeeks: true });
    click(byLabel(bt.nextMonth));
    // July 2026 with Monday weeks, padded: the window starts in the spill.
    expect(calls[0].range.start.getDay()).toBe(1);
    expect(calls[0].range.end.getDay()).toBe(0);
  });

  it('reports the seven visible days after a week-view arrow', () => {
    const { calls } = renderCalendar({ view: 'week', defaultDate: anchor });
    click(byLabel(bt.nextWeek));
    expect(iso(calls[0].range.start)).toBe('2026-06-22');
    expect(iso(calls[0].range.end)).toBe('2026-06-28');
  });
});

describe('Calendar onNavigate — the header month picker', () => {
  // The reported failure: the title is a popover trigger with a 12-month grid,
  // present by default in EVERY view. It routes to ctx.goToMonth, which moved
  // the grid and fired onMonthChange but never onNavigate.
  function openMonthPicker() {
    const trigger = document.querySelector<HTMLElement>('[aria-expanded]');
    if (!trigger) throw new Error('no month-picker trigger');
    click(trigger);
    // The picker renders in a popover; jsdom has no top layer, so query hidden.
    const popover = document.querySelector<HTMLElement>('[popover]');
    if (!popover) throw new Error('month picker did not open');
    // Twelve buttons in month order — position, not label, so the assertion is
    // locale-independent.
    return Array.from(popover.querySelectorAll<HTMLElement>('button')).slice(-12);
  }

  it('fires when a month is picked from the title popover', () => {
    const { onNavigate, calls } = renderCalendar({ view: 'month', defaultDate: anchor });
    const months = openMonthPicker();
    click(months[9]); // October
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(calls[0].date.getMonth()).toBe(9);
  });

  it('reports the October window, not the September one', () => {
    // The concrete data-loading bug: grid jumps, loader never refetches, so the
    // sheet shows October with September's events.
    const { calls } = renderCalendar({ view: 'month', defaultDate: anchor });
    click(openMonthPicker()[9]);
    expect(calls[0].range.start.getTime()).toBeLessThanOrEqual(new Date(2026, 9, 1).getTime());
    expect(calls[0].range.end.getTime()).toBeGreaterThanOrEqual(new Date(2026, 9, 31).getTime());
  });

  it('fires alongside onMonthChange, not instead of it', () => {
    const onMonthChange = vi.fn();
    const { onNavigate } = renderCalendar({ view: 'month', defaultDate: anchor, onMonthChange });
    click(openMonthPicker()[9]);
    expect(onMonthChange).toHaveBeenCalledWith(9, 2026);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('Calendar onNavigate — the year grid month tile', () => {
  it('fires when a month tile is tapped', () => {
    const { onNavigate, calls } = renderCalendar({ view: 'year', defaultDate: anchor });
    const tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-month]'));
    expect(tiles).toHaveLength(12);
    click(tiles[9]); // October
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(calls[0].date.getMonth()).toBe(9);
  });
});

describe('Calendar onNavigate — the mini calendar', () => {
  it('fires when a day from a neighbouring month is clicked', () => {
    // The mini calendar's day click routes through `ctx.goToDate` in all three
    // views it appears in. Until 2026-08-12 the agenda took a `goToMonth` arm
    // instead (its list started at the 1st) and landed on the month's anchor;
    // now the clicked DAY is the anchor, which is what this asserts.
    const { onNavigate, calls } = renderCalendar({
      view: 'agenda',
      defaultDate: anchor,
      showMiniCalendar: true
    });
    const spill = document.querySelector<HTMLElement>('[data-mini-date="2026-07-01"]');
    if (!spill) throw new Error('no July spill day in the June mini month');
    click(spill);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(iso(calls[0].date)).toBe('2026-07-01');
  });

  // COVERAGE, NOT REGRESSION: the only case in this file that also passed
  // before the `onNavigate` fix — week view already routed the mini calendar
  // through `ctx.goToDate` → controller → `handleNavigate`, which emitted. Kept
  // so the path stays covered now that the agenda shares it.
  it('fires when a neighbouring-month day is clicked in week view', () => {
    const { onNavigate } = renderCalendar({
      view: 'week',
      defaultDate: anchor,
      showMiniCalendar: true
    });
    const spill = document.querySelector<HTMLElement>('[data-mini-date="2026-07-01"]');
    if (!spill) throw new Error('no July spill day in the June mini month');
    click(spill);
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('Calendar onNavigate — the remaining built-in paths', () => {
  it('fires on the Today button', () => {
    const { onNavigate } = renderCalendar({ view: 'month', defaultDate: new Date(2020, 0, 15) });
    click(byLabel(bt.today));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('fires on a month-view spill-day click', () => {
    // The spill jump assigns referenceDate outside the controller too.
    const { onNavigate, calls } = renderCalendar({ view: 'month', defaultDate: anchor });
    const spill = document.querySelector<HTMLElement>('[data-date="2026-07-01"]');
    if (!spill) throw new Error('no July spill day in the June grid');
    click(spill);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(calls[0].date.getMonth()).toBe(6);
  });

  it('does not double-fire on any single navigation', () => {
    // goToClampedMonth emits once; nothing downstream re-enters the controller.
    const { onNavigate } = renderCalendar({ view: 'month', defaultDate: anchor });
    click(byLabel(bt.nextMonth));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    click(byLabel(bt.nextMonth));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('stays silent while nothing navigates', () => {
    // The positive control's negative half: mounting alone must not emit, or
    // every assertion above would pass for the wrong reason.
    const { onNavigate } = renderCalendar({ view: 'month', defaultDate: anchor });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('is not required — navigation works without it', () => {
    const instance = mount(Calendar, {
      target: document.body,
      props: { view: 'month', defaultDate: anchor } as ComponentProps<typeof Calendar>
    });
    dispose = () => unmount(instance);
    flushSync();
    expect(() => click(byLabel(bt.nextMonth))).not.toThrow();
  });
});
