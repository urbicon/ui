// @vitest-environment jsdom
/**
 * The fold, measured on the rendered component.
 *
 * `planner.variants.test.ts` next door asks the config what it declares; this
 * file asks the DOM what survived. The distinction is the whole point: the
 * defect in #349 lived in the markup — a class written in front of an
 * already-folded string, or handed to `slot()` beside the consumer's entry —
 * and a config-level assertion stays green through all of it. Every case below
 * gives a slot a consumer class in the library class's own conflict bucket and
 * asserts the library class is gone from the attribute.
 *
 * Falsifiability is not assumed: reverting either markup site (the scaffold's
 * `class="grid {gridColsClass} {rowClass}"`, Planner's `isWeek && 'md:hidden'`)
 * turns exactly the matching case red.
 */
import type { ComponentProps } from 'svelte';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { toIso } from '$lib/date';
import type { PlannerProps } from './index';
import Planner from './Planner.svelte';

interface Slot {
  id: string;
  date: Date;
}

const today = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();
/** Monday of the current week, so the week view's cells are known dates. */
const monday = (() => {
  const d = new Date(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const dayAfter = (days: number) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + days);
  return d;
};
const saturday = dayAfter(5);
/**
 * A weekday that is neither today nor a weekend, so its cell carries no state
 * mark. Derived rather than fixed: today is one of Mon-Fri on five days in
 * seven, and pinning an offset would make the unmarked assertions pass or fail
 * by weekday.
 */
const unmarked = dayAfter([0, 1, 2, 3, 4].find((o) => dayAfter(o).getTime() !== today.getTime())!);

let app: ReturnType<typeof mount> | undefined;

// `T = Slot` fixed by the cast, the way Planner.smoke.test.ts does it: `mount`
// cannot infer the component's generic from a props object.
function render(props: Partial<PlannerProps<Slot>>): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(Planner, {
    target,
    props: {
      getDate: (item: Slot) => item.date,
      value: monday,
      ...props
    } as unknown as ComponentProps<typeof Planner>
  });
  return target;
}

afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  document.body.innerHTML = '';
});

/** The scaffold's grid container — the element the `grid` slot lands on. */
function gridRoot(target: HTMLElement): HTMLElement {
  const grid = target.querySelector('[role="grid"]');
  if (!grid) throw new Error('no grid rendered');
  return grid as HTMLElement;
}

/** Class tokens of the weekday-header row (the one with column headers). */
function headerRow(target: HTMLElement): string[] {
  const row = [...target.querySelectorAll('[role="row"]')].find((r) =>
    r.querySelector('[role="columnheader"]')
  );
  if (!row) throw new Error('no weekday-header row rendered');
  return [...row.classList];
}

/** Class tokens of the first week row (the one with gridcells). */
function weekRow(target: HTMLElement): string[] {
  const row = [...target.querySelectorAll('[role="row"]')].find((r) =>
    r.querySelector('[role="gridcell"]')
  );
  if (!row) throw new Error('no week row rendered');
  return [...row.classList];
}

/** Planner's own cell body inside the gridcell for `date`. */
function cellBody(target: HTMLElement, date: Date): HTMLElement {
  const gridcell = target.querySelector(`[data-date="${toIso(date)}"]`);
  const body = gridcell?.firstElementChild;
  if (!body) throw new Error(`no cell rendered for ${toIso(date)}`);
  return body as HTMLElement;
}

const cellHeader = (target: HTMLElement, date: Date) =>
  cellBody(target, date).firstElementChild as HTMLElement;
const cellDate = (target: HTMLElement, date: Date) =>
  cellHeader(target, date).lastElementChild as HTMLElement;

