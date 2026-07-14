import { describe, expect, it, vi } from 'vitest';
import { handleDateGridKeydown } from './date-grid.keyboard';
import { DateGridController, type DateGridOptions } from './date-grid.svelte';
import type { DateGridRange, DateGridSelection, DateGridView } from './date-grid.types';

/** Minimal KeyboardEvent stand-in (the test env is `node` — no DOM). */
function keyEvent(key: string, shiftKey = false): KeyboardEvent {
  let prevented = false;
  return {
    key,
    shiftKey,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    }
  } as unknown as KeyboardEvent;
}

/**
 * Reactive test harness. Mirrors the controlled-input contract: value fields are
 * `$state`, `onNavigate`/`onSelect` materialise back into them, so the
 * controller's `$derived` geometry recomputes exactly as it would behind a
 * Calendar/Planner wrapper.
 */
interface HarnessInit {
  referenceDate?: Date;
  view?: DateGridView;
  weekStartsOn?: number;
  locale?: string;
  selectionMode?: DateGridOptions['selectionMode'];
  selection?: DateGridSelection;
  rangeStart?: Date;
  rangeEnd?: Date;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  isDateDisabled?: (d: Date) => boolean;
}

class Harness {
  referenceDate = $state(new Date(2026, 5, 16)); // Tue Jun 16 2026
  view = $state<DateGridView>('month');
  weekStartsOn = $state(1);
  locale = $state('de-DE');
  selectionMode = $state<DateGridOptions['selectionMode']>('single');
  selection = $state<DateGridSelection | undefined>(undefined);
  rangeStart = $state<Date | undefined>(undefined);
  rangeEnd = $state<Date | undefined>(undefined);
  minDate = $state<Date | undefined>(undefined);
  maxDate = $state<Date | undefined>(undefined);
  disabled = $state(false);
  isDateDisabled: ((d: Date) => boolean) | undefined;

  navigations: Array<{ date: Date; range: DateGridRange }> = [];
  selections: DateGridSelection[] = [];
  controller: DateGridController;

  constructor(init: HarnessInit = {}) {
    if (init.referenceDate) this.referenceDate = init.referenceDate;
    if (init.view) this.view = init.view;
    if (init.weekStartsOn !== undefined) this.weekStartsOn = init.weekStartsOn;
    if (init.locale) this.locale = init.locale;
    if (init.selectionMode) this.selectionMode = init.selectionMode;
    if (init.selection !== undefined) this.selection = init.selection;
    if (init.rangeStart) this.rangeStart = init.rangeStart;
    if (init.rangeEnd) this.rangeEnd = init.rangeEnd;
    if (init.minDate) this.minDate = init.minDate;
    if (init.maxDate) this.maxDate = init.maxDate;
    if (init.disabled !== undefined) this.disabled = init.disabled;
    this.isDateDisabled = init.isDateDisabled;

    const self = this;
    this.controller = new DateGridController({
      get referenceDate() {
        return self.referenceDate;
      },
      get view() {
        return self.view;
      },
      get weekStartsOn() {
        return self.weekStartsOn;
      },
      get locale() {
        return self.locale;
      },
      get selectionMode() {
        return self.selectionMode;
      },
      get selection() {
        return self.selection;
      },
      get rangeStart() {
        return self.rangeStart;
      },
      get rangeEnd() {
        return self.rangeEnd;
      },
      get minDate() {
        return self.minDate;
      },
      get maxDate() {
        return self.maxDate;
      },
      get disabled() {
        return self.disabled;
      },
      isDateDisabled: (d) => self.isDateDisabled?.(d) ?? false,
      onNavigate(date, range) {
        self.navigations.push({ date, range });
        self.referenceDate = date;
      },
      onSelect(sel) {
        self.selections.push(sel);
        self.selection = sel;
      }
    });
  }
}

