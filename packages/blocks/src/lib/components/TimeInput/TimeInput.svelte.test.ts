// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
