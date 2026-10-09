// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SegmentHarness from './__fixtures__/SegmentHarness.svelte';
import type { SegmentGroupProps } from './index';

// Interaction layer for SegmentGroup — a role=radiogroup of role=radio buttons
// with roving tabindex + automatic activation (arrows move selection AND focus).
// SegmentItem registers through context, so the test mounts a real composition
// (SegmentHarness). Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers.

type Item = { value: string; label: string; disabled?: boolean };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderSegments(props: Partial<SegmentGroupProps> & { items?: Item[] } = {}) {
  const instance = mount(SegmentHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const segment = (name: string) => screen.getByRole('radio', { name }) as HTMLButtonElement;
const checked = (name: string) => segment(name).getAttribute('aria-checked');
const tabIndex = (name: string) => segment(name).getAttribute('tabindex');

describe('SegmentGroup (component interaction)', () => {
  it('renders a radiogroup of segments with nothing selected by default', () => {
    renderSegments();

    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(checked('Day')).toBe('false');
    expect(checked('Week')).toBe('false');
  });

  it('selects a segment on click: aria-checked + onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSegments({ onValueChange });

    await user.click(segment('Week'));

    expect(checked('Week')).toBe('true');
    expect(checked('Day')).toBe('false');
    expect(onValueChange).toHaveBeenCalledWith('week');
  });

  it('keeps only the active segment in the tab order (roving tabindex)', () => {
    renderSegments({ value: 'week' });

    expect(tabIndex('Week')).toBe('0');
    expect(tabIndex('Day')).toBe('-1');
    expect(tabIndex('Month')).toBe('-1');
  });

  // With nothing selected the group must still be reachable with Tab: the first
  // enabled segment holds the tab stop (standard radiogroup entry behaviour,
  // same fallback as ButtonGroup). Guards #205 — every segment carried -1 and an
  // empty segment control was keyboard-dead.
  it('gives the first segment the tab stop when nothing is selected', () => {
    renderSegments();

    expect(tabIndex('Day')).toBe('0');
    expect(tabIndex('Week')).toBe('-1');
    expect(tabIndex('Month')).toBe('-1');
    // The fallback is a tab stop, not a selection.
    expect(checked('Day')).toBe('false');
  });

  it('skips a disabled first segment for the no-selection tab stop', () => {
    renderSegments({
      items: [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' }
      ]
    });

    expect(tabIndex('A')).toBe('-1');
    expect(tabIndex('B')).toBe('0');
    expect(tabIndex('C')).toBe('-1');
  });

  it('falls back to the first segment when value matches no item', () => {
    renderSegments({ value: 'quarter' });

    expect(tabIndex('Day')).toBe('0');
    expect(checked('Day')).toBe('false');
  });

  // The invariant behind all the tab-stop cases: whatever holds the stop must
  // be able to take focus. A disabled button cannot, so a selected-but-disabled
  // segment keeps aria-checked and hands the stop on — otherwise the group's
  // only tab stop sits on an unfocusable button and the group is keyboard-dead,
  // which is #205 reached through a selection instead of through an empty one.
  it('hands the tab stop on when the selected segment is disabled', () => {
    renderSegments({
      value: 'day',
      items: [
        { value: 'day', label: 'Day', disabled: true },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' }
      ]
    });

    // The selection is real and still announced.
    expect(checked('Day')).toBe('true');
    // But the stop sits where focus can actually land.
    expect(tabIndex('Day')).toBe('-1');
    expect(tabIndex('Week')).toBe('0');
    expect(tabIndex('Month')).toBe('-1');
  });

  // The group reads each segment's disabled state through a getter rather than
  // off the DOM, so disabling one at runtime re-runs the tab-stop derivation.
  // Read from `element.disabled` it is not a tracked dependency at all: the
  // stop stayed on the now-disabled segment and the group left the tab order.
  it('moves the tab stop when the segment holding it is disabled at runtime', async () => {
    const props = $state({
      items: [
        { value: 'day', label: 'Day', disabled: false },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' }
      ]
    });
    renderSegments(props);

    expect(tabIndex('Day')).toBe('0');

    props.items[0].disabled = true;
    await tick();

    expect(tabIndex('Day')).toBe('-1');
    expect(tabIndex('Week')).toBe('0');
  });

  it('hands the tab stop from the fallback to the selected segment', async () => {
    const user = userEvent.setup();
    renderSegments();

    expect(tabIndex('Day')).toBe('0');
    await user.click(segment('Week'));

    expect(tabIndex('Week')).toBe('0');
    expect(tabIndex('Day')).toBe('-1');
  });

  it('lets the keyboard establish a selection from the empty state', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSegments({ onValueChange });

    // Tab lands on the fallback stop; the first arrow press anchors just off
    // the leading edge (roving.ts) and selects the first enabled segment.
    segment('Day').focus();
    await user.keyboard('{ArrowRight}');

    expect(checked('Day')).toBe('true');
    expect(onValueChange).toHaveBeenCalledWith('day');
  });

  it('ArrowRight moves selection AND focus, wrapping past the end', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSegments({ value: 'day', onValueChange });

    segment('Day').focus();
    await user.keyboard('{ArrowRight}');
    expect(checked('Week')).toBe('true');
    expect(document.activeElement).toBe(segment('Week'));

    await user.keyboard('{ArrowRight}'); // → Month
    await user.keyboard('{ArrowRight}'); // wraps → Day
    expect(checked('Day')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith('day');
  });

  it('Home/End jump to the first/last segment', async () => {
    const user = userEvent.setup();
    renderSegments({ value: 'week' });

    segment('Week').focus();
    await user.keyboard('{End}');
    expect(checked('Month')).toBe('true');

    await user.keyboard('{Home}');
    expect(checked('Day')).toBe('true');
  });

  it('skips a disabled segment during keyboard navigation', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSegments({
      value: 'a',
      onValueChange,
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' }
      ]
    });

    segment('A').focus();
    await user.keyboard('{ArrowRight}');

    // The disabled middle segment is a native <button disabled> that can't hold
    // focus, so navigation must step over it to C.
    expect(checked('C')).toBe('true');
    expect(checked('B')).toBe('false');
    expect(document.activeElement).toBe(segment('C'));
    expect(onValueChange).toHaveBeenLastCalledWith('c');
  });
});

