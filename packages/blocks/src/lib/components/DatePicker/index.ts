import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { MonthIndex, WeekdayIndex } from '$lib/utils/date';
import type { DateRange } from '../Calendar/calendar.types';
import type { DateFormatOptions } from './datepicker.engine';

// ─── DatePickerProps ─────────────────────────────────────────

/**
 * @description Date input with calendar popup for selecting a single date. Supports min/max constraints, disabled dates, and format customization.
 *
 * The `value` prop accepts either a `Date` or an ISO timestamp string —
 * useful when surrounding state is hydrated from JSON or a SQL driver
 * that serialises timestamps as strings. `onValueChange` always reports
 * back a `Date` (or `undefined`); use `toDateInputValue` from
 * `@urbicon-ui/blocks` to project it back into a string state.
 *
 * @tag form
 * @related DateRangePicker
 * @related Calendar
 * @related Input
 *
 * @example
 * ```svelte
 * <DatePicker
 *   bind:value={selectedDate}
 *   label="Date of birth"
 *   placeholder="Select a date"
 *   locale="en-US"
 *   clearable
 * />
 * ```
 *
 * @example ISO string state (e.g. from JSON / Drizzle timestamp)
 * ```svelte
 * <script>
 *   import { DatePicker, toDateInputValue } from '@urbicon-ui/blocks';
 *   let isoDate = $state('2026-04-22T08:00:00Z');
 * </script>
 * <DatePicker
 *   value={isoDate}
 *   onValueChange={(d) => (isoDate = toDateInputValue(d))}
 *   label="Period start"
 * />
 * ```
 *
 * @example
 * ```svelte
 * <DatePicker
 *   bind:value={deadline}
 *   label="Deadline"
 *   minDate={new Date()}
 *   maxDate={new Date(2026, 11, 31)}
 *   isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6}
 *   required
 *   error={deadlineError}
 * />
 * ```
 */
export interface DatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Currently selected date. Supports bind:value.
   * Accepts a `Date`, an ISO timestamp string, or `null` / `undefined`.
   * Internally coerced to a `Date`; the picker emits `Date` instances
   * via {@link DatePickerProps.onValueChange}. When both `bind:value` and
   * `onValueChange` are wired, both fire on every user-driven change —
   * pick one to drive side-effects (saves, analytics) to avoid duplicates.
   */
  value?: Date | string | null;

  // === Display ===
  /** Label above the input. */
  label?: string;
  /** Placeholder when no date is selected. */
  placeholder?: string;
  /** Intl.DateTimeFormat options for the displayed date. */
  displayFormat?: DateFormatOptions;

  // === Validation ===
  /** Error message shown below the input. */
  error?: string;
  /** Helper text shown below the input. */
  helper?: string;
  /** Mark input as required. @default false */
  required?: boolean;

  // === Behavior ===
  /** Allow clearing the selected date. @default true */
  clearable?: boolean;
  /** Close popover after selecting a date. @default true */
  closeOnSelect?: boolean;

  // ── Dismiss behavior ─────────────────────────────────
  /** Whether the popover closes on Escape key. @default true */
  closeOnEscape?: boolean;
  /** Whether the popover closes on outside click. @default true */
  closeOnClickOutside?: boolean;
  /**
   * Fires after Escape closes the popover. Notification only — does NOT
   * govern whether close happens. That is controlled by `closeOnEscape`.
   */
  onEscape?: () => void;
  /**
   * Fires after an outside click closes the popover. Notification only —
   * does NOT govern whether close happens. That is controlled by
   * `closeOnClickOutside`.
   */
  onClickOutside?: () => void;

  // === Calendar passthrough ===
  /** BCP 47 locale for date formatting and calendar. @default 'de-DE' */
  locale?: string;
  /** First day of the week. 0 = Sunday, 1 = Monday. @default 1 */
  weekStartsOn?: WeekdayIndex;
  /** Show ISO week numbers. @default false */
  showWeekNumbers?: boolean;
  /** Show days from adjacent months. @default true */
  showOutsideDays?: boolean;
  /** Always show 6 weeks. @default false */
  fixedWeeks?: boolean;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Specific dates that are disabled. */
  disabledDates?: Date[];
  /**
   * Predicate that disables specific dates. Errors thrown by the
   * predicate are caught and logged; the date is then treated as
   * allowed so a faulty consumer callback can't take the picker down.
   */
  isDateDisabled?: (date: Date) => boolean;

  // === Variants ===
  /** Visual style of the calendar popup. @default 'default' */
  calendarVariant?: 'default' | 'bordered' | 'ghost';
  /** Input variant. @default 'outlined' */
  inputVariant?: 'outlined' | 'filled' | 'ghost' | 'underline';
  /** Component size. @default 'md' */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  // === Callbacks ===
  /** Fires when the selected date changes. */
  onValueChange?: (value: Date | undefined) => void;
  /** Fires when the popover opens or closes. */
  onOpenChange?: (open: boolean) => void;

  // === Standard ===
  /** Disable the entire picker. @default false */
  disabled?: boolean;
  /** Micro-interaction preset. */
  mint?: MintProp;
  class?: string;
  /** Default month shown when the picker opens without a value. `0`–`11`. */
  defaultMonth?: MonthIndex;
  /** Default year shown when the picker opens without a value. */
  defaultYear?: number;

  // === Form integration ===
  /**
   * Shared `name` for native form submission. When set, a hidden input
   * is rendered carrying the serialized date — matching what the user
   * picked, so the visible input's locale-formatted display string is
   * never submitted instead.
   *
   * Empty / unset values submit as `""` so the field still appears in
   * the FormData payload.
   */
  name?: string;

  /**
   * Format used to serialise the date for the hidden form input.
   * - `'date'` (default): `YYYY-MM-DD` in the local timezone — matches
   *   the native `<input type="date">` payload and Zod schemas like
   *   `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(v))`.
   * - `'iso'`: full ISO-8601 with `Z` suffix (UTC). Use this when the
   *   downstream schema expects a parseable timestamp string (e.g. a
   *   Drizzle `timestamp({ withTimezone: true, mode: 'date' })` column).
   *
   * Only relevant when {@link DatePickerProps.name} is set.
   * @default 'date'
   */
  valueFormat?: 'date' | 'iso';
}

