// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom';
import { type ComponentProps, createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Calendar from './Calendar.svelte';
import type { CalendarEvent, DayCellContext } from './calendar.types';

// The grid ownership contract (#208): an element with `role="grid"` may own only
// rows, a row only cells. axe reports a break as `aria-required-children`, but
// only in a browser and only on a page that renders the view — so the structure
// is asserted here, per view, and the keyboard model each view already had is
// pinned next to it. A view that is not a grid (the week) must not claim to be
// one.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCalendar(props: Partial<ComponentProps<typeof Calendar>>) {
  const instance = mount(Calendar, {
    target: document.body,
    props: { defaultDate: new Date(2026, 5, 15), locale: 'en-US', animated: false, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

/**
 * The roles an element owns: its descendants down to the first element that
 * carries a role of its own, or is a native button (implicit role). Generic
 * wrappers are transparent, exactly as in the accessibility tree.
 */
function ownedRoles(el: Element): string[] {
  const roles: string[] = [];
  for (const child of Array.from(el.children)) {
    const role = child.getAttribute('role') ?? (child.tagName === 'BUTTON' ? 'button' : null);
    if (role) roles.push(role);
    else roles.push(...ownedRoles(child));
  }
  return roles;
}

function expectWellFormedGrid(grid: Element) {
  expect(new Set(ownedRoles(grid))).toEqual(new Set(['row']));
  for (const row of Array.from(grid.querySelectorAll('[role="row"]'))) {
    const owned = ownedRoles(row);
    expect(owned.length).toBeGreaterThan(0);
    for (const role of owned) expect(['gridcell', 'rowheader', 'columnheader']).toContain(role);
  }
}

const grids = () => Array.from(document.querySelectorAll('[role="grid"]'));

// A three-day event (Jun 9–11) and a week-spanning one (Jun 13–16), so the
// month grid carries bars on two stacking lines and across a week break.
const events: CalendarEvent[] = [
  { id: 'conf', title: 'Conference', start: new Date(2026, 5, 9), end: new Date(2026, 5, 11) },
  {
    id: 'trip',
    title: 'Trip',
    start: new Date(2026, 5, 13),
    end: new Date(2026, 5, 16),
    categoryId: 'violet'
  },
  { id: 'sprint', title: 'Sprint', start: new Date(2026, 5, 10), end: new Date(2026, 5, 12) }
];
const categories = [{ id: 'violet', label: 'Violet', color: '#8b5cf6' }];

describe('month view', () => {
  it('owns only rows and cells, with clickable multi-day bars and week numbers', () => {
    renderCalendar({ view: 'month', events, categories, showWeekNumbers: true, onEventClick() {} });

    expect(grids()).toHaveLength(1);
    expectWellFormedGrid(grids()[0]);
    // The bars really are there — the test is not passing over an empty month.
    expect(
      document.querySelectorAll('button[role="gridcell"][aria-label="Conference"]')
    ).toHaveLength(1);
  });

  it('places each bar on the day columns it spans, week-number column included', () => {
    renderCalendar({ view: 'month', events, categories, showWeekNumbers: true, onEventClick() {} });

    // Mon 8 – Sun 14 Jun (weekStartsOn 1): Conference runs Tue 9 – Thu 11, i.e.
    // day columns 2–4, which are grid columns 3–5 behind the week number.
    const conference = document.querySelector('[role="gridcell"][aria-label="Conference"]');
    expect(conference?.getAttribute('aria-colindex')).toBe('3');
    expect(conference?.getAttribute('aria-colspan')).toBe('3');
    expect((conference as HTMLElement).style.gridColumn).toBe('3 / span 3');
  });

  it('gives overlapping bars a row each', () => {
    renderCalendar({ view: 'month', events, categories, onEventClick() {} });

    const rowOf = (label: string) =>
      document.querySelector(`[role="gridcell"][aria-label="${label}"]`)?.closest('[role="row"]');
    expect(rowOf('Conference')).not.toBeNull();
    expect(rowOf('Sprint')).not.toBeNull();
    expect(rowOf('Conference')).not.toBe(rowOf('Sprint'));
  });

  it('keeps passive bars (no onEventClick) inside rows too', () => {
    renderCalendar({ view: 'month', events, categories });

    expectWellFormedGrid(grids()[0]);
    expect(document.querySelectorAll('div[role="gridcell"][title="Conference"]')).toHaveLength(1);
  });

  it('labels a bar on a category colour with the higher-contrast ink, and its own fill with its pair', () => {
    renderCalendar({ view: 'month', events, categories, onEventClick() {} });

    const bar = (label: string) =>
      document.querySelector<HTMLElement>(`[role="gridcell"][aria-label="${label}"]`);
    // #8b5cf6: black 4.96 against white 4.23.
    expect(bar('Trip')?.style.color).toBe('black');
    // No category: the library's primary fill, labelled by its own on-colour.
    expect(bar('Conference')?.style.backgroundColor).toBe('var(--color-primary)');
    expect(bar('Conference')?.style.color).toBe('var(--color-text-on-primary)');
  });

  it('keeps arrow-key navigation over the days', () => {
    renderCalendar({ view: 'month' });

    const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    fireEvent.click(day('2026-06-15')!);
    flushSync();
    expect(day('2026-06-15')?.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(grids()[0], { key: 'ArrowDown' });
    flushSync();
    expect(day('2026-06-22')?.getAttribute('tabindex')).toBe('0');
    expect(day('2026-06-15')?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('custom day cells', () => {
  const dayCell = createRawSnippet((ctx: () => DayCellContext) => ({
    render: () => `<span data-custom-day>${ctx().date.getDate()}</span>`
  }));

  it('wraps the snippet in a gridcell the library owns', () => {
    renderCalendar({ view: 'month', dayCell, value: new Date(2026, 5, 18) });

    expectWellFormedGrid(grids()[0]);
    const custom = document.querySelectorAll('[data-custom-day]');
    expect(custom.length).toBeGreaterThanOrEqual(28);
    for (const span of Array.from(custom)) {
      expect(span.parentElement?.getAttribute('role')).toBe('gridcell');
    }
  });

  it('puts the day state on the wrapper, and nothing that would steal the arrow keys', () => {
    renderCalendar({ view: 'month', dayCell, value: new Date(2026, 5, 18) });

    const cellOf = (day: number) =>
      Array.from(document.querySelectorAll('[data-custom-day]')).find(
        (s) => s.textContent === String(day) && s.parentElement?.getAttribute('aria-selected')
      )?.parentElement;
    const selected = cellOf(18);
    expect(selected?.getAttribute('aria-selected')).toBe('true');
    expect(selected?.hasAttribute('aria-label')).toBe(false);
    expect(selected?.hasAttribute('tabindex')).toBe(false);
    expect(selected?.hasAttribute('data-date')).toBe(false);
  });

  it('lands the arrow keys on a control that carries data-date, as the JSDoc says', async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const focusable = createRawSnippet((ctx: () => DayCellContext) => ({
      render: () => {
        const { date, isFocused } = ctx();
        const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        return `<button type="button" data-date="${iso}" tabindex="${isFocused ? 0 : -1}">${date.getDate()}</button>`;
      }
    }));
    renderCalendar({ view: 'month', dayCell: focusable });

    const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
    day('2026-06-15').focus();
    fireEvent.keyDown(day('2026-06-15'), { key: 'ArrowRight' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(day('2026-06-16'));
  });
});

describe('year view', () => {
  it('owns four rows of three months', () => {
    renderCalendar({ view: 'year' });

    expect(grids()).toHaveLength(1);
    expectWellFormedGrid(grids()[0]);
    const rows = grids()[0].querySelectorAll('[role="row"]');
    expect(rows).toHaveLength(4);
    for (const row of Array.from(rows))
      expect(ownedRoles(row)).toEqual(['gridcell', 'gridcell', 'gridcell']);
  });

  it('keeps its arrow keys: right by a month, down by a row', () => {
    renderCalendar({ view: 'year' });

    const month = (m: number) => document.querySelector<HTMLElement>(`[data-month="${m}"]`)!;
    month(0).focus();
    fireEvent.keyDown(month(0), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(month(1));
    fireEvent.keyDown(month(1), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(month(4));
    fireEvent.keyDown(month(4), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(month(1));
  });
});

describe('week view', () => {
  it('is a labelled group, not a grid — it has no cell navigation', () => {
    renderCalendar({ view: 'week' });

    expect(grids()).toHaveLength(0);
    const layout = document.querySelector('[role="group"][aria-label="Week view"]');
    expect(layout).not.toBeNull();
    // Not a tab stop of its own: the roving day head is.
    expect(layout?.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps arrow-key movement between the day heads', () => {
    renderCalendar({ view: 'week' });

    const heads = Array.from(document.querySelectorAll<HTMLElement>('[data-weekday]'));
    expect(heads).toHaveLength(7);
    expect(heads.map((h) => h.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1'
    ]);
    heads[0].focus();
    fireEvent.keyDown(heads[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(heads[1]);
    fireEvent.keyDown(heads[1], { key: 'End' });
    expect(document.activeElement).toBe(heads[6]);
  });
});

describe('mini calendar', () => {
  it('owns one row per week', () => {
    renderCalendar({ view: 'week', showMiniCalendar: true });

    expect(grids()).toHaveLength(1);
    const grid = grids()[0];
    expectWellFormedGrid(grid);
    expect(grid.getAttribute('aria-label')).toBe('June 2026');
    for (const row of Array.from(grid.querySelectorAll('[role="row"]'))) {
      expect(ownedRoles(row)).toHaveLength(7);
    }
  });
});
