// @vitest-environment jsdom
/**
 * Roving focus and the lane-aware keyboard model.
 *
 * The anti-regression this file exists for: **ArrowDown moves one LANE, not one
 * week.** `handleDateGridKeydown` — the handler Calendar and Planner share —
 * maps Up/Down to ∓7 days because its vertical axis *is* the week. Reusing it
 * here would look right in a screenshot and jump a week sideways on every
 * press, so the vertical axis is asserted against the *date*, not just the row
 * index.
 *
 * Every key is dispatched on the cell that currently carries `tabindex="0"` —
 * the only tab stop the grid exposes, and therefore the only cell a keyboard
 * user can be on. The cursor is moved with keys rather than with `.focus()`,
 * because the component (like `DateGridScaffold`) drives navigation from its
 * own roving state, not from whichever element happened to receive the event.
 *
 * Mounted with Svelte's own `mount`/`unmount` (never `@testing-library/svelte`)
 * and asserted with vitest's native matchers — the `blocks-testing` conventions.
 */

import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResourceTimelineProps } from './index';
import ResourceTimeline from './ResourceTimeline.svelte';
import type { TimelineResource } from './resource-timeline.types';

interface Booking {
  id: string;
  room: string;
  from: string;
  to: string;
}

const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026

const rooms: TimelineResource[] = [
  { id: 'r1', label: 'Sea view' },
  { id: 'r2', label: 'Garden' },
  { id: 'r3', label: 'Attic' }
];

const bookings: Booking[] = [{ id: 'b1', room: 'r1', from: '2026-06-16', to: '2026-06-18' }];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTimeline(props: Partial<ResourceTimelineProps<Booking>> = {}) {
  const instance = mount(ResourceTimeline, {
    target: document.body,
    props: {
      resources: rooms,
      items: bookings,
      getResourceId: (b: Booking) => b.room,
      getRange: (b: Booking) => ({ start: b.from, end: b.to }),
      getId: (b: Booking) => b.id,
      value: anchor,
      view: 'week',
      ...props
    } as unknown as ComponentProps<typeof ResourceTimeline>
  });
  dispose = () => unmount(instance);
  flushSync();
}

/** The single cell carrying the roving `tabindex="0"`. */
function rovingCell(): HTMLElement {
  const stops = document.querySelectorAll<HTMLElement>('[role="gridcell"][tabindex="0"]');
  expect(stops.length, 'exactly one gridcell must be tabbable').toBe(1);
  return stops[0];
}

const position = (el: HTMLElement) => ({
  lane: Number(el.dataset.lane),
  day: Number(el.dataset.day),
  date: el.dataset.date
});

const at = () => position(rovingCell());

/** Press a key on the current tab stop. */
function press(key: string, init: KeyboardEventInit = {}) {
  const cell = rovingCell();
  cell.focus();
  cell.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  );
  flushSync();
}

const pressTimes = (key: string, times: number) => {
  for (let i = 0; i < times; i++) press(key);
};