describe('Planner override fold', () => {
  it('paints the library classes when the consumer collides with nothing', () => {
    // The control for every case below: without it each assertion could pass
    // by the element never carrying the class in the first place.
    const target = render({ view: 'week', selectedDate: saturday, highlightWeekend: true });

    expect(headerRow(target)).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-7', 'gap-2', 'max-md:hidden'])
    );
    expect(weekRow(target)).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-7', 'gap-2', 'max-md:grid-cols-1'])
    );
    expect([...cellHeader(target, unmarked).classList]).toContain('md:hidden');
    expect([...cellDate(target, unmarked).classList]).toContain('text-text-secondary');
    expect([...cellBody(target, saturday).classList]).toEqual(
      expect.arrayContaining(['ring-2', 'bg-surface-subtle'])
    );

    const month = render({ view: 'month' });
    expect([...gridRoot(month).classList]).toEqual(
      expect.arrayContaining(['border-border-subtle', 'border-r', 'border-b'])
    );
  });

  it('strips the month frame the consumer collides with', () => {
    // `view` is an axis, so the month and range branches of the config are
    // unreachable from the default state every other case here renders in —
    // route D measures `week` and nothing else, and this frame is the only
    // thing the two other views paint that `week` does not.
    for (const view of ['month', 'range'] as const) {
      const target = render({
        view,
        rangeStart: monday,
        rangeEnd: dayAfter(20),
        slotClasses: { grid: 'border-0 border-transparent' }
      });
      const tokens = [...gridRoot(target).classList];
      expect(tokens, view).not.toContain('border-r');
      expect(tokens, view).not.toContain('border-b');
      expect(tokens, view).not.toContain('border-border-subtle');
      expect(tokens, view).toEqual(expect.arrayContaining(['border-0', 'border-transparent']));
    }
  });

  it('strips the row geometry the consumer collides with', () => {
    // The scaffold's `grid-cols-*` has to reach the row as a tv() source, not
    // as a prefix on the string Planner hands it: a prefix never meets the
    // consumer's entry, because the caller's fold is already over by then.
    const target = render({
      view: 'week',
      slotClasses: { weekdayHeader: 'grid-cols-1 gap-0', week: 'grid-cols-1 gap-0' }
    });

    for (const tokens of [headerRow(target), weekRow(target)]) {
      expect(tokens).not.toContain('grid-cols-7');
      expect(tokens).not.toContain('gap-2');
      expect(tokens).toEqual(expect.arrayContaining(['grid-cols-1', 'gap-0']));
    }
    // A breakpoint-scoped class is its own bucket, so Planner's stacking rules
    // compose with the consumer's unprefixed entry instead of losing to it.
    expect(headerRow(target)).toContain('max-md:hidden');
    expect(weekRow(target)).toContain('max-md:grid-cols-1');
  });

  it('strips the view-conditional cell header the consumer collides with', () => {
    const target = render({ view: 'week', slotClasses: { cellHeader: 'md:block' } });

    const tokens = [...cellHeader(target, unmarked).classList];
    expect(tokens).not.toContain('md:hidden');
    expect(tokens).toContain('md:block');
  });

  it('strips the day-state marks the consumer collides with', () => {
    const target = render({
      view: 'week',
      selectedDate: saturday,
      highlightWeekend: true,
      slotClasses: {
        cell: 'ring-0 bg-transparent opacity-100',
        cellDate: 'bg-transparent text-transparent rounded-none'
      }
    });

    // Selected + weekend on one cell: two state axes, one consumer entry.
    const body = [...cellBody(target, saturday).classList];
    expect(body).not.toContain('ring-2');
    expect(body).not.toContain('bg-surface-subtle');
    expect(body).toEqual(expect.arrayContaining(['ring-0', 'bg-transparent', 'opacity-100']));

    const todayDate = [...cellDate(target, today).classList];
    expect(todayDate).not.toContain('bg-primary');
    expect(todayDate).not.toContain('rounded-full');
    expect(todayDate).not.toContain('text-text-secondary');
  });

  it('keeps the week view stacking under `unstyled`, and nothing else', () => {
    // Structure, not decoration: without the three breakpoint classes the
    // weekday and the date print in the header row and in every cell at once.
    const target = render({ view: 'week', unstyled: true, highlightWeekend: true });

    expect(headerRow(target)).toContain('max-md:hidden');
    expect(headerRow(target)).not.toContain('gap-2');
    expect(weekRow(target)).toContain('max-md:grid-cols-1');
    expect([...cellHeader(target, unmarked).classList]).toEqual(['md:hidden']);
    expect(cellBody(target, saturday).getAttribute('class')).toBe(null);
    expect(cellDate(target, today).getAttribute('class')).toBe(null);
  });
});