// COMPONENT-API-CONVENTIONS § restProps ordering: the group spreads restProps first, so the
// attributes it computes win, and composes a consumer onkeydown after its own roving keys.
describe('SegmentGroup (restProps-first contract)', () => {
  const group = () => screen.getByRole('radiogroup');

  it('keeps its role, orientation and collapsed state against a consumer', () => {
    renderSegments({
      ariaLabel: 'View',
      role: 'menu',
      'aria-orientation': 'vertical',
      'data-collapsed': 'true',
      'data-testid': 'views'
    });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(group().getAttribute('data-testid')).toBe('views');
    expect(group().getAttribute('aria-orientation')).toBe('horizontal');
    expect(group().hasAttribute('data-collapsed')).toBe(false);
  });

  it('a real disabled beats a consumer aria-disabled="false"; idle falls back to the consumer value', () => {
    renderSegments({ disabled: true, 'aria-disabled': 'false' });
    expect(group().getAttribute('aria-disabled')).toBe('true');

    dispose?.();
    document.body.replaceChildren();

    renderSegments({ 'aria-disabled': 'true' });
    expect(group().getAttribute('aria-disabled')).toBe('true');
  });

  it('takes an aria-label when ariaLabel is unset, and ariaLabel over it', () => {
    renderSegments({ 'aria-label': 'Native label' });
    expect(group().getAttribute('aria-label')).toBe('Native label');

    dispose?.();
    document.body.replaceChildren();

    renderSegments({ ariaLabel: 'Prop label', 'aria-label': 'Native label' });
    expect(group().getAttribute('aria-label')).toBe('Prop label');
  });

  it('runs a consumer onkeydown once, after the roving keys still move selection and focus', async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    const onValueChange = vi.fn();
    renderSegments({
      value: 'day',
      onValueChange,
      onkeydown: (event) => seen.push(event.defaultPrevented)
    });

    segment('Day').focus();
    await user.keyboard('{ArrowRight}');

    expect(checked('Week')).toBe('true');
    expect(document.activeElement).toBe(segment('Week'));
    expect(onValueChange).toHaveBeenCalledWith('week');
    // Once, and after the group had claimed the key.
    expect(seen).toEqual([true]);
  });
});