const iso = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('DateGridController — month geometry', () => {
  it('lays out June 2026 as 5 week rows starting Monday', () => {
    const { controller } = new Harness({ referenceDate: new Date(2026, 5, 16) });
    const cells = controller.cells;
    // June 1 2026 is a Monday; 30 days → 5 rows with Monday start.
    expect(cells).toHaveLength(5);
    for (const row of cells) {
      expect(row).toHaveLength(7);
      expect(row[0].getDay()).toBe(1); // Monday
    }
    expect(iso(cells[0][0])).toBe('2026-6-1');
  });

  it('exposes the visible range as the grid edges', () => {
    const { controller } = new Harness({ referenceDate: new Date(2026, 5, 16) });
    expect(iso(controller.rangeStart)).toBe('2026-6-1');
    expect(iso(controller.rangeEnd)).toBe('2026-7-5'); // spill into July
  });

  it('flags spill days as outside the focused month', () => {
    const { controller } = new Harness({ referenceDate: new Date(2026, 5, 16) });
    expect(controller.isOutside(new Date(2026, 6, 5))).toBe(true); // July spill
    expect(controller.isOutside(new Date(2026, 5, 16))).toBe(false); // June
  });

  it('localizes the title and weekday names', () => {
    const { controller } = new Harness({ referenceDate: new Date(2026, 5, 16) });
    expect(controller.title).toBe('Juni 2026');
    expect(controller.weekdayNames[0]).toMatch(/^Mo/);
    expect(controller.weekdayNames[6]).toMatch(/^So/);
  });
});

describe('DateGridController — week / day / range geometry', () => {
  it('week view is a single Monday-anchored row', () => {
    const { controller } = new Harness({ view: 'week', referenceDate: new Date(2026, 5, 16) });
    expect(controller.cells).toHaveLength(1);
    expect(iso(controller.cells[0][0])).toBe('2026-6-15'); // Mon
    expect(iso(controller.cells[0][6])).toBe('2026-6-21'); // Sun
    expect(controller.isOutside(new Date(2026, 5, 21))).toBe(false);
  });

  it('day view is a single cell', () => {
    const { controller } = new Harness({ view: 'day', referenceDate: new Date(2026, 5, 16) });
    expect(controller.cells).toHaveLength(1);
    expect(controller.cells[0]).toHaveLength(1);
    expect(iso(controller.cells[0][0])).toBe('2026-6-16');
  });

  it('range view chunks full weeks covering [rangeStart, rangeEnd]', () => {
    const { controller } = new Harness({
      view: 'range',
      referenceDate: new Date(2026, 5, 16),
      rangeStart: new Date(2026, 5, 10), // Wed Jun 10
      rangeEnd: new Date(2026, 5, 24) // Wed Jun 24
    });
    const cells = controller.cells;
    // Weeks: Jun 8-14, 15-21, 22-28 → 3 rows.
    expect(cells).toHaveLength(3);
    expect(iso(cells[0][0])).toBe('2026-6-8'); // Mon before rangeStart
    expect(iso(cells[2][6])).toBe('2026-6-28'); // Sun after rangeEnd
    expect(controller.isOutside(new Date(2026, 5, 8))).toBe(true); // before range
    expect(controller.isOutside(new Date(2026, 5, 10))).toBe(false); // in range
  });

  it('tolerates an inverted range (rangeStart > rangeEnd) without empty cells', () => {
    const { controller } = new Harness({
      view: 'range',
      referenceDate: new Date(2026, 5, 16),
      rangeStart: new Date(2026, 5, 24), // later than rangeEnd
      rangeEnd: new Date(2026, 5, 10)
    });
    // Bounds are ordered low→high → same 3 weeks as the non-inverted case;
    // cells never empties, so the range-view getters cannot throw.
    expect(controller.cells).toHaveLength(3);
    expect(iso(controller.rangeStart)).toBe('2026-6-8');
    expect(iso(controller.rangeEnd)).toBe('2026-6-28');
    expect(() => controller.title).not.toThrow();
  });
});

