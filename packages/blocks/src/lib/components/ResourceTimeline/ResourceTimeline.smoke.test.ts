/**
 * SSR smoke render for ResourceTimeline — the ARIA skeleton, asserted.
 *
 * `node` env with `render` from `svelte/server`, using the `cellTag` regex idiom
 * from `Planner.parity.test.ts`. The point is the relationship risk 3 named: a
 * `role="grid"` whose bars are absolutely positioned can read as an *empty*
 * grid, and axe would not notice — the lane name has to come from a
 * `rowheader` inside the row, and every bar has to sit inside the `gridcell` of
 * its first visible day. That is a structural claim, so it is asserted on the
 * server output rather than left to a baseline.
 *
 * The clock is pinned wherever "today" is in play (`today` comes from
 * `new Date()` inside `DateGridController`), and no assertion reads formatted
 * date text — vitest runs under Node with LANG=de_DE.
 */

import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  { id: 'r1', label: 'Sea view', description: 'Double' },
  { id: 'r2', label: 'Garden', description: 'Twin' },
  { id: 'r3', label: 'Attic' }
];

const bookings: Booking[] = [
  { id: 'b1', room: 'r1', from: '2026-06-16', to: '2026-06-18' },
  { id: 'b2', room: 'r2', from: '2026-06-15', to: '2026-06-15' }
];

function renderTimeline(props: Partial<ResourceTimelineProps<Booking>>) {
  return render(ResourceTimeline, {
    props: {
      resources: rooms,
      getResourceId: (b: Booking) => b.room,
      getRange: (b: Booking) => ({ start: b.from, end: b.to }),
      getId: (b: Booking) => b.id,
      value: anchor,
      ...props
    } as unknown as ComponentProps<typeof ResourceTimeline>
  });
}

/** The gridcell opening tag at (lane, day). */
const cellTag = (body: string, lane: number, day: number) =>
  body.match(new RegExp(`<div[^>]*data-lane="${lane}"[^>]*data-day="${day}"[^>]*>`))?.[0] ?? '';

/** Everything the gridcell at (lane, day) contains, up to the next gridcell. */
const cellBody = (body: string, lane: number, day: number) =>
  body.split(`data-lane="${lane}" data-day="${day}"`)[1]?.split('data-lane=')[0] ?? '';

const countOf = (body: string, needle: string) => body.split(needle).length - 1;

/** The markup of the row that owns lane `n` (the `role="row"` block it sits in). */
const laneRow = (body: string, lane: number) =>
  body.split('role="row"')[lane + 2]?.split('role="row"')[0] ?? '';

