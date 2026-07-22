// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, type Snippet, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SplitPaneHarness from './__fixtures__/SplitPaneHarness.svelte';
import type { SplitPaneProps } from './index';
import SplitPane from './SplitPane.svelte';

// Interaction layer for SplitPane — the ARIA "window splitter" contract:
// role/aria wiring (including the aria-orientation inversion — the SEPARATOR is
// perpendicular to the layout), the keyboard resize paths (±2% / ±10% / Home /
// End / Enter-collapse), double-click reset, the pointer-drag path (driven by a
// mocked container rect, the Slider role model's one gap in jsdom), and the
// two-way `bind:ratio` propagation.
//
// House stack: svelte's own mount/unmount, @testing-library/dom + user-event,
// native vitest matchers. Pointer events are dispatched as plain Events with
// coordinates assigned, so no PointerEvent constructor is assumed.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const pane = (label: string): Snippet =>
  createRawSnippet(() => ({ render: () => `<div>${label}</div>` }));

function render(props: Partial<SplitPaneProps> = {}) {
  const instance = mount(SplitPane, {
    target: document.body,
    props: { start: pane('A'), end: pane('B'), ...props } as SplitPaneProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const separator = (name?: string): HTMLElement =>
  (name ? screen.getByRole('separator', { name }) : screen.getByRole('separator')) as HTMLElement;

/** Mock the root container's layout so the pointer math has a real rect. */
function mockRootRect(width: number, height: number): HTMLElement {
  const root = document.querySelector('[data-orientation]') as HTMLElement;
  root.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON() {}
    }) as DOMRect;
  return root;
}

function firePointer(el: HTMLElement, type: string, coords: Record<string, number> = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, { pointerId: 1, ...coords });
  el.dispatchEvent(ev);
  flushSync();
}

