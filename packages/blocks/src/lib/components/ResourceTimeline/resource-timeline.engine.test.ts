/**
 * The pure lane layout — window geometry, range parsing, clipping and stacking.
 *
 * `node` env: nothing here touches a DOM. Dates are pinned to June 2026 and no
 * assertion reads formatted date text (vitest runs under Node with LANG=de_DE).
 */

import { describe, expect, it, vi } from 'vitest';
import { toDateKey } from '../Planner/planner.bucket';
import {
  getTimelineDays,
  getTimelineWindow,
  layoutTimeline,
  parseTimelineDate
} from './resource-timeline.engine';
import type { TimelineResource } from './resource-timeline.types';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rooms: TimelineResource[] = [
  { id: 'r1', label: 'Room 1' },
  { id: 'r2', label: 'Room 2' }
];

interface Booking {
  id: string;
  room: string;
  from: string;
  to: string;
}

const week = getTimelineWindow(new Date(2026, 5, 17), 'week', 7, 1); // Wed 17 Jun → Mon 15–Sun 21

function layout(items: Booking[], overrides: Partial<Parameters<typeof layoutTimeline>[0]> = {}) {
  return layoutTimeline<Booking>({
    resources: rooms,
    items,
    getResourceId: (b) => b.room,
    getRange: (b) => ({ start: b.from, end: b.to }),
    getId: (b) => b.id,
    window: week,
    ...overrides
  } as Parameters<typeof layoutTimeline<Booking>>[0]);
}

const lane = (id: string, lanes: ReturnType<typeof layout>) =>
  lanes.find((l) => l.resource.id === id)!;

describe('getTimelineWindow', () => {
  it('snaps `week` to the week containing the reference date', () => {
    const w = getTimelineWindow(new Date(2026, 5, 17), 'week', 7, 1);
    expect(iso(w.start)).toBe('2026-06-15'); // Monday
    expect(iso(w.end)).toBe('2026-06-21'); // Sunday
  });

  it('honours weekStartsOn', () => {
    const w = getTimelineWindow(new Date(2026, 5, 17), 'week', 7, 0); // Sunday-first
    expect(iso(w.start)).toBe('2026-06-14');
    expect(iso(w.end)).toBe('2026-06-20');
  });

  it('starts a `days` window AT the reference date, unpadded', () => {
    // The seam risk 8 named: `DateGridController.rangeStart/rangeEnd` would pad
    // this mid-week window out to whole weeks (Mon 15 Jun – Sun 28 Jun).
    const w = getTimelineWindow(new Date(2026, 5, 17), 'days', 14, 1);
    expect(iso(w.start)).toBe('2026-06-17'); // Wednesday, not the Monday
    expect(iso(w.end)).toBe('2026-06-30');
    expect(getTimelineDays(w)).toHaveLength(14);
  });

  it('clamps a nonsensical day count to one column', () => {
    const w = getTimelineWindow(new Date(2026, 5, 17), 'days', 0, 1);
    expect(getTimelineDays(w)).toHaveLength(1);
  });

  it('ignores `days` in week view', () => {
    expect(getTimelineDays(getTimelineWindow(new Date(2026, 5, 17), 'week', 30, 1))).toHaveLength(
      7
    );
  });
});

describe('parseTimelineDate', () => {
  it('reads a local date string verbatim, exactly as planner.bucket does', () => {
    const parsed = parseTimelineDate('2026-06-16')!;
    expect(iso(parsed)).toBe('2026-06-16');
    expect(iso(parsed)).toBe(toDateKey('2026-06-16'));
  });

  it('takes a UTC instant string on its WRITTEN day, like Planner', () => {
    // The documented trade-off of the shared parser: `'…T23:00:00Z'` buckets on
    // the day it is written with, not the local day it may fall on. Asserted
    // here so a second parser cannot quietly disagree with Planner's.
    expect(parseTimelineDate('2026-06-16T23:00:00Z')).toEqual(parseTimelineDate('2026-06-16'));
    expect(iso(parseTimelineDate('2026-06-16T23:00:00Z')!)).toBe(toDateKey('2026-06-16T23:00:00Z'));
  });

  it('reduces a Date to its local calendar day', () => {
    expect(iso(parseTimelineDate(new Date(2026, 5, 16, 23, 30))!)).toBe('2026-06-16');
  });

  it('returns null for a value no calendar day can be read from', () => {
    expect(parseTimelineDate('not a date')).toBeNull();
    expect(parseTimelineDate('2026-02-30')).toBeNull();
    expect(parseTimelineDate(new Date('nope'))).toBeNull();
  });
});

