import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type {
  DateRange,
  PlannerCellContext,
  PlannerDayContext,
  PlannerHeaderContext,
  PlannerView
} from './planner.types';
import type { PlannerCellState, PlannerSlots, PlannerVariants } from './planner.variants';

/**
 * @summary A date grid whose cells hold your content — meals, shifts, bookings, slots.
 * @description Date-indexed planning board — a week, month or custom-range grid
 * whose cells hold YOUR domain content (meals, shifts, bookings, content slots)
 * via a generic `cell` snippet. Buckets `items` by calendar day, then handles
 * navigation, ISO week numbers, keyboard a11y and a responsive column→stack
 * layout. For timed appointments, multi-day spans or recurrence use `Calendar`
 * instead.
 *
 * @tag display
 * @tag layout
 * @related Calendar
 * @related ResourceTimeline
 * @related DatePicker
 * @stability beta
 *
 * @example Weekly meal plan — `items` are bucketed by `getDate`, rendered by `cell`
 * ```svelte
 * <Planner view="week" items={entries} getDate={(e) => e.date}
 *          sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
 *          bind:value={referenceDate} onNavigate={(_, range) => loadWeek(range.start)}>
 *   {#snippet cell({ items, isoDate })}
 *     {#each items as entry (entry.id)}
 *       <MealCard {entry} />
 *     {/each}
 *     <Button variant="ghost" size="sm" onclick={() => openAdd(isoDate)}>Add meal</Button>
 *   {/snippet}
 * </Planner>
 * ```
 */
export interface PlannerProps<T = unknown>
  extends Omit<PlannerVariants, 'view' | keyof PlannerCellState>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // ── Content / Data ───────────────────────────────────
  /** The items to lay out. Each is bucketed onto a day via {@link getDate}. */
  items?: T[];
  /**
   * Map an item to its calendar day. Return a `Date`, or a local date string
   * (`'2026-06-16'`) taken verbatim — never UTC-parsed, so a plain date never
   * shifts across timezones. A date-*time* string is bucketed by its written
   * date part too; if your value is a UTC instant whose local day matters
   * (`'…T23:00:00Z'`), return `new Date(value)` so the local timezone applies.
   * Required.
   */
  getDate: (item: T) => Date | string;
  /** Comparator for items within a day cell (e.g. by meal type or start label). */
  sort?: (a: T, b: T) => number;

  // ── View ─────────────────────────────────────────────
  /** Layout mode. @default 'week' */
  view?: PlannerView;
  /** Start of the window for `view="range"`. */
  rangeStart?: Date;
  /** End of the window for `view="range"`. */
  rangeEnd?: Date;
  /** First day of the week (0=Sun … 6=Sat). @default 1 */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * BCP 47 locale tag for date formatting — month names, weekday names and the
   * header title. Defaults to `'auto'`, which follows the active
   * `<I18nProvider>` locale, so an app that already declares its language does
   * not have to repeat it here. SSR-safe: the locale comes from context, so the
   * server and the client resolve the same tag (`Intl` with `undefined` would
   * follow the runtime and disagree across hydration). Falls back to the base
   * locale (`en`) when no provider is mounted. Pass an explicit tag
   * (e.g. `'de-DE'`, `'ja-JP'`) to override.
   * @default 'auto'
   * @summary Which language the month and weekday names are rendered in.
   */
  locale?: string;
  /** Show the ISO week-number column on the left. @default false */
  showWeekNumbers?: boolean;
  /**
   * Renamed to `showWeekNumbers` for parity with `Calendar`, which has carried
   * the plural since long before Planner existed. Still honoured, and warns in DEV.
   * @deprecated Use `showWeekNumbers`.
   * @summary Deprecated spelling of `showWeekNumbers`.
   */
  showWeekNumber?: boolean;

  // ── Constraints ──────────────────────────────────────
  /** Earliest navigable/selectable date. */
  minDate?: Date;
  /** Latest navigable/selectable date. */
  maxDate?: Date;
  /** Specific dates that cannot be selected. */
  disabledDates?: Date[];
  /** Predicate for dates that cannot be selected, on top of `minDate`/`maxDate`. */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * Always render 6 week rows in `view="month"`, so the grid keeps its height
   * across months of 4, 5 and 6 rows. Ignored in `week`/`range`.
   * @default false
   */
  fixedWeeks?: boolean;

  // ── State ────────────────────────────────────────────
  /** Reference date the view is anchored on. Supports `bind:value`. @default today */
  value?: Date;
  /** The active highlighted day. Supports `bind:selectedDate`. */
  selectedDate?: Date;

  // ── Variants ─────────────────────────────────────────
  /** Visual treatment. @default 'default' */
  variant?: 'default' | 'bordered' | 'ghost';
  /** Density of the grid and header. @default 'md' */
  size?: 'sm' | 'md' | 'lg';

  // ── Behavior ─────────────────────────────────────────
  /** Visually mark today's cell. @default true */
  highlightToday?: boolean;
  /** Tint Saturday/Sunday cells. @default false */
  highlightWeekend?: boolean;
  /** Enable horizontal swipe-to-navigate on touch. @default true */
  swipeable?: boolean;
  /** Slide-transition the grid on navigate (respects reduced-motion). @default true */
  animated?: boolean;
  /** Disable navigation and selection. @default false */
  disabled?: boolean;

  // ── Callbacks ────────────────────────────────────────
  /** Fires after navigation. Receives the new reference date and visible range — load data here. */
  onNavigate?: (date: Date, range: DateRange) => void;
  /** Fires when a day cell is activated (click / Enter / Space). */
  onDateSelect?: (date: Date) => void;

  // ── Snippets ─────────────────────────────────────────
  /** Replace the default toolbar (prev/next/today/title/week). */
  header?: Snippet<[PlannerHeaderContext]>;
  /** Customise each weekday/column header. */
  dayHeader?: Snippet<[PlannerDayContext]>;
  /**
   * Render a day's content — the core of the API. Receives bucketed `items: T[]`.
   * Called for **every** day, including empty ones (`items: []`) — unless an
   * `empty` snippet is given, which then handles empty days instead. Put an
   * "add" affordance here to keep it available on empty days.
   */
  cell?: Snippet<[PlannerCellContext<T>]>;
  /**
   * Placeholder rendered **instead of** `cell` for days with no items. Omit it
   * to let `cell` render empty days too.
   */
  empty?: Snippet<[PlannerCellContext<T>]>;

  // ── Styling / a11y ───────────────────────────────────
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. Reaches the header's today-button tooltip. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv() styles. Slots: base | header | headerTitle | nav | navButton | grid | weekdayHeader | weekday | weekNumber | week | cell | cellHeader | cellWeekday | cellDate | cellItems | empty */
  slotClasses?: Partial<Record<PlannerSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ Planner: {...} }}>`. */
  preset?: string;
}

export { default as Planner } from './Planner.svelte';
export { default as PlannerHeader } from './PlannerHeader.svelte';
export { bucketItemsByDate, type GetItemDate, toDateKey } from './planner.bucket';
export type {
  // Shared date-surface vocabulary, defined in internal/date-grid and
  // re-exported by every surface that speaks it (#191).
  DateRange,
  PlannerCellContext,
  PlannerDayContext,
  PlannerHeaderContext,
  PlannerSlotName,
  PlannerView
} from './planner.types';
export { type PlannerVariants, plannerVariants } from './planner.variants';
