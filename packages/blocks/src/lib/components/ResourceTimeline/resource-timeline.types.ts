/**
 * Public + internal types for the ResourceTimeline component (date-grid layer 2c).
 *
 * ResourceTimeline lays a generic `T[]` out as bars on **resource lanes** across
 * a day axis — rooms × nights, chairs × sessions, staff × shifts. These types
 * describe the snippet contexts the consumer receives and the internal Svelte
 * context `ResourceTimelineHeader` reads.
 *
 * Span colours and navigable windows come from the date surfaces' shared
 * vocabulary in `internal/date-grid/date-grid.types.ts`: `DateCategory` (until
 * 2026-08-12 a shape-identical `TimelineCategory` lived here) and `DateRange`
 * (#191).
 */

import type { DateCategory, DateRange } from '$lib/internal/date-grid';
import type { ResourceTimelineSlots } from './resource-timeline.variants';

export type { DateCategory, DateRange };

/**
 * Window mode. `week` is the ISO week containing the reference date; `days` is
 * a fixed N-day window **starting at** the reference date.
 */
export type ResourceTimelineView = 'week' | 'days';

/** One lane of the timeline: a room, a chair, a vehicle, a person. */
export interface TimelineResource {
  /** Stable identity; what `getResourceId` has to return. */
  id: string;
  /** Lane label, rendered in the sticky resource column. */
  label: string;
  /** Secondary line under the label (room type, floor, capacity). */
  description?: string;
  /** Id of the {@link TimelineGroup} this lane belongs to (a house, a department). */
  groupId?: string;
  /** Fallback category for every span in this lane; a span-level id wins. */
  categoryId?: string;
  /** Mark the whole lane unavailable — its cells report `aria-disabled` and do not activate. */
  disabled?: boolean;
  /** Free-form payload the consumer's snippets can read back. */
  meta?: Record<string, unknown>;
}

/** A heading row above the lanes that carry its id in `groupId`. */
export interface TimelineGroup {
  id: string;
  label: string;
}

/**
 * The **inclusive** day range a span occupies: both `start` and `end` are days
 * the bar covers. A hotel stay converts by subtracting one day from check-out
 * (the last *night* is `checkOut − 1`); the same convention `CalendarEvent.end`
 * and `getEventDayInfo` use.
 *
 * Strings are read as local calendar days, verbatim, through the same parser
 * `Planner.getDate` uses; `'2026-06-16'` is never UTC-parsed and so never
 * shifts a day west of Greenwich.
 */
export interface TimelineRange {
  start: Date | string;
  end: Date | string;
}

/** The value the `span` snippet receives per bar. */
export interface TimelineSpanContext<T> {
  /** The consumer's item, with its real `T` type (no cast through an event shape). */
  item: T;
  /** Stable key for this span (`getId`, else the resource id + start day). */
  id: string;
  /** The lane the span sits on. */
  resource: TimelineResource;
  /** The resolved category, if `categories` and a category id matched. */
  category?: DateCategory;
  /** First day of the span (local midnight), **unclipped** — may precede the window. */
  start: Date;
  /** Last day of the span (local midnight), inclusive and **unclipped**. */
  end: Date;
  /** 0-based column of the span's first **visible** day. */
  startCol: number;
  /** Number of visible columns — the span clipped to the window. */
  spanCols: number;
  /** `false` when the bar is cut off at the left window edge. */
  isStart: boolean;
  /** `false` when the bar is cut off at the right window edge. */
  isEnd: boolean;
  /** 0-based stack row inside the lane. */
  row: number;
  /** Total days of the unclipped span (≥ 1). */
  totalDays: number;
}

/** One laid-out lane: its resource, its packed spans and the height they need. */
export interface TimelineLaneContext<T> {
  /** The lane's resource. */
  resource: TimelineResource;
  /** The group this lane belongs to, when `groups` declared one. */
  group?: TimelineGroup;
  /** Spans visible in the current window, clipped and stacked. */
  spans: TimelineSpanContext<T>[];
  /** Lane height in bar rows — at least 1, at most `maxRowsPerLane`. */
  rows: number;
  /** Spans dropped because they landed past `maxRowsPerLane`. */
  overflow: number;
}