describe('layoutTimeline — clipping', () => {
  it('places a span fully inside the window with inclusive [start, end]', () => {
    const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-16', to: '2026-06-18' }]);
    expect(l.spans).toHaveLength(1);
    const s = l.spans[0];
    expect(s.startCol).toBe(1);
    expect(s.spanCols).toBe(3); // 16, 17, 18 — `end` is a covered day
    expect(s.totalDays).toBe(3);
    expect(s.isStart).toBe(true);
    expect(s.isEnd).toBe(true);
    expect(s.row).toBe(0);
  });

  it('renders a single-day span as one column with both edges intact', () => {
    const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-16', to: '2026-06-16' }]);
    expect(l.spans[0].spanCols).toBe(1);
    expect(l.spans[0].isStart).toBe(true);
    expect(l.spans[0].isEnd).toBe(true);
  });

  it('cuts a span that starts before the window', () => {
    const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-10', to: '2026-06-17' }]);
    const s = l.spans[0];
    expect(s.startCol).toBe(0);
    expect(s.spanCols).toBe(3); // 15, 16, 17
    expect(s.isStart).toBe(false);
    expect(s.isEnd).toBe(true);
    expect(s.totalDays).toBe(8); // the UNCLIPPED length stays readable
    expect(iso(s.start)).toBe('2026-06-10');
  });

  it('cuts a span that ends after the window', () => {
    const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-19', to: '2026-06-30' }]);
    const s = l.spans[0];
    expect(s.startCol).toBe(4);
    expect(s.spanCols).toBe(3); // 19, 20, 21
    expect(s.isStart).toBe(true);
    expect(s.isEnd).toBe(false);
  });

  it('cuts a span that straddles the whole window', () => {
    const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-01', to: '2026-06-30' }]);
    expect(l.spans[0].startCol).toBe(0);
    expect(l.spans[0].spanCols).toBe(7);
    expect(l.spans[0].isStart).toBe(false);
    expect(l.spans[0].isEnd).toBe(false);
  });

  it('drops a span entirely outside the window', () => {
    const lanes = layout([
      { id: 'before', room: 'r1', from: '2026-06-01', to: '2026-06-14' },
      { id: 'after', room: 'r1', from: '2026-06-22', to: '2026-06-25' }
    ]);
    expect(lanes[0].spans).toHaveLength(0);
  });
});

describe('layoutTimeline — stacking', () => {
  it('keeps non-overlapping spans on one row and stacks overlaps', () => {
    const lanes = layout([
      { id: 'a', room: 'r1', from: '2026-06-15', to: '2026-06-16' },
      { id: 'b', room: 'r1', from: '2026-06-17', to: '2026-06-18' },
      { id: 'c', room: 'r1', from: '2026-06-16', to: '2026-06-17' }
    ]);
    const rows = Object.fromEntries(lanes[0].spans.map((s) => [s.id, s.row]));
    expect(rows).toEqual({ a: 0, b: 0, c: 1 });
    expect(lanes[0].rows).toBe(2);
  });

  it('reports a lane height of 1 when it holds nothing', () => {
    expect(layout([])[0].rows).toBe(1);
  });

  it('splits visible rows from overflow at maxRows', () => {
    const items = ['a', 'b', 'c'].map((id) => ({
      id,
      room: 'r1',
      from: '2026-06-16',
      to: '2026-06-18'
    }));
    const lanes = layout(items, { maxRows: 2 });
    expect(lanes[0].spans).toHaveLength(2);
    expect(lanes[0].overflow).toBe(1);
    expect(lanes[0].rows).toBe(2);
  });

  it('keeps lanes independent', () => {
    const lanes = layout([
      { id: 'a', room: 'r1', from: '2026-06-16', to: '2026-06-18' },
      { id: 'b', room: 'r2', from: '2026-06-16', to: '2026-06-18' }
    ]);
    expect(lane('r1', lanes).spans[0].row).toBe(0);
    expect(lane('r2', lanes).spans[0].row).toBe(0);
  });
});

