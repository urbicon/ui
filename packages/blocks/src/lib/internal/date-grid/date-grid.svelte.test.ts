import { describe, expect, it } from 'vitest';
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
    expect(h.navigations[0].date.getDate()).toBe(1); // first of month
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

  it('reports day-granular bounds for week view', () => {
    const h = new Harness({
      view: 'week',
      referenceDate: new Date(2026, 5, 16),
      maxDate: new Date(2026, 5, 18)
    });
    // visible week ends Jun 21 > maxDate Jun 18 → cannot go forward
    expect(h.controller.canGoForward).toBe(false);
  });

  it('goToToday navigates to and focuses today', () => {
    const h = new Harness({ referenceDate: new Date(2020, 0, 1) });
    h.controller.goToToday();
    expect(h.navigations).toHaveLength(1);
    expect(h.controller.isToday(h.controller.focusedDate)).toBe(true);
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