describe('SplitPane (window-splitter aria contract)', () => {
  it('exposes role/aria with the separator orientation INVERTED vs the layout (horizontal)', () => {
    render({ orientation: 'horizontal', handleLabel: 'Resize' });

    const sep = separator('Resize');
    expect(sep.getAttribute('role')).toBe('separator');
    // horizontal layout (panes side by side) → the separator is a vertical line.
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('tabindex')).toBe('0');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    expect(sep.getAttribute('aria-valuemin')).toBe('10');
    expect(sep.getAttribute('aria-valuemax')).toBe('90');

    const controls = sep.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    const firstPane = document.getElementById(controls as string);
    expect(firstPane?.textContent).toContain('A');
    expect(firstPane?.getAttribute('style')).toContain('flex: 0 0 50%');
  });

  it('inverts the separator orientation the other way for a vertical layout', () => {
    render({ orientation: 'vertical' });
    // vertical layout (stacked panes) → the separator is a horizontal line.
    expect(separator().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('derives aria-valuemin/max from percentage limits', () => {
    render({ min: '25%', max: '75%' });
    const sep = separator();
    expect(sep.getAttribute('aria-valuemin')).toBe('25');
    expect(sep.getAttribute('aria-valuemax')).toBe('75');
  });
});

describe('SplitPane (keyboard resize)', () => {
  it('steps ±2% with the on-axis Arrow keys (horizontal) and ignores the cross axis', async () => {
    const user = userEvent.setup();
    const onRatioChange = vi.fn();
    render({ onRatioChange });

    const sep = separator();
    sep.focus();

    await user.keyboard('{ArrowRight}');
    expect(sep.getAttribute('aria-valuenow')).toBe('52');
    expect(onRatioChange.mock.calls.at(-1)?.[0]).toBeCloseTo(0.52, 5);

    await user.keyboard('{ArrowLeft}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');

    // Up/Down are the cross axis in a horizontal layout → no-op.
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
  });

  it('steps ±10% when Shift is held', async () => {
    const user = userEvent.setup();
    render();

    const sep = separator();
    sep.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(sep.getAttribute('aria-valuenow')).toBe('60');
  });

  it('jumps to the min/max limits on Home/End', async () => {
    const user = userEvent.setup();
    render();

    const sep = separator();
    sep.focus();
    await user.keyboard('{End}');
    expect(sep.getAttribute('aria-valuenow')).toBe('90');
    await user.keyboard('{Home}');
    expect(sep.getAttribute('aria-valuenow')).toBe('10');
  });

  it('maps Arrow Up/Down to the vertical axis and ignores Left/Right', async () => {
    const user = userEvent.setup();
    render({ orientation: 'vertical' });

    const sep = separator();
    sep.focus();
    await user.keyboard('{ArrowDown}');
    expect(sep.getAttribute('aria-valuenow')).toBe('52');
    await user.keyboard('{ArrowUp}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    await user.keyboard('{ArrowRight}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50'); // cross axis ignored
  });

  it('toggles collapse on Enter and restores the previous ratio', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render({ collapsible: true, onCollapsedChange });

    const sep = separator();
    sep.focus();
    await user.keyboard('{Enter}');
    expect(sep.getAttribute('aria-valuenow')).toBe('0');
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[data-orientation]')?.getAttribute('data-collapsed')).toBe(
      'true'
    );

    await user.keyboard('{Enter}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
  });

  it('restores defaultRatio on Enter when not collapsible (keyboard reset)', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render({ onCollapsedChange });

    const sep = separator();
    sep.focus();
    await user.keyboard('{ArrowRight}');
    expect(sep.getAttribute('aria-valuenow')).toBe('52');
    await user.keyboard('{Enter}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });

  it('is inert to the keyboard when disabled', async () => {
    const user = userEvent.setup();
    const onRatioChange = vi.fn();
    render({ disabled: true, onRatioChange });

    const sep = separator();
    expect(sep.getAttribute('tabindex')).toBe('-1');
    expect(sep.getAttribute('aria-disabled')).toBe('true');

    sep.focus();
    await user.keyboard('{ArrowRight}');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    expect(onRatioChange).not.toHaveBeenCalled();
  });
});

describe('SplitPane (adversarial-review regressions, P1 wave)', () => {
  it('clamps an out-of-window initial ratio for display and ARIA', () => {
    render({ defaultRatio: 0.05, min: '20%' });
    const sep = separator();
    expect(sep.getAttribute('aria-valuenow')).toBe('20');
    const startPane = document.querySelector('[id$="-start"]') as HTMLElement;
    expect(startPane.style.flex).toContain('20%');
  });

  it('keeps aria-valuenow within [valuemin, valuemax] across collapse', async () => {
    const user = userEvent.setup();
    render({ collapsible: true });
    const sep = separator();
    // With collapsible, 0 is a legitimate range value.
    expect(sep.getAttribute('aria-valuemin')).toBe('0');
    sep.focus();
    await user.keyboard('{Enter}');
    const now = Number(sep.getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThanOrEqual(Number(sep.getAttribute('aria-valuemin')));
    expect(now).toBeLessThanOrEqual(Number(sep.getAttribute('aria-valuemax')));
  });

  it('reconciles collapse state with external ratio writes (stale-flag regression)', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    const instance = mount(SplitPaneHarness, {
      target: document.body,
      props: { collapsible: true, onCollapsedChange }
    });
    dispose = () => unmount(instance);
    flushSync();

    const sep = separator();
    sep.focus();
    await user.keyboard('{Enter}');
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);

    // Consumer expands via bind:ratio — the derived flag must follow…
    instance.setRatio(0.6);
    flushSync();
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
    expect(document.querySelector('[data-orientation]')?.getAttribute('data-collapsed')).toBeNull();

    // …so the next Enter collapses the VISIBLE pane instead of stale-expanding.
    await user.keyboard('{Enter}');
    expect(sep.getAttribute('aria-valuenow')).toBe('0');
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
  });
});

describe('SplitPane (pointer drag)', () => {
  it('resizes from the container rect and marks data-dragging during the drag', () => {
    const onRatioChange = vi.fn();
    render({ onRatioChange });
    mockRootRect(1000, 500);

    const sep = separator();
    firePointer(sep, 'pointerdown', { clientX: 500, clientY: 250 });
    expect(sep.getAttribute('data-dragging')).toBe('true');

    firePointer(sep, 'pointermove', { clientX: 300, clientY: 250 });
    expect(sep.getAttribute('aria-valuenow')).toBe('30');
    expect(onRatioChange.mock.calls.at(-1)?.[0]).toBeCloseTo(0.3, 5);

    firePointer(sep, 'pointerup', { clientX: 300 });
    expect(sep.hasAttribute('data-dragging')).toBe(false);
  });

  it('snaps collapsed when dragged below the collapse threshold', () => {
    const onCollapsedChange = vi.fn();
    render({ collapsible: true, collapseThreshold: 48, onCollapsedChange });
    mockRootRect(1000, 500);

    const sep = separator();
    firePointer(sep, 'pointerdown', { clientX: 500 });
    firePointer(sep, 'pointermove', { clientX: 20 }); // 20px < 48px threshold

    expect(sep.getAttribute('aria-valuenow')).toBe('0');
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[data-orientation]')?.getAttribute('data-collapsed')).toBe(
      'true'
    );
  });

  it('clamps a drag past the max limit', () => {
    render({ max: '80%' });
    mockRootRect(1000, 500);

    const sep = separator();
    firePointer(sep, 'pointerdown', { clientX: 500 });
    firePointer(sep, 'pointermove', { clientX: 950 }); // 95% → clamps to 80%
    expect(sep.getAttribute('aria-valuenow')).toBe('80');
  });
});

describe('SplitPane (reset + binding)', () => {
  it('resets to defaultRatio on double-click of the divider', () => {
    const onRatioChange = vi.fn();
    render({ ratio: 0.8, defaultRatio: 0.5, onRatioChange });

    const sep = separator();
    expect(sep.getAttribute('aria-valuenow')).toBe('80');

    sep.dispatchEvent(new Event('dblclick', { bubbles: true }));
    flushSync();

    expect(sep.getAttribute('aria-valuenow')).toBe('50');
    expect(onRatioChange).toHaveBeenLastCalledWith(0.5);
  });

  it('propagates the resized ratio back through bind:ratio', async () => {
    const user = userEvent.setup();
    const instance = mount(SplitPaneHarness, {
      target: document.body,
      props: { initialRatio: 0.5 }
    });
    dispose = () => unmount(instance);
    flushSync();

    const sep = separator();
    sep.focus();
    await user.keyboard('{ArrowRight}');

    expect(sep.getAttribute('aria-valuenow')).toBe('52');
    const outer = Number(screen.getByTestId('outer-ratio').textContent);
    expect(outer).toBeCloseTo(0.52, 5);
  });
});