describe('layoutTimeline — tolerant reads', () => {
  it('orders an inverted range instead of dropping it, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const [l] = layout([{ id: 'b1', room: 'r1', from: '2026-06-18', to: '2026-06-16' }]);
      expect(l.spans[0].spanCols).toBe(3);
      expect(iso(l.spans[0].start)).toBe('2026-06-16');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('drops an item whose resource id is in no lane, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const lanes = layout([
        { id: 'ghost1', room: 'r9', from: '2026-06-16', to: '2026-06-17' },
        { id: 'ghost2', room: 'r9', from: '2026-06-16', to: '2026-06-17' },
        { id: 'real', room: 'r1', from: '2026-06-16', to: '2026-06-17' }
      ]);
      expect(lanes.flatMap((l) => l.spans.map((s) => s.id))).toEqual(['real']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('"r9"');
    } finally {
      warn.mockRestore();
    }
  });

  it('drops an item whose range cannot be read, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const lanes = layout([{ id: 'junk', room: 'r1', from: 'yesterday', to: 'tomorrow' }]);
      expect(lanes[0].spans).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('layoutTimeline — lanes, groups and categories', () => {
  it('keeps the declared resource order without groups', () => {
    expect(layout([]).map((l) => l.resource.id)).toEqual(['r1', 'r2']);
  });

  it('re-orders lanes to follow the declared group order', () => {
    const lanes = layoutTimeline<Booking>({
      resources: [
        { id: 'a', label: 'A', groupId: 'north' },
        { id: 'b', label: 'B', groupId: 'south' },
        { id: 'c', label: 'C', groupId: 'north' }
      ],
      groups: [
        { id: 'south', label: 'South' },
        { id: 'north', label: 'North' }
      ],
      getResourceId: (b) => b.room,
      getRange: (b) => ({ start: b.from, end: b.to }),
      window: week
    });
    expect(lanes.map((l) => l.resource.id)).toEqual(['b', 'a', 'c']);
    expect(lanes.map((l) => l.group?.id)).toEqual(['south', 'north', 'north']);
  });

  it('appends a lane whose groupId names no group rather than dropping it', () => {
    const lanes = layoutTimeline<Booking>({
      resources: [
        { id: 'a', label: 'A', groupId: 'typo' },
        { id: 'b', label: 'B', groupId: 'north' }
      ],
      groups: [{ id: 'north', label: 'North' }],
      getResourceId: (b) => b.room,
      getRange: (b) => ({ start: b.from, end: b.to }),
      window: week
    });
    expect(lanes.map((l) => l.resource.id)).toEqual(['b', 'a']);
    expect(lanes[1].group).toBeUndefined();
  });

  it('resolves the span category, with the lane as the fallback', () => {
    const lanes = layoutTimeline<Booking>({
      resources: [{ id: 'r1', label: 'Room 1', categoryId: 'standard' }],
      categories: [
        { id: 'standard', label: 'Standard', color: '#123456' },
        { id: 'suite', label: 'Suite', color: '#654321' }
      ],
      items: [
        { id: 'inherit', room: 'r1', from: '2026-06-15', to: '2026-06-15' },
        { id: 'own', room: 'r1', from: '2026-06-17', to: '2026-06-17' }
      ],
      getResourceId: (b) => b.room,
      getRange: (b) => ({ start: b.from, end: b.to }),
      getId: (b) => b.id,
      getCategoryId: (b) => (b.id === 'own' ? 'suite' : undefined),
      window: week
    });
    const byId = Object.fromEntries(lanes[0].spans.map((s) => [s.id, s.category?.id]));
    expect(byId).toEqual({ inherit: 'standard', own: 'suite' });
  });

  it('falls back to a stable generated id when getId is absent', () => {
    const lanes = layoutTimeline<Booking>({
      resources: rooms,
      items: [{ id: 'x', room: 'r1', from: '2026-06-16', to: '2026-06-16' }],
      getResourceId: (b) => b.room,
      getRange: (b) => ({ start: b.from, end: b.to }),
      window: week
    });
    expect(lanes[0].spans[0].id).toBe('r1@2026-06-16#0');
  });
});
