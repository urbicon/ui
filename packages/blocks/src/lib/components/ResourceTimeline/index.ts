import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type {
  DateCategory,
  DateRange,
  ResourceTimelineView,
  TimelineCellContext,
  TimelineDayContext,
  TimelineGroup,
  TimelineGroupContext,
  TimelineHeaderContext,
  TimelineLegendContext,
  TimelineRange,
  TimelineResource,
  TimelineResourceContext,
  TimelineSpanContext
} from './resource-timeline.types';
import type { ResourceTimelineSlots, ResourceTimelineVariants } from './resource-timeline.variants';

/**
 * @summary Resources as lanes, days as columns; each item a bar.
 * @description Resource timeline: every row is a resource (a room, a chair, a
 * vehicle, a person), every column a day of a navigable window, and each item
 * a bar spanning the days it occupies, stacked when two overlap in one lane.
 * The occupancy view neither `Calendar` (timed events on a date grid) nor
 * `Planner` (one item, one day bucket) expresses.
 *
 * Three contracts decide whether your data lands where you expect:
 *
 * - **`getRange` is inclusive.** `{ start, end }` are both days the bar covers.
 *   A booking stored as check-in → check-out converts by subtracting a day:
 *   the last *night* is `checkOut − 1`. Same convention as `CalendarEvent.end`.
 * - **Local date strings are taken verbatim** — `'2026-06-16'` is never
 *   UTC-parsed, so a plain date never shifts a day west of Greenwich (the same
 *   parser `Planner.getDate` uses). Pass a `Date` when you need an instant
 *   converted to its local day.
 * - **The window is `value` + `view`.** `view="week"` snaps to the week
 *   containing `value`; `view="days"` runs `days` columns **starting at**
 *   `value`, so "the next 14 nights" needs no second anchor.
 *
 * Two departures from `Calendar`/`Planner`, both forced by the sticky resource
 * column: **navigation does not slide-animate** (a `transform` ancestor breaks
 * `position: sticky`, so there is no `animated` prop), and **there is no
 * swipe-to-navigate** (the day track already claims the horizontal gesture, the
 * one that scrolls it). Arrow keys and the header arrows do the navigating;
 * `overflow-x` sits on the track, never on the root, so a wide window never
 * scrolls the page sideways.
 *
 * Scale is honest rather than engineered: roughly 20 lanes × 30 days is
 * comfortable, and there is no virtualization in this version. Sort a longer
 * list into `groups` and page the window instead.
 *
 * @tag display
 * @tag data
 * @related Calendar
 * @related Planner
 * @stability beta
 *
 * @example Hotel occupancy — rooms as lanes, the last night is `checkOut − 1`
 * ```svelte
 * <script lang="ts">
 *   import { ResourceTimeline } from '@urbicon-ui/blocks';
 *   // `isoToDate` first: `checkOut` is a local date string, and handing it
 *   // straight to `addDays` would UTC-parse it and shift the bar a day.
 *   import { addDays, isoToDate } from '@urbicon-ui/blocks/date';
 * </script>
 *
 * <ResourceTimeline
 *   view="days"
 *   days={14}
 *   resources={rooms}
 *   items={bookings}
 *   getResourceId={(b) => b.roomId}
 *   getRange={(b) => ({ start: b.checkIn, end: addDays(isoToDate(b.checkOut), -1) })}
 *   getLabel={(b) => b.guest}
 *   onItemClick={(booking, room) => openBooking(booking, room)}
 * />
 * ```
 *
 * @example Coloured by category, with a custom bar
 * ```svelte
 * <ResourceTimeline
 *   resources={chairs}
 *   items={sessions}
 *   categories={[{ id: 'cut', label: 'Cut', color: 'oklch(0.7 0.12 250)' }]}
 *   getResourceId={(s) => s.chairId}
 *   getCategoryId={(s) => s.serviceId}
 *   getRange={(s) => ({ start: s.day, end: s.day })}
 * >
 *   {#snippet span({ item, totalDays })}
 *     <span class="truncate">{item.client} · {totalDays}d</span>
 *   {/snippet}
 * </ResourceTimeline>
 * ```
 */
