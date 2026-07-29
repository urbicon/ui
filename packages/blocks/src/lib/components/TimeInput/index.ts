import type { Snippet } from 'svelte';
import type { TimeInputSlots, TimeInputVariants } from './time-input.variants';

/**
 * @summary A time of day, one segment per field.
 * @description Segmented time-of-day field — hour / minute (/ second) cells in a
 * single unified control, with per-segment Arrow-key stepping, digit auto-advance,
 * and 12- or 24-hour display. Fills the last form-family gap (Calendar, DatePicker
 * and DateRangePicker cover dates; this covers time). The value is always a
 * canonical 24-hour `HH:MM` (or `HH:MM:SS`) string regardless of display format,
 * and `null` when empty.
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
 */
export interface TimeInputProps extends Omit<TimeInputVariants, 'error'> {
  /**
   * Current time as a canonical 24-hour `HH:MM` / `HH:MM:SS` string; `null` when
   * empty. The stored format never changes with `format`. Supports `bind:value`.
   */
  value?: string | null;
  /** Display the hour as 12-hour with an AM/PM segment. The value stays 24-hour. @default '24h' */
  format?: '12h' | '24h';
  /** Add a seconds segment. @default false */
  withSeconds?: boolean;
  /**
   * Earliest allowed time, canonical 24-hour `HH:MM`(`:SS`). Values below it are
   * clamped up on blur.
   */
  min?: string;
  /**
   * Latest allowed time, canonical 24-hour `HH:MM`(`:SS`). Values above it are
   * clamped down on blur.
   */
  max?: string;

  /** @default false */
  disabled?: boolean;
  /** @default false */
  readonly?: boolean;
  /** Adds a required asterisk to the label. @default false */
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

  /** Fires after any change with the canonical 24-hour value (or `null`). */
  onValueChange?: (value: string | null) => void;

  /** Name for a hidden input carrying the canonical value, for native form submission. */
  name?: string;

  /** Extra classes merged onto the root wrapper. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (what
   * `class` also targets) | label | field | icon | segment | separator |
   * meridiem | message.
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