describe('DateGridController — navigation', () => {
  it('navigates months and emits the new reference + range', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.navigate(1);
    expect(h.navigations).toHaveLength(1);
    expect(h.navigations[0].date.getMonth()).toBe(6); // July
    expect(h.navigations[0].date.getDate()).toBe(16); // day-of-month preserved (16 Jun → 16 Jul)
    expect(h.controller.navDirection).toBe('forward');
    // reference materialised → geometry now reflects July
    expect(h.controller.title).toBe('Juli 2026');
  });

  it('navigates months backward across a year boundary', () => {
    const h = new Harness({ referenceDate: new Date(2026, 0, 10) }); // Jan 2026
    h.controller.navigate(-1);
    expect(h.navigations[0].date.getFullYear()).toBe(2025);
    expect(h.navigations[0].date.getMonth()).toBe(11); // December
    expect(h.controller.navDirection).toBe('backward');
  });

  it('preserves the day-of-month across month navigation, clamping to shorter months', () => {
    const h = new Harness({ referenceDate: new Date(2026, 0, 31) }); // Jan 31
    h.controller.navigate(1); // → February 2026 (28 days)
    // Clamped to the last valid day, never snapped to the 1st — so a week/day view
    // sharing this reference anchors on a real in-month day, not the prior month's tail.
    expect(iso(h.navigations[0].date)).toBe('2026-2-28');
  });

  it('navigates weeks by 7 days', () => {
    const h = new Harness({ view: 'week', referenceDate: new Date(2026, 5, 16) });
    h.controller.navigate(1);
    expect(iso(h.navigations[0].date)).toBe('2026-6-23');
  });

  it('navigates days by 1', () => {
    const h = new Harness({ view: 'day', referenceDate: new Date(2026, 5, 16) });
    h.controller.navigate(-1);
    expect(iso(h.navigations[0].date)).toBe('2026-6-15');
  });

  it('navigates a range view by shifting the window by its own span', () => {
    const h = new Harness({
      view: 'range',
      referenceDate: new Date(2026, 5, 16),
      rangeStart: new Date(2026, 5, 1),
      rangeEnd: new Date(2026, 5, 7) // 7-day span
    });
    h.controller.navigate(1);
    expect(h.navigations).toHaveLength(1);
    const { date, range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-8'); // shifted forward by the span
    expect(iso(range.end)).toBe('2026-6-14');
    expect(iso(date)).toBe('2026-6-8'); // emitted reference = new range start
  });

  it('ignores a zero delta', () => {
    const h = new Harness();
    h.controller.navigate(0);
    expect(h.navigations).toHaveLength(0);
  });

  it('clamps month navigation and reports canGoBack/canGoForward (month-granular)', () => {
    const h = new Harness({
      referenceDate: new Date(2026, 5, 16),
      minDate: new Date(2026, 5, 1), // June
      maxDate: new Date(2026, 7, 31) // August
    });
    expect(h.controller.canGoBack).toBe(false); // already at min month
    expect(h.controller.canGoForward).toBe(true);
    h.controller.navigate(-5); // try far past min → clamps to June
    expect(h.navigations[0].date.getMonth()).toBe(5); // June
  });

  it('clamps the preserved day up to a mid-month minDate when navigating into the min month', () => {
    const h = new Harness({
      referenceDate: new Date(2026, 2, 15), // Mar 15
      minDate: new Date(2026, 1, 20) // Feb 20
    });
    h.controller.navigate(-1); // → February; preserved day 15 < minDate day 20
    expect(iso(h.navigations[0].date)).toBe('2026-2-20'); // clamped to minDate, not Feb 15
  });

  it('clamps the preserved day down to a mid-month maxDate when navigating into the max month', () => {
    const h = new Harness({
      referenceDate: new Date(2026, 5, 25), // Jun 25
      maxDate: new Date(2026, 6, 10) // Jul 10
    });
    h.controller.navigate(1); // → July; preserved day 25 > maxDate day 10
    expect(iso(h.navigations[0].date)).toBe('2026-7-10'); // clamped to maxDate
  });

  it('reports day-granular bounds for week view', () => {
    const h = new Harness({
      view: 'week',
      referenceDate: new Date(2026, 5, 16),
      maxDate: new Date(2026, 5, 18)
    });
    // visible week ends Jun 21 > maxDate Jun 18 → cannot go forward
    expect(h.controller.canGoForward).toBe(false);
  });

  // Week/day steps are reachable via swipe + day-view arrow keys, neither of
  // which is gated by canGoBack/canGoForward — so navigate() itself must clamp,
  // or the reference could land on an all-disabled week/day past the boundary.
  it('clamps a forward week step to maxDate instead of onto an all-disabled week', () => {
    const h = new Harness({
      view: 'week',
      referenceDate: new Date(2026, 5, 16), // Tue Jun 16, week Jun 15–21
      maxDate: new Date(2026, 5, 18) // Thu Jun 18
    });
    h.controller.navigate(1); // wants Jun 23 (next week) → past maxDate
    expect(iso(h.navigations[0].date)).toBe('2026-6-18'); // clamped into the max week
  });

  it('clamps a backward week step to minDate', () => {
    const h = new Harness({
      view: 'week',
      referenceDate: new Date(2026, 5, 16),
      minDate: new Date(2026, 5, 15) // Mon Jun 15
    });
    h.controller.navigate(-1); // wants Jun 9 → before minDate
    expect(iso(h.navigations[0].date)).toBe('2026-6-15');
  });

  it('clamps a forward day step to maxDate', () => {
    const h = new Harness({
      view: 'day',
      referenceDate: new Date(2026, 5, 18), // Jun 18 = maxDate
      maxDate: new Date(2026, 5, 18)
    });
    h.controller.navigate(1); // wants Jun 19 → past maxDate
    expect(iso(h.navigations[0].date)).toBe('2026-6-18'); // no move past the bound
  });

  it('clamps a backward day step to minDate', () => {
    const h = new Harness({
      view: 'day',
      referenceDate: new Date(2026, 5, 1), // Jun 1 = minDate
      minDate: new Date(2026, 5, 1)
    });
    h.controller.navigate(-1); // wants May 31 → before minDate
    expect(iso(h.navigations[0].date)).toBe('2026-6-1');
  });

  it('leaves an in-range week step unclamped', () => {
    const h = new Harness({
      view: 'week',
      referenceDate: new Date(2026, 5, 16),
      minDate: new Date(2026, 0, 1),
      maxDate: new Date(2026, 11, 31)
    });
    h.controller.navigate(1); // Jun 23, well within range
    expect(iso(h.navigations[0].date)).toBe('2026-6-23');
  });

  it('goToToday navigates to and focuses today', () => {
    const h = new Harness({ referenceDate: new Date(2020, 0, 1) });
    h.controller.goToToday();
    expect(h.navigations).toHaveLength(1);
    expect(h.controller.isToday(h.controller.focusedDate)).toBe(true);
  });
});