/** Per-column context for the `dayHeader` snippet. */
export interface TimelineDayContext {
  /** The column's date (local midnight). */
  date: Date;
  /** `YYYY-MM-DD` local key for this date. */
  isoDate: string;
  /** 0-based column index inside the window. */
  index: number;
  /** Whether this column is today. */
  isToday: boolean;
  /** Whether this column is a Saturday or Sunday. */
  isWeekend: boolean;
  /** Whether the whole column is blocked by `minDate`/`maxDate`/`isDateDisabled`/`disabled`. */
  isDisabled: boolean;
  /** Localized short weekday name (e.g. "Mo"). */
  weekday: string;
  /** ISO 8601 week number of this date. */
  weekNumber: number;
}

/** Per-cell context for the `cell` snippet — one (resource, day) intersection. */
export interface TimelineCellContext {
  /** The lane's resource. */
  resource: TimelineResource;
  /** The cell's date (local midnight). */
  date: Date;
  /** `YYYY-MM-DD` local key for this date. */
  isoDate: string;
  /** Whether this cell's day is today. */
  isToday: boolean;
  /** Whether this cell's day is a Saturday or Sunday. */
  isWeekend: boolean;
  /** Whether this cell cannot be activated (date bounds, predicate, `resource.disabled`, or the whole grid). */
  isDisabled: boolean;
  /** Whether any span covers this cell. */
  isOccupied: boolean;
}

/** Context for the `header` snippet — everything to build a custom toolbar. Same shape as `PlannerHeaderContext`, deliberately. */
export interface TimelineHeaderContext {
  /** Localized title for the current window. */
  title: string;
  /** First day of the window. */
  rangeStart: Date;
  /** Last day of the window (inclusive). */
  rangeEnd: Date;
  /** ISO week number of the reference date. */
  weekNumber: number;
  /** The active window mode. */
  view: ResourceTimelineView;
  /** Step the window by `delta` (− back, + forward). */
  navigate: (delta: number) => void;
  /** Jump to the window containing today. */
  goToToday: () => void;
  /** Jump to the window containing `date`. */
  goTo: (date: Date) => void;
  /** Whether back-navigation is within bounds. */
  canGoBack: boolean;
  /** Whether forward-navigation is within bounds. */
  canGoForward: boolean;
  /** Whether today is within `[minDate, maxDate]`; gate a custom Today control on it. */
  canGoToToday: boolean;
}

/** Context for the `legend` snippet. */
export interface TimelineLegendContext {
  categories: DateCategory[];
}

/** Context for the `groupLabel` snippet. */
export interface TimelineGroupContext {
  group: TimelineGroup;
  resources: TimelineResource[];
}

/** Context for the `resourceLabel` snippet. */
export interface TimelineResourceContext {
  resource: TimelineResource;
}

/**
 * Every styleable slot ResourceTimeline exposes through `slotClasses`.
 *
 * Derived from the tv() config rather than hand-listed: a second copy of the
 * list could disagree with it silently — a slot added to tv() and forgotten
 * here makes `slot('newSlot')` a type error, one removed leaves a phantom name
 * in the public type. `resource-timeline.variants.ts` imports nothing from this
 * module, so the direction is one-way and there is no cycle.
 */
export type ResourceTimelineSlotName = ResourceTimelineSlots;

/**
 * The reactive surface ResourceTimeline shares with `ResourceTimelineHeader`
 * through context. Mechanics come from the shared `DateGridController`; the
 * `slot` helper resolves a slot's classes against `unstyled` + `slotClasses`.
 */
export interface ResourceTimelineContext {
  readonly view: ResourceTimelineView;
  readonly title: string;
  readonly rangeStart: Date;
  readonly rangeEnd: Date;
  readonly weekNumber: number;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly canGoToToday: boolean;
  readonly locale: string;
  readonly disabled: boolean;
  /** Whether the instance (or the provider) asked for bare markup. */
  readonly unstyled: boolean;
  navigate(delta: number): void;
  goToToday(): void;
  goTo(date: Date): void;
  /**
   * Resolve a slot's class string (honours `unstyled` + merged `slotClasses`).
   * `structural` is library-authored and folds before the consumer's entry;
   * `className` is the consumer's `class` prop and folds after it.
   */
  slot(name: ResourceTimelineSlotName, structural?: string, className?: string): string;
}
