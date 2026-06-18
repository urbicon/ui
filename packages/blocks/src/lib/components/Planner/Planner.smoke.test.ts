/**
 * SSR smoke render for Planner.
 *
 * The vitest env is `node`, so these assert what static checks can't: every view
 * renders to HTML without throwing, the scaffold geometry reaches the DOM, items
 * bucket through to the `cell` snippet, and selection marks the right cell. A
 * coarse regression net for the controller→scaffold→cell wiring, not a visual check.
 */

import type { ComponentProps } from 'svelte';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { PlannerProps } from './index';
import Planner from './Planner.svelte';
import type { PlannerCellContext } from './planner.types';

interface Meal {
  id: string;
  date: string;
}

const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026

const meals: Meal[] = [
  { id: 'm1', date: '2026-06-16' },
  { id: 'm2', date: '2026-06-16' },
  { id: 'm3', date: '2026-06-17' }
];

const getMealDate = (m: Meal) => m.date;

// Render with `T = Meal` fixed: svelte/server's `render` can't infer the generic
// from props, so the typed helper supplies a default `getDate` and casts once.
function renderPlanner(props: Partial<PlannerProps<Meal>>) {
  return render(Planner, {
    props: { getDate: getMealDate, ...props } as unknown as ComponentProps<typeof Planner>
  });
}

// A cell snippet that stamps the bucket size per day — lets SSR assert bucketing.
const countCell = createRawSnippet<[PlannerCellContext<Meal>]>((cellCtx) => ({
  render: () => {
    const c = cellCtx();
    return `<span data-count="${c.isoDate}:${c.items.length}">x</span>`;
  }
}));

const emptyMarker = createRawSnippet<[PlannerCellContext<Meal>]>((cellCtx) => ({
  render: () => `<span data-empty="${cellCtx().isoDate}">empty</span>`
}));

/** Match the gridcell tag for a given local date. */
function cellTag(body: string, iso: string): string {
  return body.match(new RegExp(`<div[^>]*data-date="${iso}"[^>]*>`))?.[0] ?? '';
}

describe('Planner SSR smoke', () => {
  for (const view of ['week', 'month', 'range'] as const) {
    it(`renders the ${view} view without throwing`, () => {
      const { body } = renderPlanner({
        view,
        value: anchor,
        rangeStart: anchor,
        rangeEnd: new Date(2026, 5, 20)
      });
      expect(body.length).toBeGreaterThan(0);
      expect(body).toContain('aria-live="polite"');
    });
  }

  it('week view lays out the anchor week (Mon–Sun) as gridcells', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor });
    expect(body).toContain('data-date="2026-06-15"'); // Monday
    expect(body).toContain('data-date="2026-06-21"'); // Sunday
    expect(body).not.toContain('data-date="2026-06-14"'); // previous week
  });

  it('month view renders the anchor month down to day cells incl. spill', () => {
    const { body } = renderPlanner({ view: 'month', value: anchor });
    expect(body).toContain('data-date="2026-06-01"');
    expect(body).toContain('data-date="2026-06-30"');
    expect(body).toContain('data-date="2026-07-01"'); // trailing spill
  });

  it('range view chunks full weeks covering [rangeStart, rangeEnd]', () => {
    const { body } = renderPlanner({
      view: 'range',
      rangeStart: new Date(2026, 5, 10),
      rangeEnd: new Date(2026, 5, 20)
    });
    // startOfWeek(10 Jun)=Mon 8 Jun … endOfWeek(20 Jun)=Sun 21 Jun
    expect(body).toContain('data-date="2026-06-08"');
    expect(body).toContain('data-date="2026-06-21"');
  });

  it('buckets items by local day and hands them to the cell snippet', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      items: meals,
      getDate: (m: Meal) => m.date,
      cell: countCell
    });
    expect(body).toContain('data-count="2026-06-16:2"');
    expect(body).toContain('data-count="2026-06-17:1"');
    expect(body).toContain('data-count="2026-06-15:0"'); // a day with no items
  });

  it('renders the empty snippet for days with no items', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      items: meals,
      getDate: (m: Meal) => m.date,
      cell: countCell,
      empty: emptyMarker
    });
    // 16/17 Jun have items → count; 15 Jun has none → empty marker.
    expect(body).toContain('data-empty="2026-06-15"');
    expect(body).not.toContain('data-empty="2026-06-16"');
  });

  it('marks the selected day with aria-selected', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      selectedDate: new Date(2026, 5, 16)
    });
    expect(cellTag(body, '2026-06-16')).toContain('aria-selected="true"');
    expect(cellTag(body, '2026-06-15')).not.toContain('aria-selected="true"');
  });

  it('renders the localized title in the aria-live status region', () => {
    const { body } = renderPlanner({ view: 'week', value: anchor, locale: 'de-DE' });
    // formatWeekTitle(de) → "KW 25 – Juni 2026"
    expect(body).toContain('KW 25');
  });

  it('renders the default count badge when no cell snippet is given', () => {
    const { body } = renderPlanner({
      view: 'week',
      value: anchor,
      items: meals,
      getDate: (m: Meal) => m.date
    });
    // Two meals on 16 Jun → the fallback badge shows "2" inside that cell.
    expect(body).toMatch(/data-date="2026-06-16"[\s\S]*?>2</);
  });
});