// Range navigation slides the explicit [rangeStart, rangeEnd] window. The clamp
// is span-preserving: the whole window stays inside [minDate, maxDate] and the
// span never collapses — the latest allowed start is maxDate − (span − 1), the
// earliest is minDate. Swipes call navigate() without the header arrows' canGo*
// gate, so the engine itself must hold the bound.
describe('DateGridController — range window bounds', () => {
  const rangeHarness = (init: Partial<HarnessInit> = {}) =>
    new Harness({
      view: 'range',
      referenceDate: new Date(2026, 5, 8),
      rangeStart: new Date(2026, 5, 8), // Mon Jun 8
      rangeEnd: new Date(2026, 5, 14), // Sun Jun 14 → 7-day span
      ...init
    });

  it('clamps a forward shift span-preserving at maxDate (partial shift)', () => {
    const h = rangeHarness({ maxDate: new Date(2026, 5, 18) });
    h.controller.navigate(1); // ideal Jun 15–21 → latest start = Jun 18 − 6 = Jun 12
    expect(h.navigations).toHaveLength(1);
    const { date, range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-12');
    expect(iso(range.end)).toBe('2026-6-18'); // exactly at maxDate, span still 7
    expect(iso(date)).toBe('2026-6-12');
    expect(h.controller.navDirection).toBe('forward');
  });

  it('clamps a backward shift span-preserving at minDate (partial shift)', () => {
    const h = rangeHarness({ minDate: new Date(2026, 5, 5) });
    h.controller.navigate(-1); // ideal Jun 1–7 → earliest start = Jun 5
    const { range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-5');
    expect(iso(range.end)).toBe('2026-6-11');
    expect(h.controller.navDirection).toBe('backward');
  });

  it('clamps a multi-step delta to the boundary window', () => {
    const h = rangeHarness({ maxDate: new Date(2026, 5, 30) });
    h.controller.navigate(5); // ideal start Jul 13 → latest start = Jun 30 − 6 = Jun 24
    const { range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-24');
    expect(iso(range.end)).toBe('2026-6-30');
  });

  it('emits nothing when the window already sits at the bound (swipe gate)', () => {
    const h = rangeHarness({
      rangeStart: new Date(2026, 5, 12),
      rangeEnd: new Date(2026, 5, 18),
      maxDate: new Date(2026, 5, 18)
    });
    h.controller.navigate(1); // no room forward at all
    expect(h.navigations).toHaveLength(0);
    expect(h.controller.navDirection).toBe(null); // no transition flip either
  });

  it('emits nothing backward when the window starts at minDate', () => {
    const h = rangeHarness({
      rangeStart: new Date(2026, 5, 5),
      rangeEnd: new Date(2026, 5, 11),
      minDate: new Date(2026, 5, 5)
    });
    h.controller.navigate(-1);
    expect(h.navigations).toHaveLength(0);
  });

  it('shifts unclamped when no bounds are set', () => {
    const h = rangeHarness();
    h.controller.navigate(1);
    const { range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-15');
    expect(iso(range.end)).toBe('2026-6-21');
  });

  it('gates canGoBack/canGoForward on the window edges, not the week padding', () => {
    // Window Wed Jun 10 – Tue Jun 16; visible cells pad to Mon Jun 8 – Sun Jun 21.
    // The padding spills past maxDate Jun 17, but the window itself can still
    // shift forward by one day — canGoForward must stay true.
    const h = rangeHarness({
      rangeStart: new Date(2026, 5, 10),
      rangeEnd: new Date(2026, 5, 16),
      minDate: new Date(2026, 5, 10),
      maxDate: new Date(2026, 5, 17)
    });
    expect(h.controller.canGoForward).toBe(true);
    expect(h.controller.canGoBack).toBe(false); // start already at minDate
    h.controller.navigate(1); // ideal Jun 17 → latest start = Jun 17 − 6 = Jun 11
    const { range } = h.navigations[0];
    expect(iso(range.start)).toBe('2026-6-11');
    expect(iso(range.end)).toBe('2026-6-17');
    // Materialise the shifted window (as Planner's handleNavigate does) — the
    // window now touches both bounds, so both gates close.
    h.rangeStart = range.start;
    h.rangeEnd = range.end;
    expect(h.controller.canGoForward).toBe(false);
    expect(h.controller.canGoBack).toBe(true); // Jun 11 > minDate Jun 10
  });

  it('reports both gates open without bounds', () => {
    const h = rangeHarness();
    expect(h.controller.canGoBack).toBe(true);
    expect(h.controller.canGoForward).toBe(true);
  });

  it('pins a window longer than the navigable interval to minDate and warns (DEV)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const h = rangeHarness({
        rangeStart: new Date(2026, 5, 1),
        rangeEnd: new Date(2026, 5, 10), // 10-day span
        minDate: new Date(2026, 5, 10),
        maxDate: new Date(2026, 5, 14) // 5-day interval < span
      });
      h.controller.navigate(1);
      expect(h.navigations).toHaveLength(1);
      const { range } = h.navigations[0];
      expect(iso(range.start)).toBe('2026-6-10'); // pinned to minDate
      expect(iso(range.end)).toBe('2026-6-19'); // span preserved; tail spills past maxDate
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot fit'));
      // Once pinned, further navigation is inert in both directions.
      h.rangeStart = range.start;
      h.rangeEnd = range.end;
      h.controller.navigate(1);
      h.controller.navigate(-1);
      expect(h.navigations).toHaveLength(1);
      expect(h.controller.canGoBack).toBe(false);
      expect(h.controller.canGoForward).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });
});

// The header Today button gates on canGoToToday; the emit paths (goToToday / goTo)
// clamp too, so a programmatic call can never seat the reference on an all-disabled
// month/week/day past the bounds. Bounds are relative to the controller's own `today`.
describe('DateGridController — today / goTo bounds', () => {
  const dayOffset = (base: Date, days: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

  it('canGoToToday is true without bounds', () => {
    expect(new Harness().controller.canGoToToday).toBe(true);
  });

  it('canGoToToday is false when today is before minDate', () => {
    const h = new Harness();
    h.minDate = dayOffset(h.controller.today, 1); // tomorrow
    expect(h.controller.canGoToToday).toBe(false);
  });

  it('canGoToToday is false when today is after maxDate', () => {
    const h = new Harness();
    h.maxDate = dayOffset(h.controller.today, -1); // yesterday
    expect(h.controller.canGoToToday).toBe(false);
  });

  it('canGoToToday is true when today sits within bounds', () => {
    const h = new Harness();
    h.minDate = dayOffset(h.controller.today, -5);
    h.maxDate = dayOffset(h.controller.today, 5);
    expect(h.controller.canGoToToday).toBe(true);
  });

  it('goToToday clamps to maxDate (and focus follows) when today is out of range', () => {
    const h = new Harness({ referenceDate: new Date(2020, 0, 1) });
    const max = dayOffset(h.controller.today, -3); // 3 days ago
    h.maxDate = max;
    h.controller.goToToday();
    expect(iso(h.controller.focusedDate)).toBe(iso(max)); // clamped, not today
    expect(iso(h.navigations[0].date)).toBe(iso(max));
  });

  it('goToToday lands on today (unclamped) when in range', () => {
    const h = new Harness({ referenceDate: new Date(2020, 0, 1) });
    h.minDate = dayOffset(h.controller.today, -10);
    h.maxDate = dayOffset(h.controller.today, 10);
    h.controller.goToToday();
    expect(h.controller.isToday(h.controller.focusedDate)).toBe(true);
  });

  it('goTo clamps the target into [minDate, maxDate]', () => {
    const h = new Harness({
      referenceDate: new Date(2026, 5, 16),
      minDate: new Date(2026, 5, 1),
      maxDate: new Date(2026, 5, 30)
    });
    h.controller.goTo(new Date(2027, 0, 1)); // far past maxDate
    expect(iso(h.navigations[0].date)).toBe('2026-6-30');
  });
});

describe('DateGridController — roving focus', () => {
  it('moves focus within the visible month without navigating', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    h.controller.moveFocus(1);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-17');
    expect(h.navigations).toHaveLength(0); // still in June
  });

  it('navigates when arrow focus leaves the focused month', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 30)); // last day of June
    h.navigations.length = 0;
    h.controller.moveFocus(1); // → July 1, outside June
    expect(iso(h.controller.focusedDate)).toBe('2026-7-1');
    expect(h.navigations).toHaveLength(1);
    expect(h.navigations[0].date.getMonth()).toBe(6); // navigated to July
  });

  it('moveFocus(7) and (-7) step by a week', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    h.controller.moveFocus(7);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-23');
    h.controller.moveFocus(-7);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-16');
  });

  // Arrow/Home/End/Page keys are not gated by canGoBack/canGoForward, so the focus
  // target is clamped to the hard [minDate, maxDate] edges — otherwise the focus (and
  // the view it drags along) could cross onto an all-disabled window.
  it('clamps setFocusedDate forward to maxDate', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16), maxDate: new Date(2026, 5, 20) });
    h.controller.setFocusedDate(new Date(2026, 5, 25)); // past maxDate
    expect(iso(h.controller.focusedDate)).toBe('2026-6-20');
  });

  it('clamps setFocusedDate backward to minDate', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16), minDate: new Date(2026, 5, 10) });
    h.controller.setFocusedDate(new Date(2026, 5, 5)); // before minDate
    expect(iso(h.controller.focusedDate)).toBe('2026-6-10');
  });

  it('an arrow past maxDate holds focus on the bound without an escape navigation', () => {
    const h = new Harness({
      view: 'day',
      referenceDate: new Date(2026, 5, 18), // Jun 18 = maxDate
      maxDate: new Date(2026, 5, 18)
    });
    h.controller.setFocusedDate(new Date(2026, 5, 18));
    h.navigations.length = 0;
    h.controller.moveFocus(1); // ArrowRight wants Jun 19 (> maxDate, all-disabled)
    expect(iso(h.controller.focusedDate)).toBe('2026-6-18'); // stays on the bound
    expect(h.navigations).toHaveLength(0); // no navigation onto the disabled day
  });

  it('leaves in-range focus movement unclamped', () => {
    const h = new Harness({
      referenceDate: new Date(2026, 5, 16),
      minDate: new Date(2026, 0, 1),
      maxDate: new Date(2026, 11, 31)
    });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    h.controller.moveFocus(1);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-17');
  });
});