describe('ResourceTimeline keyboard', () => {
  it('starts with exactly one tabbable cell, at the top left', () => {
    renderTimeline();
    expect(at()).toEqual({ lane: 0, day: 0, date: '2026-06-15' });
  });

  it('moves one day per ArrowRight / ArrowLeft, staying in the lane', () => {
    renderTimeline();
    press('ArrowRight');
    expect(at()).toEqual({ lane: 0, day: 1, date: '2026-06-16' });
    press('ArrowRight');
    expect(at()).toEqual({ lane: 0, day: 2, date: '2026-06-17' });
    press('ArrowLeft');
    expect(at()).toEqual({ lane: 0, day: 1, date: '2026-06-16' });
  });

  it('moves ONE LANE on ArrowDown — not one week', () => {
    // The whole reason this component does not reuse `handleDateGridKeydown`:
    // there, ArrowDown is +7 days. Here the date must not move at all.
    renderTimeline();
    pressTimes('ArrowRight', 3);
    expect(at().date).toBe('2026-06-18');

    press('ArrowDown');
    expect(at()).toEqual({ lane: 1, day: 3, date: '2026-06-18' });

    press('ArrowUp');
    expect(at()).toEqual({ lane: 0, day: 3, date: '2026-06-18' });
  });

  it('clamps at the last lane instead of wrapping or navigating', () => {
    const onNavigate = vi.fn();
    renderTimeline({ onNavigate });
    pressTimes('ArrowDown', 5); // only 3 lanes exist
    expect(at()).toEqual({ lane: 2, day: 0, date: '2026-06-15' });
    press('ArrowUp');
    expect(at().lane).toBe(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('clamps at the window edges on ArrowLeft / ArrowRight', () => {
    const onNavigate = vi.fn();
    renderTimeline({ onNavigate });

    press('ArrowLeft');
    expect(at()).toEqual({ lane: 0, day: 0, date: '2026-06-15' });

    pressTimes('ArrowRight', 9); // only 7 columns exist
    expect(at()).toEqual({ lane: 0, day: 6, date: '2026-06-21' });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('jumps to the window edges on Home / End', () => {
    renderTimeline();
    press('ArrowDown');
    press('End');
    expect(at()).toEqual({ lane: 1, day: 6, date: '2026-06-21' });
    press('Home');
    expect(at()).toEqual({ lane: 1, day: 0, date: '2026-06-15' });
  });

  it('reaches the grid corners with Ctrl+Home / Ctrl+End', () => {
    renderTimeline();
    press('End', { ctrlKey: true });
    expect(at()).toEqual({ lane: 2, day: 6, date: '2026-06-21' });
    press('Home', { ctrlKey: true });
    expect(at()).toEqual({ lane: 0, day: 0, date: '2026-06-15' });
  });

  it('steps a whole window on PageDown and reports it once', () => {
    const onNavigate = vi.fn();
    renderTimeline({ onNavigate });
    press('ArrowDown');
    pressTimes('ArrowRight', 2); // cursor at (1, 2)

    press('PageDown');

    expect(onNavigate).toHaveBeenCalledTimes(1);
    const [date, range] = onNavigate.mock.calls[0] as [Date, { start: Date; end: Date }];
    expect(date.getDate()).toBe(22); // Mon 22 Jun 2026
    expect(range.start.getDate()).toBe(22);
    expect(range.end.getDate()).toBe(28);
    // The cursor holds its (lane, column) across the step.
    expect(at()).toEqual({ lane: 1, day: 2, date: '2026-06-24' });
  });

  it('steps back on PageUp', () => {
    const onNavigate = vi.fn();
    renderTimeline({ onNavigate });
    press('PageUp');
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(at().date).toBe('2026-06-08');
  });

  it('activates the span that starts under the cursor', () => {
    const onItemClick = vi.fn();
    const onCellClick = vi.fn();
    renderTimeline({ onItemClick, onCellClick });

    // b1 covers 16–18 Jun on lane 0 → its first visible day is column 1.
    press('ArrowRight');
    press('Enter');

    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][0]).toEqual(bookings[0]);
    expect(onItemClick.mock.calls[0][1]).toEqual(rooms[0]);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('activates the span on a day it COVERS, not just the one it starts on', () => {
    // The defect this exists for: the bar is one absolutely positioned element
    // hanging over 17 and 18 Jun, so a mouse on those days hits it — while the
    // keyboard used to resolve by start column and fall through to the
    // "add booking" hook. Pointer and keyboard have to name the same day
    // occupied.
    const onItemClick = vi.fn();
    const onCellClick = vi.fn();
    renderTimeline({ onItemClick, onCellClick });

    pressTimes('ArrowRight', 3); // (0, 3) → Thu 18 Jun, the LAST day of b1
    expect(at().date).toBe('2026-06-18');
    press('Enter');

    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][0]).toEqual(bookings[0]);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('walks the stacked bars of one cell on repeated activation', () => {
    // Two stays starting the same day on one lane: without cycling, rows 1..n
    // are unreachable by any input — the bars are `tabindex={-1}` and Enter
    // would report row 0 forever.
    const onItemClick = vi.fn();
    const stacked: Booking[] = [
      { id: 'a', room: 'r1', from: '2026-06-16', to: '2026-06-18' },
      { id: 'b', room: 'r1', from: '2026-06-16', to: '2026-06-17' }
    ];
    renderTimeline({ items: stacked, onItemClick });

    press('ArrowRight');
    press('Enter');
    press('Enter');
    press('Enter'); // wraps

    expect(onItemClick.mock.calls.map((call) => (call[0] as Booking).id)).toEqual(['a', 'b', 'a']);
  });

  it('leaves a bar on a blocked day as inert as its cell', () => {
    // `activate` refuses a disabled cell; the bar sitting in it must refuse the
    // pointer too, or the same day answers a click and ignores Enter.
    const onItemClick = vi.fn();
    renderTimeline({ onItemClick, getLabel: (b) => b.id, minDate: new Date(2026, 5, 17) });

    press('ArrowRight'); // (0, 1) → Tue 16 Jun, before minDate, covered by b1
    press('Enter');
    expect(onItemClick).not.toHaveBeenCalled();

    const bar = document.querySelector<HTMLElement>('[aria-label="b1"]') as HTMLElement;
    bar.click();
    flushSync();
    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('keeps answering arrow keys after a click left the focus on a bar', () => {
    // A bar is a <button>, so a click leaves DOM focus on it and every key then
    // arrives with `target !== currentTarget` — the grid used to go
    // keyboard-dead until the user shift-Tabbed back out.
    renderTimeline({ getLabel: (b) => b.id });

    const bar = document.querySelector<HTMLElement>('[aria-label="b1"]') as HTMLElement;
    bar.click(); // moves the cursor to the bar's anchor cell (0, 1)
    bar.focus(); // …and, in a browser, the focus with it
    flushSync();
    expect(at()).toEqual({ lane: 0, day: 1, date: '2026-06-16' });

    bar.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    flushSync();

    expect(at()).toEqual({ lane: 1, day: 1, date: '2026-06-16' });
  });

  it('activates the empty cell everywhere else', () => {
    const onItemClick = vi.fn();
    const onCellClick = vi.fn();
    renderTimeline({ onItemClick, onCellClick });

    pressTimes('ArrowDown', 2);
    pressTimes('ArrowRight', 4); // (2, 4) → Fri 19 Jun, no bookings
    press(' ');

    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0][0]).toEqual(rooms[2]);
    expect((onCellClick.mock.calls[0][1] as Date).getDate()).toBe(19);
    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('activates nothing on a disabled day', () => {
    const onCellClick = vi.fn();
    renderTimeline({ onCellClick, minDate: new Date(2026, 5, 17) });
    press('Enter'); // cursor is on Mon 15 Jun, before minDate
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('answers no key while disabled', () => {
    const onNavigate = vi.fn();
    const onCellClick = vi.fn();
    renderTimeline({ disabled: true, onNavigate, onCellClick });

    for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter']) press(key);

    expect(at()).toEqual({ lane: 0, day: 0, date: '2026-06-15' });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('moves the DOM focus with the roving cursor', async () => {
    renderTimeline();
    press('ArrowDown');
    await vi.waitFor(() => {
      expect(position(document.activeElement as HTMLElement)).toEqual({
        lane: 1,
        day: 0,
        date: '2026-06-15'
      });
    });
  });

  it('reports a bar click with its item and resource', async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    const onCellClick = vi.fn();
    renderTimeline({ onItemClick, onCellClick, getLabel: (b) => b.id });

    const bar = document.querySelector<HTMLElement>('[aria-label="b1"]') as HTMLElement;
    await user.click(bar);
    flushSync();

    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][1]).toEqual(rooms[0]);
    // The bar stops the click, so the cell underneath must not also fire.
    expect(onCellClick).not.toHaveBeenCalled();
  });
});
