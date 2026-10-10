// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TimeInputBindHarness from './__fixtures__/TimeInputBindHarness.svelte';
import TimeInputFormatHarness from './__fixtures__/TimeInputFormatHarness.svelte';
import type { TimeInputProps } from './index';
import TimeInput from './TimeInput.svelte';

// Interaction layer for TimeInput: segment digit entry, auto-advance, Arrow
// stepping, 12h/24h conversion, seconds, min/max clamp on blur. Same DOM stack
// as the other component tests (native mount, @testing-library/dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<TimeInputProps> = {}) {
  const instance = mount(TimeInput, { target: document.body, props: props as TimeInputProps });
  dispose = () => unmount(instance);
  flushSync();
}

const hour = () => screen.getByLabelText('Hours') as HTMLInputElement;
const minute = () => screen.getByLabelText('Minutes') as HTMLInputElement;

describe('TimeInput', () => {
  it('renders hour + minute segments and seeds them from a value', () => {
    render({ value: '09:30' });
    expect(hour().value).toBe('09');
    expect(minute().value).toBe('30');
    expect(screen.queryByLabelText('Seconds')).toBeNull();
  });

  it('adds a seconds segment when `withSeconds` is set', () => {
    render({ value: '09:30:45', withSeconds: true });
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('45');
  });

  it('builds the value from typed digits and auto-advances', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ onValueChange });
    hour().focus();
    await user.keyboard('0930');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30');
    expect(document.activeElement).toBe(minute());
  });

  it('auto-advances the hour after a single digit that cannot take a second (24h)', async () => {
    const user = userEvent.setup();
    render();
    hour().focus();
    await user.keyboard('3'); // 3x would exceed 23 -> commit "03" and advance
    expect(hour().value).toBe('03');
    expect(document.activeElement).toBe(minute());
  });

  it('rejects an out-of-range two-digit entry by keeping the last digit', async () => {
    const user = userEvent.setup();
    render();
    minute().focus();
    await user.keyboard('6'); // 6x could be 60-69 > 59 -> commit "06" and advance
    expect(minute().value).toBe('06');
  });

  it('steps the focused segment with Arrow keys and wraps', async () => {
    const user = userEvent.setup();
    render({ value: '23:30' });
    hour().focus();
    await user.keyboard('{ArrowUp}'); // 23 -> 00
    expect(hour().value).toBe('00');
    await user.keyboard('{ArrowDown}'); // 00 -> 23
    expect(hour().value).toBe('23');
  });

  it('navigates between segments with Left/Right arrows', async () => {
    const user = userEvent.setup();
    render({ value: '10:20' });
    hour().focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(minute());
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(hour());
  });

  it('backspace clears a segment then walks to the previous', async () => {
    const user = userEvent.setup();
    render({ value: '10:20' });
    minute().focus();
    await user.keyboard('{Backspace}');
    expect(minute().value).toBe('');
    await user.keyboard('{Backspace}');
    expect(document.activeElement).toBe(hour());
  });

  it('converts 12-hour entry with a meridiem toggle to a 24-hour value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ format: '12h', onValueChange });
    hour().focus();
    await user.keyboard('0230'); // 02:30
    const meridiem = screen.getByRole('spinbutton', { name: 'AM or PM' });
    expect(meridiem.textContent?.trim()).toBe('AM');
    await user.click(meridiem); // -> PM => 14:30
    expect(onValueChange).toHaveBeenLastCalledWith('14:30');
  });

  it('announces the meridiem state via spinbutton value semantics', async () => {
    const user = userEvent.setup();
    render({ format: '12h', value: '14:30' });
    const meridiem = screen.getByRole('spinbutton', { name: 'AM or PM' });
    // The current AM/PM state must live in aria-valuetext — an aria-label on a
    // button used to override the content, leaving the state unannounced.
    expect(meridiem.getAttribute('aria-valuetext')).toBe('PM');
    expect(meridiem.getAttribute('aria-valuenow')).toBe('1');
    meridiem.focus();
    // Enter/Space activation is hand-wired on the span host.
    await user.keyboard('{Enter}');
    expect(meridiem.getAttribute('aria-valuetext')).toBe('AM');
    await user.keyboard(' ');
    expect(meridiem.getAttribute('aria-valuetext')).toBe('PM');
  });

  it('clamps to [min, max] when focus leaves the field', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ min: '09:00', max: '17:00', onValueChange });
    hour().focus();
    await user.keyboard('0730'); // 07:30 -> below min
    await user.tab(); // leave the field
    expect(onValueChange).toHaveBeenLastCalledWith('09:00');
    expect(hour().value).toBe('09');
    expect(minute().value).toBe('00');
  });

  it('clamps to a bound in the field’s own shape when the bound omits the seconds', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ withSeconds: true, min: '09:00', onValueChange });
    hour().focus();
    await user.keyboard('073000');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('09:00:00');
  });

  it('does not emit while the time is incomplete', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ onValueChange });
    hour().focus();
    await user.keyboard('09'); // hour only, minute empty
    expect(onValueChange).not.toHaveBeenCalledWith(expect.stringContaining(':'));
  });

  it('exposes a hidden input carrying the canonical value', async () => {
    const user = userEvent.setup();
    render({ name: 'start', value: '08:15' });
    const hidden = document.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe('start');
    expect(hidden.value).toBe('08:15');
    void user;
  });

  it('exposes spinbutton semantics on the segments', () => {
    render({ value: '09:30' });
    const h = hour();
    expect(h.getAttribute('role')).toBe('spinbutton');
    expect(h.getAttribute('aria-valuemin')).toBe('0');
    expect(h.getAttribute('aria-valuemax')).toBe('23');
    expect(h.getAttribute('aria-valuenow')).toBe('9');
    expect(minute().getAttribute('aria-valuemax')).toBe('59');
  });

  it('re-seeds the segments when `format` flips at runtime, without corrupting the value', async () => {
    const user = userEvent.setup();
    const instance = mount(TimeInputFormatHarness, { target: document.body });
    dispose = () => unmount(instance);
    flushSync();

    // 24h: 13:30 shows as 13.
    expect(hour().value).toBe('13');
    expect(screen.queryByRole('spinbutton', { name: 'AM or PM' })).toBeNull();

    await user.click(screen.getByTestId('flip-format')); // -> 12h
    // The 24h value 13:30 must re-seed to 01:30 PM, not leave a stale "13".
    expect(hour().value).toBe('01');
    const meridiem = screen.getByRole('spinbutton', { name: 'AM or PM' });
    expect(meridiem.textContent?.trim()).toBe('PM');
    expect(screen.getByTestId('value').textContent).toBe('13:30');

    // Toggling the meridiem now must stay in range (regression: used to emit 25:30).
    await user.click(meridiem); // PM -> AM => 01:30
    expect(screen.getByTestId('value').textContent).toBe('01:30');
  });

  it('wires group + segment ARIA (labelledby, invalid, describedby)', () => {
    render({ label: 'Start time', error: 'Too early' });
    const group = screen.getByRole('group');
    const labelId = group.getAttribute('aria-labelledby');
    expect(labelId && document.getElementById(labelId)?.textContent).toBe('Start time');
    expect(hour().getAttribute('aria-invalid')).toBe('true');
    const describedBy = hour().getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe('Too early');
  });

  // Same gap as PinInput: `required` painted the label and stopped there. The
  // segments are `role="spinbutton"`, which allows `aria-required`; the
  // `role="group"` around them does not.
  it('tells assistive tech that a required field is required', () => {
    render({ required: true, withSeconds: true });
    const segments = screen.getAllByRole('spinbutton');
    expect(segments).toHaveLength(3);
    expect(segments.every((s) => s.getAttribute('aria-required') === 'true')).toBe(true);
  });

  it('says nothing about requiredness when the field is optional', () => {
    render({ withSeconds: true });
    const segments = screen.getAllByRole('spinbutton');
    expect(segments.every((s) => s.getAttribute('aria-required') === null)).toBe(true);
  });
});