describe('DateGridController — selection', () => {
  it('single mode selects the clicked date', () => {
    const h = new Harness({ selectionMode: 'single' });
    h.controller.selectDate(new Date(2026, 5, 16));
    expect(h.selections).toHaveLength(1);
    expect(iso(h.selections[0] as Date)).toBe('2026-6-16');
    expect(h.controller.isSelected(new Date(2026, 5, 16))).toBe(true);
  });

  it('multiple mode toggles dates in and out', () => {
    const h = new Harness({ selectionMode: 'multiple', selection: [] });
    h.controller.selectDate(new Date(2026, 5, 16));
    expect(h.selections.at(-1)).toHaveLength(1);
    h.controller.selectDate(new Date(2026, 5, 17));
    expect(h.selections.at(-1)).toHaveLength(2);
    h.controller.selectDate(new Date(2026, 5, 16)); // toggle off
    expect(h.selections.at(-1)).toHaveLength(1);
    expect((h.selections.at(-1) as Date[])[0].getDate()).toBe(17);
  });

  it('range mode sets start then completes, ordering reversed picks', () => {
    const h = new Harness({ selectionMode: 'range' });
    h.controller.selectDate(new Date(2026, 5, 20)); // start
    expect(h.selections.at(-1)).toEqual({
      start: new Date(2026, 5, 20),
      end: new Date(2026, 5, 20)
    });
    h.controller.selectDate(new Date(2026, 5, 15)); // earlier → becomes start
    const range = h.selections.at(-1) as DateGridRange;
    expect(range.start.getDate()).toBe(15);
    expect(range.end.getDate()).toBe(20);
  });

  it('exposes range-edge and in-range queries', () => {
    const h = new Harness({
      selectionMode: 'range',
      selection: { start: new Date(2026, 5, 15), end: new Date(2026, 5, 20) }
    });
    expect(h.controller.isRangeStart(new Date(2026, 5, 15))).toBe(true);
    expect(h.controller.isRangeEnd(new Date(2026, 5, 20))).toBe(true);
    expect(h.controller.isInSelectedRange(new Date(2026, 5, 17))).toBe(true);
    expect(h.controller.isInSelectedRange(new Date(2026, 5, 15))).toBe(false); // edge, not interior
  });

  it('does not select a disabled date', () => {
    const h = new Harness({
      selectionMode: 'single',
      isDateDisabled: (d) => d.getDate() === 16
    });
    h.controller.selectDate(new Date(2026, 5, 16));
    expect(h.selections).toHaveLength(0);
  });
});

