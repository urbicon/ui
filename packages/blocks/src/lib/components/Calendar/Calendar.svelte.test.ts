// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarBindHarness from './__fixtures__/CalendarBindHarness.svelte';
import Calendar from './Calendar.svelte';

// Interaction tests over the two Calendar debt fixes (2026-07-22):
//
// 1. `bind:value` write-back — handleSelect used to gate the write on
//    `value !== undefined`, so a binding that starts from the only
//    type-correct empty selection (undefined) never received a pick; every
//    selection drained into a private internalValue. The fix always assigns
//    the $bindable (Svelte 5 keeps writes to an unbound bindable local), so
//    all three arms must behave: bound-empty, bound-preset, unbound.
//    Binding needs a real owner $state → CalendarBindHarness (__fixtures__).
//
// 2. View swipes are direction-gated (the DateGridScaffold pattern): a swipe
//    at a [minDate, maxDate] bound is inert — the engine used to clamp but
//    still emit a no-op onMonthChange/onWeekChange/onDayChange with an
//    unchanged value. In-bounds swipes keep reporting exactly as before.
//
// 3. ArrowLeft/ArrowRight in the day and agenda views (the two views whose
//    keydown calls ctx.navigate) share the same direction gate — an arrow key
//    at the bound emits nothing, and a disabled calendar ignores keys. The
//    other views' keydown only moves DOM focus (already clamped), never
//    ctx.navigate.
//
// Same stack as the other Calendar DOM tests: svelte's own mount/unmount,
// @testing-library/dom, native matchers. Swipes are raw PointerEvents on the
// view root (jsdom implements PointerEvent; `isPrimary` is required by the
// swipeable util). All dates are fixed to June 2026 — never the wall clock.

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