// COMPONENT-API-CONVENTIONS § Common props. The rest lands on the root wrapper
// (the element `class` targets), as on PinInput, the other segmented field.
describe('TimeInput (restProps)', () => {
  const root = () => document.querySelector('[data-testid="start"]') as HTMLElement;

  it('passes an unmodelled attribute through to the root', () => {
    render({ 'data-testid': 'start', class: 'w-40', label: 'Start' });
    expect(root().contains(screen.getByRole('group'))).toBe(true);
    expect(root().contains(screen.getByText('Start'))).toBe(true);
    // `class` keeps going through the tv() pipeline next to the spread.
    expect(root().classList.contains('w-40')).toBe(true);
    expect(root().classList.length).toBeGreaterThan(1);
  });

  it('keeps id and aria-label on the elements they name', () => {
    render({ 'data-testid': 'start', id: 'start-time', 'aria-label': 'Start time' });
    expect(hour().id).toBe('start-time');
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Start time');
    expect(root().hasAttribute('id')).toBe(false);
    expect(root().hasAttribute('aria-label')).toBe(false);
  });

  it.each([
    ['24h', 3],
    ['12h', 4]
  ] as const)('appends a consumer aria-describedby on every %s segment', (format, count) => {
    render({
      format,
      error: 'Too early',
      required: true,
      withSeconds: true,
      'aria-describedby': 'outside-hint'
    });
    const segments = screen.getAllByRole('spinbutton');
    // Hours, minutes, seconds — and the AM/PM segment in 12-hour format.
    expect(segments).toHaveLength(count);
    for (const segment of segments) {
      const parts = (segment.getAttribute('aria-describedby') ?? '').split(/\s+/);
      expect(parts).toHaveLength(2);
      expect(document.getElementById(parts[0])?.textContent).toBe('Too early');
      expect(parts[1]).toBe('outside-hint');
      expect(segment.getAttribute('aria-invalid')).toBe('true');
      expect(segment.getAttribute('aria-required')).toBe('true');
    }
  });

  it('appends a consumer aria-labelledby to the field group after its own label', () => {
    render({ 'data-testid': 'start', label: 'Start', 'aria-labelledby': 'outside-label' });
    const parts = (screen.getByRole('group').getAttribute('aria-labelledby') ?? '').split(/\s+/);
    expect(parts).toHaveLength(2);
    expect(document.getElementById(parts[0])?.textContent).toBe('Start');
    expect(parts[1]).toBe('outside-label');
    expect(root().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('carries a consumer aria-labelledby alone when there is no visible label', () => {
    render({ 'aria-labelledby': 'outside-label' });
    expect(screen.getByRole('group').getAttribute('aria-labelledby')).toBe('outside-label');
  });

  it('carries a consumer aria-describedby alone when there is no message', () => {
    render({ 'aria-describedby': 'outside-hint' });
    expect(hour().getAttribute('aria-describedby')).toBe('outside-hint');
  });

  it('runs a consumer onfocusout on the root and still clamps on leave', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onfocusout = vi.fn();
    render({ min: '09:00', onValueChange, onfocusout });
    hour().focus();
    await user.keyboard('0730');
    await user.tab();
    expect(onfocusout).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith('09:00');
  });
});

function renderBound(props: Record<string, unknown> = {}) {
  const instance = mount(TimeInputBindHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}
const shown = () => screen.getByTestId('value').textContent;

// The value is derived from the segments alone: `undefined` when every segment
// is empty, `null` while at least one is typed and one is blank, a canonical
// string once the time is complete.
describe('TimeInput (three-state value)', () => {
  it('walks untouched → incomplete → complete → incomplete → empty', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ onValueChange });
    expect(onValueChange).not.toHaveBeenCalled();

    hour().focus();
    await user.keyboard('0');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await user.keyboard('9');
    await user.keyboard('30');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30');

    await user.keyboard('{Backspace}'); // minute cleared, hour still typed
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await user.keyboard('{Backspace}'); // empty minute: walk to the hour
    await user.keyboard('{Backspace}'); // hour cleared too
    expect(onValueChange).toHaveBeenLastCalledWith(undefined);

    // The provisional "3" in the minute composes 09:03 before the "0" lands.
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([
      null,
      '09:03',
      '09:30',
      null,
      undefined
    ]);
  });

  it('returns to undefined when every segment of a seeded 12-hour time is cleared', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: '14:30:15', format: '12h', withSeconds: true, onValueChange });
    (screen.getByLabelText('Seconds') as HTMLInputElement).focus();
    await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(hour().value).toBe('');
    // The AM/PM segment always holds a value, so it never keeps the field "incomplete".
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([null, undefined]);
  });

  it('binds undefined as the untouched value', () => {
    renderBound();
    expect(shown()).toBe('undefined');
    expect(hour().value).toBe('');
  });

  it('renders a consumer null as empty and writes nothing back', () => {
    const onValueChange = vi.fn();
    render({ value: null, onValueChange });
    expect(hour().value).toBe('');
    expect(minute().value).toBe('');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('leaves a bound null in place at mount', () => {
    renderBound({ initial: null });
    expect(shown()).toBe('null');
    expect(hour().value).toBe('');
  });

  it.each(['set-null', 'set-undefined'])(
    'clears a complete field when the consumer sets a nullish value (%s)',
    async (button) => {
      const user = userEvent.setup();
      renderBound({ initial: '09:30' });
      await user.click(screen.getByTestId(button));
      expect(hour().value).toBe('');
      expect(minute().value).toBe('');
    }
  );

  // "No time" arriving while focus is inside the field is the echo of the
  // field's own report; from anywhere else it is a reset. `.click()` writes the
  // value without moving focus, `user.click` moves focus to the button first.
  it.each(['set-undefined', 'set-empty'])(
    'keeps a half-typed field when "no time" is written while focus is inside it (%s)',
    async (button) => {
      const user = userEvent.setup();
      renderBound();
      hour().focus();
      await user.keyboard('09');
      expect(shown()).toBe('null');
      screen.getByTestId(button).click();
      flushSync();
      expect([hour().value, minute().value]).toEqual(['09', '']);
      await user.keyboard('15');
      expect(shown()).toBe('09:15');
    }
  );

  it.each(['set-undefined', 'set-empty'])(
    'clears a half-typed field when "no time" is written from outside (%s), and starts fresh',
    async (button) => {
      const user = userEvent.setup();
      renderBound();
      hour().focus();
      await user.keyboard('09');
      await user.click(screen.getByTestId(button));
      expect([hour().value, minute().value]).toEqual(['', '']);
      minute().focus();
      await user.keyboard('45');
      // The hour typed before the reset is gone, so the time is half-typed again.
      expect([hour().value, minute().value]).toEqual(['', '45']);
      expect(shown()).toBe('null');
    }
  );

  it('keeps a half-typed field when only withSeconds changes, focus elsewhere', async () => {
    const user = userEvent.setup();
    const instance = mount(TimeInputFormatHarness, { target: document.body });
    dispose = () => unmount(instance);
    flushSync();
    minute().focus();
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('value').textContent).toBe('null');
    await user.click(screen.getByTestId('toggle-seconds')); // focus leaves the field
    expect([hour().value, minute().value]).toEqual(['13', '']);
  });

  it('re-seeds a half-typed field from a time the consumer sets', async () => {
    const user = userEvent.setup();
    renderBound();
    hour().focus();
    await user.keyboard('09');
    await user.click(screen.getByTestId('set-time'));
    expect(hour().value).toBe('10');
    expect(minute().value).toBe('45');
  });

  it('submits an empty string for both nullish states', async () => {
    const user = userEvent.setup();
    renderBound();
    const hidden = () => document.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden().value).toBe('');
    hour().focus();
    await user.keyboard('09');
    expect(shown()).toBe('null');
    expect(hidden().value).toBe('');
    await user.keyboard('15');
    expect(hidden().value).toBe('09:15');
  });
});