describe('DateGridController — day queries', () => {
  it('isWeekend matches Saturday and Sunday only', () => {
    const { controller } = new Harness();
    expect(controller.isWeekend(new Date(2026, 5, 20))).toBe(true); // Sat
    expect(controller.isWeekend(new Date(2026, 5, 21))).toBe(true); // Sun
    expect(controller.isWeekend(new Date(2026, 5, 16))).toBe(false); // Tue
  });

  it('isDisabled honours min/max bounds and the predicate', () => {
    const { controller } = new Harness({
      minDate: new Date(2026, 5, 10),
      maxDate: new Date(2026, 5, 20),
      isDateDisabled: (d) => d.getDate() === 15
    });
    expect(controller.isDisabled(new Date(2026, 5, 9))).toBe(true); // < min
    expect(controller.isDisabled(new Date(2026, 5, 21))).toBe(true); // > max
    expect(controller.isDisabled(new Date(2026, 5, 15))).toBe(true); // predicate
    expect(controller.isDisabled(new Date(2026, 5, 16))).toBe(false);
  });

  it('dayCellInfo assembles the shared per-day context', () => {
    const { controller } = new Harness({ referenceDate: new Date(2026, 5, 16) });
    const info = controller.dayCellInfo(new Date(2026, 6, 5)); // July spill
    expect(info.isoDate).toBe('2026-07-05');
    expect(info.isOutside).toBe(true);
    expect(info.isWeekend).toBe(true); // Jul 5 2026 is a Sunday
    expect(info.weekNumber).toBe(27);
  });

  it('disabled controller blocks selection entirely', () => {
    const h = new Harness({ disabled: true });
    h.controller.selectDate(new Date(2026, 5, 16));
    expect(h.selections).toHaveLength(0);
  });
});