// ─── DateRangePickerProps ────────────────────────────────────

/**
 * @description Date range input with dual-calendar popup for selecting start and end dates.
 *
 * @tag form
 * @related DatePicker
 * @related Calendar
 */
export interface DateRangePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Currently selected date range. Supports bind:value. */
  value?: DateRange;

  // === Display ===
  /** Label above the input. */
  label?: string;
  /** Placeholder when no range is selected. */
  placeholder?: string;
  /** Intl.DateTimeFormat options for displayed dates. */
  displayFormat?: DateFormatOptions;

  // === Validation ===
  error?: string;
  helper?: string;
  required?: boolean;

  // === Behavior ===
  clearable?: boolean;
  /** Close popover after selecting both dates. @default true */
  closeOnSelect?: boolean;

  // ── Dismiss behavior ─────────────────────────────────
  /** Whether the popover closes on Escape key. @default true */
  closeOnEscape?: boolean;
  /** Whether the popover closes on outside click. @default true */
  closeOnClickOutside?: boolean;
  /** Notification only — does NOT govern close behavior. */
  onEscape?: () => void;
  /** Notification only — does NOT govern close behavior. */
  onClickOutside?: () => void;

  // === Calendar passthrough ===
  locale?: string;
  weekStartsOn?: WeekdayIndex;
  showWeekNumbers?: boolean;
  showOutsideDays?: boolean;
  fixedWeeks?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  /**
   * Predicate that disables specific dates. Throws are caught and logged;
   * the date is then treated as allowed.
   */
  isDateDisabled?: (date: Date) => boolean;

  // === Variants ===
  calendarVariant?: 'default' | 'bordered' | 'ghost';
  inputVariant?: 'outlined' | 'filled' | 'ghost' | 'underline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  // === Callbacks ===
  /**
   * Fires when the selected range changes. During calendar selection
   * the user clicks twice — once to set the start, once to set the
   * end. `onValueChange` only fires when the range is *complete*
   * (start ≠ end); the intermediate `{ start: d, end: d }` state
   * does NOT fire this callback. Use `bind:value` if you need the
   * in-progress state.
   */
  onValueChange?: (value: DateRange | undefined) => void;
  onOpenChange?: (open: boolean) => void;

  // === Standard ===
  disabled?: boolean;
  mint?: MintProp;
  class?: string;
  /** Default month shown when the picker opens without a value. `0`–`11`. */
  defaultMonth?: MonthIndex;
  /** Default year shown when the picker opens without a value. */
  defaultYear?: number;

  // === Form integration ===
  /**
   * Shared base `name` for native form submission. When set, two hidden
   * inputs are rendered — `{name}_start` and `{name}_end` — each
   * carrying the serialized date, so the visible input's locale-formatted
   * display string is never submitted instead.
   *
   * Empty range submits both halves as `""`. The `_start` / `_end`
   * convention reflects the picker's domain language — date ranges read
   * naturally as start/end rather than min/max.
   */
  name?: string;

  /**
   * Format used to serialise both range halves. See
   * {@link DatePickerProps.valueFormat} for semantics.
   * @default 'date'
   */
  valueFormat?: 'date' | 'iso';
}

// ─── Preset type ─────────────────────────────────────────────

export interface DatePickerPreset {
  label: string;
  value: Date;
}

export interface DateRangePreset {
  label: string;
  value: DateRange;
}

// ─── Re-exports ──────────────────────────────────────────────

export type { DateRange } from '../Calendar/calendar.types';
export { default as DatePicker } from './DatePicker.svelte';
export { default as DateRangePicker } from './DateRangePicker.svelte';
export type { DateFormatOptions } from './datepicker.engine';