function renderHarness(props: ComponentProps<typeof CalendarBindHarness>) {
  const instance = mount(CalendarBindHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return instance;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayCell = (isoDate: string) =>
  document.querySelector<HTMLElement>(`[data-date="${isoDate}"]`);

function clickDay(isoDate: string) {
  const cell = dayCell(isoDate);
  expect(cell).not.toBeNull();
  fireEvent.click(cell!);
  flushSync();
}

/** Horizontal swipe on a view root: pointerdown + pointerup past the 50px
 * threshold. `left` = next period, `right` = previous (matching swipeable). */
function swipe(el: Element | null, direction: 'left' | 'right') {
  expect(el).not.toBeNull();
  const from = 200;
  const to = direction === 'left' ? 40 : 360;
  el!.dispatchEvent(
    new PointerEvent('pointerdown', { isPrimary: true, clientX: from, clientY: 10 })
  );
  el!.dispatchEvent(new PointerEvent('pointerup', { isPrimary: true, clientX: to, clientY: 10 }));
  flushSync();
}

const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026

describe('Calendar bind:value write-back', () => {
  it('bound from the empty (undefined) initial: a pick reaches the consumer', () => {
    const onValueChange = vi.fn();
    const harness = renderHarness({ defaultDate: anchor, animated: false, onValueChange });

    expect(harness.getSelection()).toBeUndefined();
    clickDay('2026-06-18');

    // The regression: this used to stay undefined (write-back drained into a
    // private internalValue) while only the callback reported the pick.
    const selection = harness.getSelection();
    expect(selection).toBeInstanceOf(Date);
    expect(iso(selection as Date)).toBe('2026-06-18');
    expect(dayCell('2026-06-18')?.getAttribute('aria-selected')).toBe('true');
    // onValueChange still fires exactly once per pick alongside the binding.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(iso(onValueChange.mock.calls[0][0] as Date)).toBe('2026-06-18');
  });

  it('bound with a preset value: a pick replaces it through the binding', () => {
    const onValueChange = vi.fn();
    const harness = renderHarness({
      initial: anchor,
      defaultDate: anchor,
      animated: false,
      onValueChange
    });

    expect(dayCell('2026-06-15')?.getAttribute('aria-selected')).toBe('true');
    clickDay('2026-06-18');

    expect(iso(harness.getSelection() as Date)).toBe('2026-06-18');
    expect(dayCell('2026-06-18')?.getAttribute('aria-selected')).toBe('true');
    // CalendarDay stamps aria-selected only when selected (absent otherwise).
    expect(dayCell('2026-06-15')?.getAttribute('aria-selected')).toBeNull();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('unbound (uncontrolled): internal selection works and onValueChange reports each pick', () => {
    const onValueChange = vi.fn();
    renderCalendar({ defaultDate: anchor, animated: false, onValueChange });

    clickDay('2026-06-18');
    expect(dayCell('2026-06-18')?.getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(iso(onValueChange.mock.calls[0][0] as Date)).toBe('2026-06-18');

    // A second pick moves the (locally kept) selection — Svelte holds writes
    // to the unbound $bindable until a parent would pass a new prop value.
    clickDay('2026-06-20');
    expect(dayCell('2026-06-20')?.getAttribute('aria-selected')).toBe('true');
    expect(dayCell('2026-06-18')?.getAttribute('aria-selected')).toBeNull();
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });
});

describe('Calendar view swipes are direction-gated at the bounds', () => {
  const monthBounds = { minDate: new Date(2026, 5, 1), maxDate: new Date(2026, 5, 30) };

  it('month view: swiping at a one-month window fires no onMonthChange', () => {
    const onMonthChange = vi.fn();
    renderCalendar({
      view: 'month',
      defaultDate: anchor,
      animated: false,
      ...monthBounds,
      onMonthChange
    });

    const grid = document.querySelector('[role="grid"]');
    swipe(grid, 'left');
    swipe(grid, 'right');

    expect(onMonthChange).not.toHaveBeenCalled();
    expect(dayCell('2026-06-15')).not.toBeNull(); // still June
  });

  it('month view: in-bounds swipes still navigate and report as before', () => {
    const onMonthChange = vi.fn();
    renderCalendar({ view: 'month', defaultDate: anchor, animated: false, onMonthChange });

    swipe(document.querySelector('[role="grid"]'), 'left');
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenLastCalledWith(6, 2026); // July
    expect(dayCell('2026-07-15')).not.toBeNull();

    swipe(document.querySelector('[role="grid"]'), 'right');
    expect(onMonthChange).toHaveBeenCalledTimes(2);
    expect(onMonthChange).toHaveBeenLastCalledWith(5, 2026); // back to June
  });

  it('week view: swiping at a one-week window fires no onWeekChange', () => {
    const onWeekChange = vi.fn();
    renderCalendar({
      view: 'week',
      defaultDate: anchor, // week Mon 15 – Sun 21 Jun (weekStartsOn: 1)
      minDate: new Date(2026, 5, 15),
      maxDate: new Date(2026, 5, 21),
      animated: false,
      onWeekChange
    });

    const grid = document.querySelector('[role="grid"]');
    swipe(grid, 'left');
    swipe(grid, 'right');

    expect(onWeekChange).not.toHaveBeenCalled();
  });

  it('week view: an in-bounds swipe reports the next week', () => {
    const onWeekChange = vi.fn();
    renderCalendar({ view: 'week', defaultDate: anchor, animated: false, onWeekChange });

    swipe(document.querySelector('[role="grid"]'), 'left');

    expect(onWeekChange).toHaveBeenCalledTimes(1);
    expect(iso(onWeekChange.mock.calls[0][0] as Date)).toBe('2026-06-22');
  });

  it('day view: swiping at a one-day window fires no onDayChange', () => {
    const onDayChange = vi.fn();
    renderCalendar({
      view: 'day',
      defaultDate: anchor,
      minDate: anchor,
      maxDate: anchor,
      animated: false,
      onDayChange
    });

    const region = document.querySelector('[role="region"]');
    swipe(region, 'left');
    swipe(region, 'right');

    expect(onDayChange).not.toHaveBeenCalled();
  });

  it('day view: an in-bounds swipe reports the next day', () => {
    const onDayChange = vi.fn();
    renderCalendar({ view: 'day', defaultDate: anchor, animated: false, onDayChange });

    swipe(document.querySelector('[role="region"]'), 'left');

    expect(onDayChange).toHaveBeenCalledTimes(1);
    expect(iso(onDayChange.mock.calls[0][0] as Date)).toBe('2026-06-16');
  });

  it('agenda view: swiping at a one-month window fires no onMonthChange', () => {
    const onMonthChange = vi.fn();
    renderCalendar({
      view: 'agenda',
      defaultDate: anchor,
      animated: false,
      ...monthBounds,
      onMonthChange
    });

    const region = document.querySelector('[role="region"]');
    swipe(region, 'left');
    swipe(region, 'right');

    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('year view: swiping at a one-month window fires no onMonthChange', () => {
    const onMonthChange = vi.fn();
    renderCalendar({
      view: 'year',
      defaultDate: anchor,
      animated: false,
      ...monthBounds,
      onMonthChange
    });

    const grid = document.querySelector('[role="grid"]');
    swipe(grid, 'left');
    swipe(grid, 'right');

    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('year view: an in-bounds swipe reports the same month next year', () => {
    const onMonthChange = vi.fn();
    renderCalendar({ view: 'year', defaultDate: anchor, animated: false, onMonthChange });

    swipe(document.querySelector('[role="grid"]'), 'left');

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenLastCalledWith(5, 2027);
  });

  it('disabled calendar: swipes are inert entirely', () => {
    const onMonthChange = vi.fn();
    renderCalendar({
      view: 'month',
      defaultDate: anchor,
      animated: false,
      disabled: true,
      onMonthChange
    });

    swipe(document.querySelector('[role="grid"]'), 'left');

    expect(onMonthChange).not.toHaveBeenCalled();
    expect(dayCell('2026-06-15')).not.toBeNull();
  });
});

describe('Calendar day/agenda keyboard navigation is direction-gated at the bounds', () => {
  const monthBounds = { minDate: new Date(2026, 5, 1), maxDate: new Date(2026, 5, 30) };

  /** ArrowLeft/ArrowRight on a view root — the keyboard twin of `swipe`. */
  function press(el: Element | null, key: 'ArrowLeft' | 'ArrowRight') {
    expect(el).not.toBeNull();
    fireEvent.keyDown(el!, { key });
    flushSync();
  }

  it('day view: arrow keys at a one-day window fire no onDayChange', () => {
    const onDayChange = vi.fn();
    renderCalendar({
      view: 'day',
      defaultDate: anchor,
      minDate: anchor,
      maxDate: anchor,
      animated: false,
      onDayChange
    });

    const region = document.querySelector('[role="region"]');
    press(region, 'ArrowRight');
    press(region, 'ArrowLeft');

    expect(onDayChange).not.toHaveBeenCalled();
  });

  it('day view: in-bounds arrow keys still navigate and report as before', () => {
    const onDayChange = vi.fn();
    renderCalendar({ view: 'day', defaultDate: anchor, animated: false, onDayChange });

    press(document.querySelector('[role="region"]'), 'ArrowRight');
    expect(onDayChange).toHaveBeenCalledTimes(1);
    expect(iso(onDayChange.mock.calls[0][0] as Date)).toBe('2026-06-16');

    press(document.querySelector('[role="region"]'), 'ArrowLeft');
    expect(onDayChange).toHaveBeenCalledTimes(2);
    expect(iso(onDayChange.mock.calls[1][0] as Date)).toBe('2026-06-15');
  });

  it('day view: at maxDate only the blocked direction is inert', () => {
    const onDayChange = vi.fn();
    renderCalendar({
      view: 'day',
      defaultDate: anchor,
      maxDate: anchor,
      animated: false,
      onDayChange
    });

    const region = document.querySelector('[role="region"]');
    press(region, 'ArrowRight'); // at maxDate — inert
    expect(onDayChange).not.toHaveBeenCalled();

    press(region, 'ArrowLeft'); // back is open
    expect(onDayChange).toHaveBeenCalledTimes(1);
    expect(iso(onDayChange.mock.calls[0][0] as Date)).toBe('2026-06-14');
  });

  it('agenda view: arrow keys at a one-month window fire no onMonthChange', () => {
    const onMonthChange = vi.fn();
    renderCalendar({
      view: 'agenda',
      defaultDate: anchor,
      animated: false,
      ...monthBounds,
      onMonthChange
    });

    const region = document.querySelector('[role="region"]');
    press(region, 'ArrowRight');
    press(region, 'ArrowLeft');

    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('agenda view: an in-bounds ArrowRight reports the next month', () => {
    const onMonthChange = vi.fn();
    renderCalendar({ view: 'agenda', defaultDate: anchor, animated: false, onMonthChange });

    press(document.querySelector('[role="region"]'), 'ArrowRight');

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenLastCalledWith(6, 2026); // July
  });

  it('disabled calendar: arrow keys are inert entirely', () => {
    const onDayChange = vi.fn();
    renderCalendar({
      view: 'day',
      defaultDate: anchor,
      animated: false,
      disabled: true,
      onDayChange
    });

    press(document.querySelector('[role="region"]'), 'ArrowRight');

    expect(onDayChange).not.toHaveBeenCalled();
  });
});

// `fixedWeeks` was declared as a prop, destructured, and published on the
// context — and read by nobody. `getMonthGrid` never learned about it, so the
// month view kept sizing to its content and the DatePicker overlay jumped
// between 4, 5 and 6 rows while paging. A variants/geometry test cannot catch
// that shape of bug: the gap sat between configuration and wiring, so this
// asserts against the rendered DOM.
describe('fixedWeeks wiring', () => {
  const weekRows = () =>
    document.querySelectorAll('[role="grid"] [role="row"]').length -
    // the weekday header row
    1;

  it('renders 6 week rows for a short month when set', () => {
    // February 2026 starts on a Sunday and needs only 5 rows unpadded.
    renderCalendar({
      view: 'month',
      defaultDate: new Date(2026, 1, 15),
      animated: false,
      fixedWeeks: true
    });
    expect(weekRows()).toBe(6);
  });

  it('sizes to content when unset', () => {
    renderCalendar({ view: 'month', defaultDate: new Date(2026, 1, 15), animated: false });
    expect(weekRows()).toBeLessThan(6);
  });
});
