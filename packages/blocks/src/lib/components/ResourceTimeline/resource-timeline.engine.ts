/**
 * Pure lane layout for the ResourceTimeline — the headless core of layer 2c.
 *
 * Computes the visible day window, parses each item's `[start, end]` day range,
 * clips it to the window, and stacks the survivors per lane through the shared
 * first-fit packer in `internal/date-grid/pack-spans`. Svelte-free and
 * side-effect-free apart from DEV warnings, so it unit-tests without a DOM.
 *
 * Two contracts are load-bearing and easy to get wrong from the outside:
 *
 * 1. **`[start, end]` is inclusive.** `end` is a day the bar covers, not an
 *    exclusive bound. A hotel stay's last night is `checkOut − 1`.
 * 2. **Date strings are read verbatim as local days.** The parser is
 *    `Planner`'s `toDateKey` — the one place in the package that decides how a
 *    `'2026-06-16'` becomes a calendar day — piped through the strict
 *    `isoToDate`. Growing a second parser here is how two components end up
 *    disagreeing about a timezone boundary.
 */

import { addDays, daysBetween, eachDayOfRange, isoToDate, startOfWeek, stripTime } from '$lib/date';
import { packSpans } from '$lib/internal/date-grid/pack-spans';
import { toDateKey } from '../Planner/planner.bucket';
import type {
  ResourceTimelineView,
  TimelineCategory,
  TimelineGroup,
  TimelineLaneContext,
  TimelineRange,
  TimelineResource,
  TimelineSpanContext
} from './resource-timeline.types';

/** An inclusive day window (both ends are days the timeline renders). */
export interface TimelineWindow {
  start: Date;
  end: Date;
}

/**
 * The window a reference date opens.
 *
 * `week` snaps to the ISO week containing `reference`; `days` starts **at**
 * `reference` and runs `days` columns forward, so "the next 14 nights" needs no
 * separate anchor prop. Derived here rather than read off
 * `DateGridController.rangeStart/rangeEnd`: those come from `cells`, which pads
 * a range to whole weeks — exact for a Monday-anchored 14-day window, two days
 * too wide for a mid-week one.
 */
export function getTimelineWindow(
  reference: Date,
  view: ResourceTimelineView,
  days: number,
  weekStartsOn: number
): TimelineWindow {
  if (view === 'week') {
    const start = startOfWeek(reference, weekStartsOn);
    return { start, end: addDays(start, 6) };
  }
  const span = Math.max(1, Math.floor(days));
  const start = stripTime(reference);
  return { start, end: addDays(start, span - 1) };
}

/** Every day of the window, in column order. */
export function getTimelineDays(win: TimelineWindow): Date[] {
  return eachDayOfRange(win.start, win.end);
}

/**
 * Resolve one end of a {@link TimelineRange} to a local midnight `Date`.
 *
 * Returns `null` for a value no calendar day can be read out of (an invalid
 * date string, an `Invalid Date`) — read tolerant: the caller drops the item and
 * warns once, rather than throwing on consumer data.
 */
export function parseTimelineDate(raw: Date | string): Date | null {
  try {
    return isoToDate(toDateKey(raw));
  } catch {
    return null;
  }
}

/** Options for {@link layoutTimeline}. */
export interface TimelineLayoutOptions<T> {
  /** The lanes, in the order they were declared. */
  resources: readonly TimelineResource[];
  /** Group headings; lanes are re-ordered to follow this list when given. */
  groups?: readonly TimelineGroup[];
  /** The items to place. */
  items?: readonly T[];
  /** Which lane an item belongs to. */
  getResourceId: (item: T) => string;
  /** The item's inclusive day range. */
  getRange: (item: T) => TimelineRange;
  /** Stable key for an item; falls back to `resourceId@startDay#index`. */
  getId?: (item: T) => string;
  /** The item's category id; falls back to `resource.categoryId`. */
  getCategoryId?: (item: T) => string | undefined;
  /** Colour buckets, looked up by id. */
  categories?: readonly TimelineCategory[];
  /** The visible window. */
  window: TimelineWindow;
  /** Bar rows to keep per lane; the rest are counted as overflow. */
  maxRows?: number;
}