export interface ResourceTimelineProps<T = unknown>
  extends ResourceTimelineVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // ── Content / Data ───────────────────────────────────
  /** The lanes, top to bottom. An empty list renders the `empty` state. */
  resources?: TimelineResource[];
  /**
   * Heading rows above the lanes carrying the matching `groupId`. Supplying
   * them re-orders the lanes to follow this list; a lane whose `groupId` names
   * no group is appended without a heading rather than dropped.
   */
  groups?: TimelineGroup[];
  /** The items to lay out as bars. */
  items?: T[];
  /** Which lane an item belongs to. An id that is in no `resources` entry drops the item (DEV warns). Required. */
  getResourceId: (item: T) => string;
  /**
   * The item's **inclusive** day range: both `start` and `end` are days the
   * bar covers. A stay ending at check-out passes `checkOut − 1`. Return
   * `Date`s, or local date strings (`'2026-06-16'`) which are read verbatim and
   * never UTC-parsed. A range whose end precedes its start is rendered with the
   * two swapped and warns in DEV. Required.
   * @summary The days the bar covers, both ends inclusive.
   */
  getRange: (item: T) => TimelineRange;
  /** Stable key for an item, used as the `{#each}` key. Defaults to resource id + start day + index. */
  getId?: (item: T) => string;
  /** The bar's text and accessible name. Without it a bar renders as a plain occupancy block. */
  getLabel?: (item: T) => string;
  /** The item's category id, looked up in `categories`. Falls back to `resource.categoryId`. */
  getCategoryId?: (item: T) => string | undefined;
  /** Colour buckets for the bars, and the legend below the grid. */
  categories?: DateCategory[];

  // ── Window ───────────────────────────────────────────
  /** `week` snaps to the week containing `value`; `days` starts at `value`. @default 'week' */
  view?: ResourceTimelineView;
  /** Column count for `view="days"`. Ignored in `week`. @default 14 */
  days?: number;
  /** Reference date the window is anchored on. Supports `bind:value`. @default today */
  value?: Date;
  /** First day of the week for `view="week"` (0=Sun … 6=Sat). @default 1 */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * BCP 47 locale tag for the weekday names and the header title. Defaults to
   * `'auto'`, which follows the active `<I18nProvider>` locale, so an app that
   * already declares its language does not repeat it here. SSR-safe: the locale
   * comes from context, so server and client resolve the same tag. Pass an
   * explicit tag (e.g. `'de-DE'`) to override.
   * @default 'auto'
   * @summary Which language the weekday names and the title are rendered in.
   */
  locale?: string;

  // ── Constraints ──────────────────────────────────────
  /** Earliest navigable date. The window clamps span-preserving, so it never collapses at the bound. */
  minDate?: Date;
  /** Latest navigable date. The window clamps span-preserving, so it never collapses at the bound. */
  maxDate?: Date;
  /** Predicate for days that cannot be activated, on top of `minDate`/`maxDate`. */
  isDateDisabled?: (date: Date) => boolean;

  // ── Variants ─────────────────────────────────────────
  /** Visual style: `default`, `bordered` (a framed grid) or `ghost` (no grid lines, pill bars). @default 'default' */
  variant?: 'default' | 'bordered' | 'ghost';
  /** Density: lane width, day-column width and bar height. @default 'md' */
  size?: 'sm' | 'md' | 'lg';

  // ── Behavior ─────────────────────────────────────────
  /**
   * Tint today's column. Visual only — `aria-current="date"` is set on today's
   * header and cells either way, so switching the highlight off never costs the
   * semantic pointer.
   * @default true
   * @summary Tint today's column. The `aria-current` pointer stays either way.
   */
  highlightToday?: boolean;
  /** Tint Saturday/Sunday columns. @default false */
  highlightWeekend?: boolean;
  /**
   * Keep the resource column pinned while the day track scrolls sideways. Turn
   * it off inside a shell that already provides its own horizontal scrolling.
   * @default true
   * @summary Pin the resource column while the day track scrolls sideways.
   */
  stickyResourceColumn?: boolean;
  /** Bar rows to render per lane; anything past it becomes a `+n` chip at the lane's right edge. Unset renders every row. */
  maxRowsPerLane?: number;
  /** Render the category legend below the grid. Ignored without `categories`. @default true */
  showLegend?: boolean;
  /** Disable navigation and cell activation. @default false */
  disabled?: boolean;

  // ── Callbacks ────────────────────────────────────────
  /** Fires after navigation with the new reference date and the visible window; load data here. */
  onNavigate?: (date: Date, range: DateRange) => void;
  /**
   * Fires when a bar is activated: a click on it, or Enter/Space on **any**
   * cell it covers (the bar overhangs those cells, so the keyboard reaches what
   * the pointer hits). Where several bars stack on one day, activating again
   * steps through them, top row first, then wraps.
   * @summary Fires when a bar is activated by click or keyboard.
   */
  onItemClick?: (item: T, resource: TimelineResource) => void;
  /**
   * Fires when a cell **no bar covers** is activated: the hook for an "add
   * booking" affordance. Activating a day inside an existing stay fires
   * `onItemClick` instead, from click or keyboard.
   * @summary Fires when a free cell is activated (the "add" hook).
   */
  onCellClick?: (resource: TimelineResource, date: Date) => void;

  // ── Snippets ─────────────────────────────────────────
  /** Replace the default toolbar (prev/title/today/next). */
  header?: Snippet<[TimelineHeaderContext]>;
  /** Customise a day column's header. */
  dayHeader?: Snippet<[TimelineDayContext]>;
  /** Customise a lane's label in the resource column. */
  resourceLabel?: Snippet<[TimelineResourceContext]>;
  /** Customise a group heading row. */
  groupLabel?: Snippet<[TimelineGroupContext]>;
  /** Render a bar's content: receives the clipped geometry and the typed item. */
  span?: Snippet<[TimelineSpanContext<T>]>;
  /** Render extra content inside every (resource, day) cell, e.g. an "add" affordance on free days. */
  cell?: Snippet<[TimelineCellContext]>;
  /** Replace the default category legend. */
  legend?: Snippet<[TimelineLegendContext]>;
  /** Replace the "no resources" message shown when `resources` is empty. */
  empty?: Snippet;

  // ── Styling / a11y ───────────────────────────────────
  /** Extra classes merged onto the root element. */
  class?: string;
  /**
   * Remove all default tv() classes; only user-provided classes apply. Note
   * that this also strips the layout's custom properties (`--rt-lane-w`,
   * `--rt-day-w`, `--rt-bar-h` …), so an unstyled timeline has to re-declare
   * them along with the look.
   * @default false
   */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv() styles. Slots: base | header | headerTitle | nav | navButton | track | dayHeaderRow | corner | dayHeader | dayHeaderWeekday | dayHeaderDate | body | groupRow | groupLabel | lane | laneHeader | laneLabel | laneDescription | dayCell | span | spanLabel | overflow | legend | legendItem | legendDot | legendLabel | empty */
  slotClasses?: Partial<Record<ResourceTimelineSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ ResourceTimeline: {...} }}>`. */
  preset?: string;
}

export { default as ResourceTimeline } from './ResourceTimeline.svelte';
export { default as ResourceTimelineHeader } from './ResourceTimelineHeader.svelte';
export {
  getTimelineDays,
  getTimelineWindow,
  layoutTimeline,
  parseTimelineDate,
  type TimelineLayoutOptions,
  type TimelineWindow
} from './resource-timeline.engine';
// `resource-timeline.keyboard` is deliberately NOT re-exported: the roving
// model is the component's own, it only makes sense against its private target
// surface, and Planner keeps its handler internal for the same reason.
export type {
  // Shared date-surface vocabulary, defined in internal/date-grid and
  // re-exported by every surface that speaks it (#191).
  DateCategory,
  DateRange,
  ResourceTimelineContext,
  ResourceTimelineSlotName,
  ResourceTimelineView,
  TimelineCellContext,
  TimelineDayContext,
  TimelineGroup,
  TimelineGroupContext,
  TimelineHeaderContext,
  TimelineLaneContext,
  TimelineLegendContext,
  TimelineRange,
  TimelineResource,
  TimelineResourceContext,
  TimelineSpanContext
} from './resource-timeline.types';
export {
  type ResourceTimelineSlots,
  type ResourceTimelineVariants,
  resourceTimelineVariants
} from './resource-timeline.variants';
