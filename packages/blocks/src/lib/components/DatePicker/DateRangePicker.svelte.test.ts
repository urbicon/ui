// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DateRange } from '.';
import DateRangePickerHarness from './__fixtures__/DateRangePickerHarness.svelte';

// Interaction layer for DateRangePicker — the range-specific paths its sibling
// DatePicker can't exercise. The two pickers mirror ~90% of their state-machine
// (comment on both files), so the shared input/commit/dismiss wiring is covered
// once in DatePicker.svelte.test.ts; here we assert what makes a *range* picker
// different, plus a thin regression layer over the mirrored mechanics (a copy-paste
// drift between the two files would only be caught by a DateRangePicker test):
//
//   • the two-click calendar contract — the first click sets an in-progress
//     `{ start: X, end: X }` visible ONLY through bind:value and withholds
//     onValueChange; the second completes the range, fires once, and closes;
//   • range text parsing (en-dash round-trip, inverted-range rejection) and the
//     rangesEqual guard against duplicate commits;
//   • the paired `{name}_start` / `{name}_end` hidden inputs and the range placeholder.
//
// The engine's parse/format (parseDateRangeInput, formatDateRangeInput) is unit-
// tested in datepicker.engine.test.ts; here we assert the component glue only.
//
// Mounted through a harness that binds `value` and projects it onto
// data-start / data-end, because the in-progress range is — by design — not
// reported via onValueChange. Same stack as the Combobox pilot: svelte's own
// mount/unmount, @testing-library/dom + user-event, native matchers. The calendar
// renders in a native popover with no top layer in jsdom, so day buttons are
// reached by their deterministic `data-date="YYYY-MM-DD"` attribute.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