// A one-way consumer writes back what it receives; one that stores "no time"
// as "" hands the field's own `null`/`undefined` back as "".
describe('TimeInput (one-way consumers)', () => {
  it('builds a time from an empty field for a consumer that stores "" for no time', async () => {
    const user = userEvent.setup();
    renderBound({ mode: 'string' });
    hour().focus();
    await user.keyboard('1030');
    expect([hour().value, minute().value]).toEqual(['10', '30']);
    expect(shown()).toBe('10:30');
  });

  it.each(['identity', 'string'])(
    'keeps the digits when a %s consumer echoes a cleared segment',
    async (mode) => {
      const user = userEvent.setup();
      renderBound({ mode, initial: '09:30' });
      minute().focus();
      await user.keyboard('{Backspace}');
      expect([hour().value, minute().value]).toEqual(['09', '']);
      await user.keyboard('15');
      expect(shown()).toBe('09:15');
    }
  );

  it('clears a half-typed field when a "" consumer is reset from outside', async () => {
    const user = userEvent.setup();
    renderBound({ mode: 'string', initial: '09:30' });
    minute().focus();
    await user.keyboard('{Backspace}');
    expect(shown()).toBe('""');
    await user.click(screen.getByTestId('set-undefined'));
    expect([hour().value, minute().value]).toEqual(['', '']);
  });
});

