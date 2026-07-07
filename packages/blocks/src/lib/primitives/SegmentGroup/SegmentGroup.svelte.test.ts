// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
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