describe('handleDateGridKeydown', () => {
  it('arrow keys move focus by day and week', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    expect(handleDateGridKeydown(keyEvent('ArrowRight'), h.controller)).toBe(true);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-17');
    handleDateGridKeydown(keyEvent('ArrowDown'), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-24');
    handleDateGridKeydown(keyEvent('ArrowLeft'), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-23');
  });

  it('Home and End jump to the week edges', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 17)); // Wed
    handleDateGridKeydown(keyEvent('Home'), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-15'); // Mon
    handleDateGridKeydown(keyEvent('End'), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2026-6-21'); // Sun
  });

  it('PageUp/PageDown step a month, Shift steps a year', () => {
    const h = new Harness({ referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    handleDateGridKeydown(keyEvent('PageDown'), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2026-7-16');
    handleDateGridKeydown(keyEvent('PageUp', true), h.controller);
    expect(iso(h.controller.focusedDate)).toBe('2025-7-16');
  });

  it('clamps the day when stepping into a shorter month', () => {
    const h = new Harness({ referenceDate: new Date(2026, 0, 31) }); // Jan 31
    h.controller.setFocusedDate(new Date(2026, 0, 31));
    handleDateGridKeydown(keyEvent('PageDown'), h.controller); // → Feb (28 days)
    expect(iso(h.controller.focusedDate)).toBe('2026-2-28');
  });

  it('Enter and Space select the focused date', () => {
    const h = new Harness({ selectionMode: 'single', referenceDate: new Date(2026, 5, 16) });
    h.controller.setFocusedDate(new Date(2026, 5, 16));
    handleDateGridKeydown(keyEvent('Enter'), h.controller);
    expect(iso(h.selections.at(-1) as Date)).toBe('2026-6-16');
  });

  it('returns false and preventDefault is not called for unhandled keys', () => {
    const h = new Harness();
    const event = keyEvent('Tab');
    expect(handleDateGridKeydown(event, h.controller)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores keys when the grid is disabled', () => {
    const h = new Harness({ disabled: true });
    expect(handleDateGridKeydown(keyEvent('ArrowRight'), h.controller)).toBe(false);
  });
});