// A consumer `onfocusout` reaches the root through the attribute pass-through.
// focusout bubbles, so it runs on every hop between segments as well; the
// field is left only when `relatedTarget` is outside the root.
describe('TimeInput (onfocusout)', () => {
  it('fires on every hop, tells a hop from a leave, and runs after the clamp', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    renderBound({ min: '09:00', onLeave });

    hour().focus();
    await user.keyboard('07'); // auto-advance hour → minute: a hop
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave.mock.calls[0][0]).toBe(false);
    await user.keyboard('30');
    await user.tab(); // leave the field
    // The bound value the handler reads is already clamped to min.
    expect(onLeave).toHaveBeenLastCalledWith(true, '09:00');
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});

// `step` is a raster in seconds counted from `min` (or midnight), as on
// <input type="time">. The value never carries a time off it.
describe('TimeInput (step)', () => {
  const second = () => screen.getByLabelText('Seconds') as HTMLInputElement;
  const values = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([v]) => v);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('steps the minute along the raster and wraps without carrying the hour', async () => {
    const user = userEvent.setup();
    render({ value: '09:00', step: 900 });
    expect(minute().getAttribute('aria-valuemin')).toBe('0');
    expect(minute().getAttribute('aria-valuemax')).toBe('45');
    minute().focus();
    await user.keyboard('{ArrowUp}');
    expect(minute().value).toBe('15');
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect([hour().value, minute().value]).toEqual(['09', '00']);
    await user.keyboard('{ArrowDown}');
    expect([hour().value, minute().value]).toEqual(['09', '45']);
  });

  it('counts the raster from min', async () => {
    const user = userEvent.setup();
    render({ min: '09:10', step: 900 });
    expect(minute().getAttribute('aria-valuemin')).toBe('10');
    expect(minute().getAttribute('aria-valuemax')).toBe('55');
    minute().focus();
    await user.keyboard('{ArrowUp}'); // from empty: the first raster value
    expect(minute().value).toBe('10');
    await user.keyboard('{ArrowUp}');
    expect(minute().value).toBe('25');
  });

  it('snaps a typed off-raster minute down once it is complete, and never reports it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ step: 900, onValueChange });
    hour().focus();
    await user.keyboard('0907');
    expect(minute().value).toBe('00');
    expect(values(onValueChange)).toEqual([null, '09:00']);
  });

  it('reports null while a mid-entry digit is off the raster, and snaps it on blur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ step: 900, onValueChange });
    hour().focus();
    await user.keyboard('094'); // "4" may still become 45
    expect(minute().value).toBe('4');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await user.tab();
    expect(minute().value).toBe('00');
    expect(values(onValueChange)).toEqual([null, '09:00']);
  });

  it('reports null for a mid-entry minute off a raster counted from min', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ min: '09:10', step: 900, onValueChange });
    hour().focus();
    await user.keyboard('235'); // "5" may still become 55
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await user.keyboard('5');
    expect(onValueChange).toHaveBeenLastCalledWith('23:55');
    // The raster counts from min, so a whole hour is not on it.
    hour().focus();
    await user.keyboard('1000');
    expect(onValueChange).toHaveBeenLastCalledWith('09:55');
  });

  it('shows a time it was given in a fixed segment until blur snaps it', async () => {
    const user = userEvent.setup();
    renderBound({ step: 3600, initial: '09:20' });
    expect([hour().value, minute().value]).toEqual(['09', '20']);
    hour().focus();
    await user.tab();
    expect(shown()).toBe('09:00');
    expect(minute().value).toBe('00');
  });

  it('shows given seconds in a fixed seconds segment', () => {
    render({ value: '09:30:15', withSeconds: true, step: 60 });
    expect(second().value).toBe('15');
  });

  it('moves an off-raster time to the raster point above or below it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: '10:00', min: '08:00', step: 2700, onValueChange });
    minute().focus();
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenLastCalledWith('10:15');
    dispose?.();
    document.body.replaceChildren();
    render({ value: '10:00', min: '08:00', step: 2700, onValueChange });
    minute().focus();
    await user.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30');
  });

  it('names the raster values of the displayed time, and steps seconds off it upwards', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: '09:30:00', withSeconds: true, step: 7, onValueChange });
    // 09:30:00 is 34200 s, 5 past a multiple of 7, so this minute's points are :02 … :58.
    expect(second().getAttribute('aria-valuemin')).toBe('2');
    expect(second().getAttribute('aria-valuemax')).toBe('58');
    second().focus();
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30:02');
  });

  it('lets Left/Right leave a fixed segment focused by pointer', async () => {
    const user = userEvent.setup();
    render({ value: '09:00', format: '12h', step: 3600 });
    const meridiem = screen.getByRole('spinbutton', { name: 'AM or PM' });
    minute().focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(meridiem);
    minute().focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(hour());
  });

  it('clamps onto the raster: up to min, down to the last point under max', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ min: '09:10', max: '17:00', step: 900, onValueChange });
    hour().focus();
    await user.keyboard('1750');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('16:55');
    hour().focus();
    await user.keyboard('0800');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('09:10');
    expect([hour().value, minute().value]).toEqual(['09', '10']);
  });

  it('fixes the minute under an hourly raster and completes the time from the hour', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ step: 3600, min: '08:30', onValueChange });
    expect(minute().value).toBe('');
    expect(minute().readOnly).toBe(true);
    expect(minute().tabIndex).toBe(-1);
    expect(minute().getAttribute('aria-valuemin')).toBe('30');
    expect(minute().getAttribute('aria-valuemax')).toBe('30');
    hour().focus();
    await user.keyboard('09');
    expect(minute().value).toBe('30');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30');
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenLastCalledWith('10:30');
    await user.keyboard('{Backspace}');
    expect(minute().value).toBe('');
    // The hour is the only typed segment, so its mid-entry "0" is already a time.
    expect(values(onValueChange)).toEqual(['00:30', '09:30', '10:30', undefined]);
  });

  it('steps the seconds by a sub-minute raster with withSeconds', async () => {
    const user = userEvent.setup();
    render({ value: '09:30:00', withSeconds: true, step: 15 });
    expect(second().getAttribute('aria-valuemax')).toBe('45');
    expect(minute().getAttribute('aria-valuemax')).toBe('59');
    second().focus();
    await user.keyboard('{ArrowUp}');
    expect(second().value).toBe('15');
    minute().focus();
    await user.keyboard('{ArrowUp}');
    expect(minute().value).toBe('31');
  });

  it('fixes the seconds under a whole-minute raster with withSeconds', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ withSeconds: true, step: 60, onValueChange });
    expect(second().readOnly).toBe(true);
    hour().focus();
    await user.keyboard('0930');
    expect(second().value).toBe('00');
    expect(onValueChange).toHaveBeenLastCalledWith('09:30:00');
  });

  it('keeps only the whole-minute points of a step without seconds', async () => {
    const user = userEvent.setup();
    render({ value: '09:00', step: 90 });
    expect(minute().getAttribute('aria-valuemax')).toBe('57');
    minute().focus();
    await user.keyboard('{ArrowUp}');
    expect(minute().value).toBe('03');
  });

  it('ignores a step that is not a positive whole number, and says so in dev', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ value: '09:00', step: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    minute().focus();
    await user.keyboard('{ArrowUp}');
    expect(minute().value).toBe('01');
  });
});
