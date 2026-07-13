// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar.svelte';

// Regression net for the mini-calendar → week/day drill-down desync: clicking a
// day in the mini month used to call selectDate + navigateDay(0) — a same-value
// referenceDate assignment that never moved the main grid, so `value` showed the
// clicked day while the day view kept rendering the old one. handleDayClick now
// jumps via the goToDate context primitive (controller.goTo, clamped to
// min/maxDate). Same stack as the DatePicker tests: svelte's own mount/unmount,
// @testing-library/dom, native matchers. Mini day cells are reached through the
// deterministic `data-mini-date` attribute, the day view through its labelled
// region (aria-label = formatDateFull(displayedDate)).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCalendar(props: ComponentProps<typeof Calendar>) {
  const instance = mount(Calendar, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

// The day view's region label is formatDateFull(displayedDate, 'de-DE') — built
// here with the identical Intl options so the expectation cannot drift.
function fullLabel(date: Date) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

const dayView = (date: Date) =>
  document.querySelector(`[role="region"][aria-label="${fullLabel(date)}"]`);
const miniDay = (iso: string) => document.querySelector<HTMLElement>(`[data-mini-date="${iso}"]`);

describe('CalendarMiniMonth → day view navigation', () => {
  it('clicking another day in the same month moves the day view to it', () => {
    const onDayChange = vi.fn();
    renderCalendar({
      view: 'day',
      showMiniCalendar: true,
      animated: false,
      defaultDate: new Date(2026, 5, 5), // Fri 5 Jun 2026
      onDayChange
    });

    expect(dayView(new Date(2026, 5, 5))).not.toBeNull();

    fireEvent.click(miniDay('2026-06-10')!);
    flushSync();

    // The main grid must follow the click — this was the desync: the selection
    // moved to the 10th while the day view kept rendering the 5th.
    expect(dayView(new Date(2026, 5, 10))).not.toBeNull();
    expect(dayView(new Date(2026, 5, 5))).toBeNull();
    expect(onDayChange).toHaveBeenCalledTimes(1);
    expect((onDayChange.mock.calls[0][0] as Date).getDate()).toBe(10);
  });

  it('clicking a spill day from the adjacent month jumps to that exact day', () => {
    renderCalendar({
      view: 'day',
      showMiniCalendar: true,
      animated: false,
      defaultDate: new Date(2026, 5, 5)
    });

    // June 2026 (weekStartsOn=1) ends mid-week, so the grid carries July spill
    // days. goToDate must land on the exact day, not a month anchor.
    fireEvent.click(miniDay('2026-07-01')!);
    flushSync();

    expect(dayView(new Date(2026, 6, 1))).not.toBeNull();
    expect(dayView(new Date(2026, 5, 5))).toBeNull();
  });
});
