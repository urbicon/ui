import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { TimeInputSlots, TimeInputVariants } from './time-input.variants';

/**
 * @summary A time of day, one segment per field.
 * @description Segmented time-of-day field — hour / minute (/ second) cells in a
 * single unified control, with per-segment Arrow-key stepping, digit auto-advance,
 * and 12- or 24-hour display. Fills the last form-family gap (Calendar, DatePicker
 * and DateRangePicker cover dates; this covers time). The value has three states,
 * read off the segments alone: `undefined` while every segment is empty, `null`
 * while the time is half-typed (some segments filled, some blank), and a canonical
 * 24-hour `HH:MM` (or `HH:MM:SS`) string once it is complete, regardless of display
 * format. `step` sets a raster in seconds, as on `<input type="time">`. An
 * `onfocusout` you pass lands on the root and runs after the `min`/`max` clamp, on
 * every hop between segments too: the field was left when `relatedTarget` is outside
 * `currentTarget`.
 *
 * @tag form
 * @related DatePicker
 * @related NumberInput
 * @related Input
 * @stability beta
 *
 * @example
 * ```svelte
 * <script>
 *   let time = $state('09:30');
 * </script>
 * <TimeInput label="Start" bind:value={time} />
 * ```
 *
 * @example 12-hour display with seconds and bounds
 * ```svelte
 * <TimeInput format="12h" withSeconds min="08:00" max="18:00" bind:value={time} />
 * ```
 *
 * @example An optional quarter-hour slot: empty may submit, half-typed may not
 * ```svelte
 * <script lang="ts">
 *   // undefined while empty, null while half-typed, else a time on the raster
 *   let slot = $state<string | null>();
 * </script>
 * <TimeInput label="Slot" step={900} min="08:00" max="18:00" bind:value={slot} />
 * <button type="submit" disabled={slot === null}>Book</button>
 * ```
 */
export interface TimeInputProps
  extends Omit<TimeInputVariants, 'error'>,
    // `class`, `id` and `aria-label` are modelled below; the rest of a div's
    // attributes reach the root. `aria-describedby` and `aria-labelledby` stay in
    // and are merged rather than spread: a consumer's description joins every
    // segment's own, a consumer's label id joins the field group's.
    Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'id' | 'aria-label' | 'children'> {
  /**
   * The time as the segments spell it, in one of three states:
   * - `undefined` while every segment is empty, untouched or cleared back to empty.
   *   Leave the prop out (or bind `undefined`) for an empty field.
   * - `null` while the time is half-typed: at least one segment holds a digit and
   *   at least one is blank.
   * - A canonical 24-hour `HH:MM` / `HH:MM:SS` string once the time is complete;
   *   `format` never changes it.
   *
   * An AM/PM segment always holds a value, so it never makes a time half-typed.
   * Passing `null` or `undefined` clears a field that shows a complete time, but
   * never one the user is halfway through: a consumer that stores "no time" as one
   * value hands the field's own `null` back, and that must not wipe the digits
   * typed so far; remount the field (`{#key}`) to reset a half-typed one. A `null`
   * you pass at mount renders empty and stays `null` until the user edits.
   * Supports `bind:value`.
   */
  value?: string | null | undefined;
  /** Display the hour as 12-hour with an AM/PM segment. The value stays 24-hour. @default '24h' */
  format?: '12h' | '24h';
  /** Add a seconds segment. @default false */
  withSeconds?: boolean;
  /**
   * Raster in seconds, counted from `min` (or midnight) as on `<input type="time">`:
   * `900` is a 15-minute grid, `3600` whole hours. Unset, every minute is allowed
   * (every second with `withSeconds`).
   *
   * - The Arrow keys move a segment to its next raster value and wrap inside it
   *   without carrying into the others; `aria-valuemin`/`aria-valuemax` name the
   *   first and last raster value of each segment.
   * - A typed time off the raster snaps down to the raster point below it as soon
   *   as its segment is complete, and the value never carries the off-raster time,
   *   not even while a digit is mid-entry. A time you pass in is shown as given and
   *   lands on the raster with the next edit or on blur.
   * - A segment the raster pins to one value is shown but not typed: an hourly
   *   step fixes the minute (and second), a whole-minute step fixes the second.
   * - Without `withSeconds` only the step's whole-minute points count: `30` allows
   *   every minute, `90` every third.
   *
   * Must be a positive whole number; anything else is ignored, with a warning in dev.
   */
  step?: number;
  /**
   * Earliest allowed time, canonical 24-hour `HH:MM`(`:SS`). Values below it are
   * clamped up on blur. It is also where the `step` raster starts.
   */
  min?: string;
  /**
   * Latest allowed time, canonical 24-hour `HH:MM`(`:SS`). Values above it are
   * clamped down on blur, to the last `step` raster point at or below it.
   */
  max?: string;

  /** Blocks input and dims the whole field. @default false */
  disabled?: boolean;
  /** Shows the time but refuses edits; the segments stay focusable. @default false */
  readonly?: boolean;
  /**
   * Marks the label with an asterisk and sets `aria-required` on the segments. It does
   * not block a native submit — the value lives in component state, so validate it
   * yourself before you act on it.
   *
   * @default false
   */
  required?: boolean;
  /** Stretch the field to the full width of its container. @default false */
  fullWidth?: boolean;
  /** Show the leading clock icon. @default true */
  showIcon?: boolean;

  /** Label text displayed above the field, linked via `aria-labelledby`. */
  label?: string;
  /** Helper text below the field — hidden when `error` is present. */
  helper?: string;
  /**
   * Error message below the field. When set it overrides `helper`, colours the
   * field danger, and marks the segments `aria-invalid`.
   */
  error?: string;

  /** A custom leading icon; replaces the default clock. */
  icon?: Snippet;

  /**
   * Fires whenever the field changes the value (typing, the Arrow keys, Backspace,
   * the clamp on blur) with the canonical 24-hour string, `null` while half-typed,
   * or `undefined` once every segment is empty again. Setting `value` yourself does
   * not fire it.
   */
  onValueChange?: (value: string | null | undefined) => void;

  /**
   * Name for a hidden input carrying the canonical value, for native form
   * submission; it submits `""` while the field is empty or half-typed.
   */
  name?: string;

  /** Extra classes merged onto the root wrapper. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (what
   * `class` also targets) | label | requiredMark | field | icon | segment |
   * separator | meridiem | message.
   */
  slotClasses?: Partial<Record<TimeInputSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ TimeInput: {...} }}>`. */
  preset?: string;

  /** Accessible name for the field group when no visible `label` is set. */
  'aria-label'?: string;
  /** Root id; the segments derive their ids and ARIA wiring from it. */
  id?: string;
}

export { default as TimeInput } from './TimeInput.svelte';
export { type TimeInputVariants, timeInputVariants } from './time-input.variants';