describe('ResourceTimeline SSR skeleton', () => {
  it('renders a grid with one row per resource plus the day header row', () => {
    const { body } = renderTimeline({ view: 'week' });
    expect(body).toContain('role="grid"');
    expect(countOf(body, 'role="row"')).toBe(rooms.length + 1);
    expect(countOf(body, 'role="rowheader"')).toBe(rooms.length);
  });

  it('names each lane from its own rowheader', () => {
    // Bars are absolutely positioned; without this the grid announces columns
    // and no resources at all.
    const { body } = renderTimeline({ view: 'week' });
    for (const [index, room] of rooms.entries()) {
      const row = laneRow(body, index);
      expect(row).toContain('role="rowheader"');
      expect(row).toContain(room.label);
    }
  });

  it('gives every column header an aria-colindex, with the corner at 1', () => {
    const { body } = renderTimeline({ view: 'week' });
    expect(countOf(body, 'role="columnheader"')).toBe(8); // corner + 7 days
    for (let i = 1; i <= 8; i++) expect(body).toContain(`aria-colindex="${i}"`);
    expect(body).toContain('aria-colcount="8"');
  });

  it('renders one gridcell per (resource, day)', () => {
    const { body } = renderTimeline({ view: 'week' });
    expect(countOf(body, 'role="gridcell"')).toBe(rooms.length * 7);
    expect(cellTag(body, 0, 0)).toContain('data-date="2026-06-15"');
    expect(cellTag(body, 2, 6)).toContain('data-date="2026-06-21"');
  });

  it('renders a `days` window unpadded, starting at the reference date', () => {
    const { body } = renderTimeline({ view: 'days', days: 10, value: new Date(2026, 5, 17) });
    expect(countOf(body, 'role="gridcell"')).toBe(rooms.length * 10);
    expect(cellTag(body, 0, 0)).toContain('data-date="2026-06-17"'); // Wednesday
    expect(cellTag(body, 0, 9)).toContain('data-date="2026-06-26"');
    expect(body).not.toContain('data-date="2026-06-16"');
  });

  it('anchors each bar in the gridcell of its first visible day', () => {
    const { body } = renderTimeline({ view: 'week', items: bookings });
    // b1 covers 16–18 Jun → lane 0, column 1, spanning 3 columns.
    expect(cellBody(body, 0, 1)).toContain('--rt-span:3');
    expect(cellBody(body, 0, 0)).not.toContain('--rt-span');
    expect(cellBody(body, 0, 2)).not.toContain('--rt-span');
    // b2 is a single night on lane 1, column 0.
    expect(cellBody(body, 1, 0)).toContain('--rt-span:1');
    // Lane 2 has no bookings at all.
    expect(countOf(laneRow(body, 2), '--rt-span')).toBe(0);
  });

  it('labels a bar from getLabel, and falls back to a translated occupancy label', () => {
    const withLabel = renderTimeline({ view: 'week', items: bookings, getLabel: (b) => b.id }).body;
    expect(cellBody(withLabel, 0, 1)).toContain('aria-label="b1"');

    const without = renderTimeline({ view: 'week', items: bookings }).body;
    expect(cellBody(without, 0, 1)).toContain('aria-label="Occupied"');
  });

  it('keeps overflow-x on the track and off the root', () => {
    // Risk 2: an `overflow-x` on the root scrolls the PAGE sideways on a phone,
    // the failure the Calendar header already caused once.
    const { body } = renderTimeline({ view: 'week' });
    const rootTag = body.match(/<div[^>]*>/)?.[0] ?? '';
    expect(rootTag).not.toContain('overflow-x');
    const trackTag = body.match(/<div[^>]*role="grid"[^>]*>/)?.[0] ?? '';
    expect(trackTag).toContain('overflow-x-auto');
  });

  it('assembles the column template from the day count', () => {
    const { body } = renderTimeline({ view: 'days', days: 12 });
    expect(body).toContain('repeat(12, minmax(var(--rt-day-w), 1fr))');
  });

  it('pins the resource column by default and releases it on request', () => {
    expect(renderTimeline({ view: 'week' }).body).toContain('sticky left-0');
    expect(renderTimeline({ view: 'week', stickyResourceColumn: false }).body).not.toContain(
      'sticky left-0'
    );
  });

  it('pads the scroll port by exactly the column it pins', () => {
    // `focus()` scrolls a cell to the port's nearest edge — which, for a
    // leftward move, is the strip the pinned column paints over. The padding
    // rides on the same prop as the pin, so it cannot outlive it.
    const pinned = renderTimeline({ view: 'week' }).body;
    expect(pinned).toContain('[scroll-padding-inline-start:var(--rt-lane-w)]');
    expect(renderTimeline({ view: 'week', stickyResourceColumn: false }).body).not.toContain(
      'scroll-padding-inline-start'
    );
  });

  it('honours unstyled and slotClasses on the way to the markup', () => {
    // `slot()` — not tv() — is where `unstyled` and `slotClasses` actually land,
    // so the contract can only be asserted on rendered output.
    const bare = renderTimeline({ view: 'week', unstyled: true, class: 'my-root' }).body;
    const rootTag = bare.match(/<div[^>]*>/)?.[0] ?? '';
    expect(rootTag).toContain('class="my-root"');
    expect(bare).not.toContain('overflow-x-auto');

    const merged = renderTimeline({ view: 'week', slotClasses: { dayCell: 'ring-me' } }).body;
    const cell = cellTag(merged, 0, 0);
    expect(cell).toContain('ring-me');
    expect(cell).toContain('border-border-hairline'); // …next to the tv() classes
  });

  it('marks a disabled day and a disabled lane with aria-disabled', () => {
    const byDate = renderTimeline({ view: 'week', minDate: new Date(2026, 5, 17) }).body;
    expect(cellTag(byDate, 0, 0)).toContain('aria-disabled="true"');
    expect(cellTag(byDate, 0, 2)).not.toContain('aria-disabled="true"');

    const byLane = renderTimeline({
      view: 'week',
      resources: [rooms[0], { ...rooms[1], disabled: true }]
    }).body;
    expect(cellTag(byLane, 1, 3)).toContain('aria-disabled="true"');
    expect(cellTag(byLane, 0, 3)).not.toContain('aria-disabled="true"');
  });

  it('heads each group with a spanning rowheader row', () => {
    const { body } = renderTimeline({
      view: 'week',
      resources: [
        { id: 'a', label: 'A', groupId: 'cala' },
        { id: 'b', label: 'B', groupId: 'cala' },
        { id: 'c', label: 'C', groupId: 'firn' }
      ],
      groups: [
        { id: 'cala', label: 'Cala' },
        { id: 'firn', label: 'Firn' }
      ]
    });
    // 1 day header + 2 group rows + 3 lanes.
    expect(countOf(body, 'role="row"')).toBe(6);
    expect(body).toContain(`aria-colspan="8"`);
    expect(countOf(body, 'aria-colspan="8"')).toBe(2);
  });

  it('renders the empty state INSTEAD of the grid when there are no resources', () => {
    // Not merely without cells: a day axis over nothing is a skeleton, so the
    // grid is not rendered at all and the empty message stands alone.
    const { body } = renderTimeline({ view: 'week', resources: [] });
    expect(countOf(body, 'role="gridcell"')).toBe(0);
    expect(body).not.toContain('role="grid"');
    expect(countOf(body, 'role="columnheader"')).toBe(0);
    expect(body).toContain('No resources');
  });

  it('renders the category legend, and drops it on request', () => {
    const categories = [{ id: 'suite', label: 'Suite', color: '#123456' }];
    expect(renderTimeline({ view: 'week', categories }).body).toContain('Suite');
    expect(renderTimeline({ view: 'week', categories, showLegend: false }).body).not.toContain(
      'Suite'
    );
  });
});

describe('ResourceTimeline marks today for screen readers', () => {
  const NOW = new Date(2026, 5, 17, 9, 0); // Wed 17 Jun 2026

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('sets aria-current="date" on today\'s column and cells', () => {
    const { body } = renderTimeline({ view: 'week' });
    expect(cellTag(body, 0, 2)).toContain('aria-current="date"'); // Wed = column 2
    expect(cellTag(body, 0, 1)).not.toContain('aria-current');
    expect(countOf(body, 'aria-current="date"')).toBe(rooms.length + 1); // + the columnheader
  });

  it('keeps it when highlightToday is off', () => {
    // Same rule as Calendar and Planner: the visual preference must not cost
    // the semantic pointer.
    const { body } = renderTimeline({ view: 'week', highlightToday: false });
    expect(cellTag(body, 0, 2)).toContain('aria-current="date"');
    expect(body).not.toContain('bg-primary-subtle');
  });
});