// These tests assert German display masks (DD.MM.YYYY) and month names, so they pass `locale`
// explicitly. Until 2026-07-31 they relied on the component default being the literal `'de-DE'`;
// that default now follows the i18n provider and falls back to `en`, so the expectation has to be
// stated rather than inherited. Pinning it here also keeps these tests about what they are for
// (mask parsing / anchor logic), independent of whatever the default becomes next.
function renderPicker(props: Partial<ComponentProps<typeof DateRangePickerHarness>> = {}) {
  const instance = mount(DateRangePickerHarness, {
    target: document.body,
    props: { locale: 'de-DE', ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const day = (isoDate: string) => document.querySelector<HTMLElement>(`[data-date="${isoDate}"]`);
const rangeState = () => screen.getByTestId('range-state');

// Local YYYY-MM-DD, matching the calendar's data-date stamps, so committed Date
// objects can be asserted without timezone drift.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function pickDay(user: ReturnType<typeof userEvent.setup>, isoDate: string) {
  const cell = day(isoDate);
  expect(cell, `calendar cell ${isoDate} should be rendered`).not.toBeNull();
  await user.click(cell as HTMLElement);
  flushSync();
}

const RANGE = () => ({ start: new Date(2026, 2, 10), end: new Date(2026, 2, 20) });

describe('DateRangePicker (component interaction)', () => {
  it('renders the bound range with the locale mask and en-dash separator (de-DE)', () => {
    renderPicker({ value: { start: new Date(2026, 2, 15), end: new Date(2026, 2, 20) } });
    // formatDateRangeInput joins the two halves with " – " (spaced en-dash).
    expect(input().value).toBe('15.03.2026 – 20.03.2026');
  });

  it('shows the range placeholder when empty', () => {
    renderPicker({});
    expect(input().getAttribute('placeholder')).toBe('Select a date range...');
  });

  it('parses a typed range string on blur and fires onValueChange once', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '10.03.2026 – 20.03.2026' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const range = onValueChange.mock.calls[0][0] as DateRange;
    expect(iso(range.start)).toBe('2026-03-10');
    expect(iso(range.end)).toBe('2026-03-20');
  });

  it('commits a single typed date (no separator) as a single-day range that fires onValueChange', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    // A lone date with no range separator parses to { start: d, end: d }. This is the
    // one place the typed and calendar paths diverge: the calendar's first click also
    // produces start === end but *withholds* onValueChange (mid-selection), whereas a
    // typed single date is a complete, deliberate entry — commitDraft fires for it.
    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '15.03.2026' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const range = onValueChange.mock.calls[0][0] as DateRange;
    expect(iso(range.start)).toBe('2026-03-15');
    expect(iso(range.end)).toBe('2026-03-15');
  });

  it('shows the range parse error and does not commit an unparseable draft', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: 'not a range' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Invalid date range');
  });

  it('rejects an inverted range (start after end) with an error, no commit', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    const el = input();
    fireEvent.focus(el);
    // Both halves parse, but start > end → parseDateRangeInput returns null,
    // surfacing the invalid-range error rather than committing a backwards span.
    fireEvent.input(el, { target: { value: '20.03.2026 – 10.03.2026' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Invalid date range');
  });

  it('rejects a range whose end falls after maxDate (validates the end half), no commit', () => {
    const onValueChange = vi.fn();
    // maxDate sits between the two halves: the start is allowed, the end is not — so
    // this specifically guards the second clause of commitDraft's dual isDateAllowed
    // check. The sibling DatePicker test covers a single out-of-range value but, by
    // construction, can never reach the end-half branch a range picker adds.
    renderPicker({ maxDate: new Date(2026, 2, 15), onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '10.03.2026 – 20.03.2026' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('outside the allowed range');
  });

  it('does not re-fire onValueChange when the typed range equals the current value', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: RANGE(), onValueChange });

    const el = input();
    fireEvent.focus(el);
    // Re-type the identical range; the rangesEqual guard must short-circuit the
    // commit so consumers don't see a no-op change.
    fireEvent.input(el, { target: { value: '10.03.2026 – 20.03.2026' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not commit a draft when focus moves to a control inside the picker', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: RANGE(), onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '11.03.2026 – 21.03.2026' } });
    // Blur into the picker's own open-calendar button → "still editing", not "done".
    fireEvent.blur(el, { relatedTarget: screen.getByRole('button', { name: 'Open calendar' }) });
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('opens the calendar popover on ArrowDown', () => {
    renderPicker({});

    expect(input().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('first calendar click sets an in-progress range (bind:value) without firing onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // No value → open on a deterministic month via defaultMonth/defaultYear.
    renderPicker({ defaultMonth: 2, defaultYear: 2026, onValueChange });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();

    await pickDay(user, '2026-03-10');

    // bind:value exposes the intermediate { start: X, end: X } …
    expect(rangeState().getAttribute('data-start')).toBe('2026-03-10');
    expect(rangeState().getAttribute('data-end')).toBe('2026-03-10');
    // … but onValueChange is withheld until the range is complete, and the popover
    // stays open for the second click.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('second calendar click completes the range, fires onValueChange once, and closes', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ defaultMonth: 2, defaultYear: 2026, onValueChange });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();

    await pickDay(user, '2026-03-10');
    await pickDay(user, '2026-03-20');

    expect(rangeState().getAttribute('data-start')).toBe('2026-03-10');
    expect(rangeState().getAttribute('data-end')).toBe('2026-03-20');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const range = onValueChange.mock.calls[0][0] as DateRange;
    expect(iso(range.start)).toBe('2026-03-10');
    expect(iso(range.end)).toBe('2026-03-20');

    // closeOnSelect (default) closes once the range is complete.
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the popover open after completing a range when closeOnSelect is false', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ defaultMonth: 2, defaultYear: 2026, onValueChange, closeOnSelect: false });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();

    await pickDay(user, '2026-03-10');
    await pickDay(user, '2026-03-20');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    // The range still completes, but the popover stays open for further picking.
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('carries both range halves in paired hidden inputs for form submission', () => {
    renderPicker({ value: RANGE(), name: 'stay' });

    const start = document.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="stay_start"]'
    );
    const end = document.querySelector<HTMLInputElement>('input[type="hidden"][name="stay_end"]');
    // valueFormat 'date' (default) → YYYY-MM-DD for each half.
    expect(start?.value).toBe('2026-03-10');
    expect(end?.value).toBe('2026-03-20');
  });

  it("serialises both hidden inputs as ISO timestamps under valueFormat='iso'", () => {
    const range = RANGE();
    renderPicker({ value: range, name: 'stay', valueFormat: 'iso' });

    const start = document.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="stay_start"]'
    );
    const end = document.querySelector<HTMLInputElement>('input[type="hidden"][name="stay_end"]');
    // Each half runs through serialize() → Date.toISOString(), in contrast to the 'date'
    // default above (bare YYYY-MM-DD per half).
    expect(start?.value).toBe(range.start.toISOString());
    expect(end?.value).toBe(range.end.toISOString());
    expect(start?.value).toContain('T');
  });

  it('clears the range via the clear button', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ value: RANGE(), onValueChange });

    await user.click(screen.getByRole('button', { name: 'Clear input' }));
    flushSync();

    expect(onValueChange).toHaveBeenCalledWith(undefined);
    expect(input().value).toBe('');
  });

  it('clears the range when the field is typed empty (commitDraft empty-branch, not the Clear button)', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: RANGE(), onValueChange });

    // An empty draft drives commitDraft's `trimmed === ''` branch — a different path from the
    // Clear button's handleClear (tested above). The bound value resets to undefined (the
    // harness projection empties) and onValueChange fires once with it.
    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '' } });
    fireEvent.blur(el);
    flushSync();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(undefined);
    expect(rangeState().getAttribute('data-start')).toBe('');
    expect(rangeState().getAttribute('data-end')).toBe('');
  });
});