/** Ordered lanes with their packed, window-clipped spans. */
export function layoutTimeline<T>(options: TimelineLayoutOptions<T>): TimelineLaneContext<T>[] {
  const { resources, groups, items = [], getResourceId, getRange, window: win, maxRows } = options;

  const dayCount = daysBetween(win.start, win.end) + 1;
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const categoryById = new Map((options.categories ?? []).map((c) => [c.id, c]));
  const resourceById = new Map(resources.map((r) => [r.id, r]));

  // Lane order: the declared group order first, each group's lanes in resource
  // order, then every lane without a (known) group — appended rather than
  // dropped, so a typo in `groupId` costs a heading, not a room.
  const ordered: TimelineResource[] = [];
  if (groupById.size > 0) {
    for (const group of groups ?? []) {
      for (const resource of resources) if (resource.groupId === group.id) ordered.push(resource);
    }
    for (const resource of resources) {
      if (!resource.groupId || !groupById.has(resource.groupId)) ordered.push(resource);
    }
  } else {
    ordered.push(...resources);
  }

  // Bucket the items onto their lanes, parsing and clipping as we go.
  type Clipped = Omit<TimelineSpanContext<T>, 'row'> & { endCol: number };
  const byResource = new Map<string, Clipped[]>();
  let unknownResource = 0;
  let unparsable = 0;
  let inverted = 0;
  let firstUnknownId = '';

  const windowStartTime = win.start.getTime();
  const windowEndTime = win.end.getTime();

  items.forEach((item, index) => {
    const resourceId = getResourceId(item);
    const resource = resourceById.get(resourceId);
    if (!resource) {
      unknownResource++;
      if (!firstUnknownId) firstUnknownId = resourceId;
      return;
    }

    const raw = getRange(item);
    const parsedStart = parseTimelineDate(raw.start);
    const parsedEnd = parseTimelineDate(raw.end);
    if (!parsedStart || !parsedEnd) {
      unparsable++;
      return;
    }

    // Tolerate an inverted range by ordering it (write strict, read tolerant),
    // but say so in DEV — silently swapping is how a data bug survives to prod.
    let start = parsedStart;
    let end = parsedEnd;
    if (start.getTime() > end.getTime()) {
      inverted++;
      [start, end] = [end, start];
    }

    if (end.getTime() < windowStartTime || start.getTime() > windowEndTime) return;

    const startCol = Math.max(0, daysBetween(win.start, start));
    const endCol = Math.min(dayCount - 1, daysBetween(win.start, end));

    const categoryId = options.getCategoryId?.(item) ?? resource.categoryId;

    const clipped: Clipped = {
      item,
      id: options.getId?.(item) ?? `${resourceId}@${toDateKey(start)}#${index}`,
      resource,
      category: categoryId ? categoryById.get(categoryId) : undefined,
      start,
      end,
      startCol,
      spanCols: endCol - startCol + 1,
      endCol,
      isStart: start.getTime() >= windowStartTime,
      isEnd: end.getTime() <= windowEndTime,
      totalDays: daysBetween(start, end) + 1
    };

    const bucket = byResource.get(resourceId);
    if (bucket) bucket.push(clipped);
    else byResource.set(resourceId, [clipped]);
  });

  if (import.meta.env?.DEV) {
    if (unknownResource > 0) {
      console.warn(
        `[ResourceTimeline] ${unknownResource} item(s) name a resource id that is not in ` +
          `\`resources\` (first: ${JSON.stringify(firstUnknownId)}) — they are not rendered. ` +
          'Check `getResourceId` against the resource list.'
      );
    }
    if (unparsable > 0) {
      console.warn(
        `[ResourceTimeline] ${unparsable} item(s) returned a range no calendar day could be ` +
          'read from — they are not rendered. `getRange` takes a `Date` or a local ' +
          "`'YYYY-MM-DD'` string."
      );
    }
    if (inverted > 0) {
      console.warn(
        `[ResourceTimeline] ${inverted} item(s) returned a range whose end precedes its start ` +
          '— rendered with the two swapped. `getRange` is inclusive: `{ start, end }` are both ' +
          'days the bar covers (a stay ends on `checkOut − 1`).'
      );
    }
  }

  return ordered.map((resource) => {
    const spans = byResource.get(resource.id) ?? [];
    // Earliest first, longer first on a tie — a stable order so a re-render
    // cannot reshuffle the stack. Sorting here (not in the packer) keeps the
    // packer free of any one caller's notion of "important".
    spans.sort((a, b) => a.start.getTime() - b.start.getTime() || b.totalDays - a.totalDays);

    const { packed, overflow } = packSpans(
      spans,
      dayCount,
      (s) => ({ startCol: s.startCol, endCol: s.endCol }),
      maxRows
    );

    const laid: TimelineSpanContext<T>[] = packed.map(({ span, row }) => ({
      item: span.item,
      id: span.id,
      resource: span.resource,
      category: span.category,
      start: span.start,
      end: span.end,
      startCol: span.startCol,
      spanCols: span.spanCols,
      isStart: span.isStart,
      isEnd: span.isEnd,
      row,
      totalDays: span.totalDays
    }));

    return {
      resource,
      group: resource.groupId ? groupById.get(resource.groupId) : undefined,
      spans: laid,
      rows: laid.reduce((max, s) => Math.max(max, s.row + 1), 1),
      overflow
    };
  });
}
