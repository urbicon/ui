// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TabHarness from './__fixtures__/TabHarness.svelte';
import type { TabProps } from './index';

// Interaction layer for Tab — the W3C tablist pattern: roving tabindex (active
// tab is the only tab stop), automatic activation (arrow keys move selection AND
// focus together), Home/End, and orientation-gated arrows. Tab drives all of it
// through the tablist keydown handler + TabContext registration, which only a
// mounted composition exercises. TabItem/TabPanel register through context, so
// the test mounts a real composition (TabHarness) rather than a raw snippet.
//
// Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers. Panels render with
// transition={false} in the harness so the active content is synchronously in
// the DOM (no fade wrapper to await).

type Item = { value: string; label: string; disabled?: boolean };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTabs(props: Partial<TabProps> & { items?: Item[] } = {}) {
  const instance = mount(TabHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLButtonElement;
const selected = (name: string) => tab(name).getAttribute('aria-selected');
const tabIndex = (name: string) => tab(name).getAttribute('tabindex');
const activePanel = () => screen.getByRole('tabpanel');

describe('Tab (component interaction)', () => {
  it('renders a tablist whose default tab is selected and whose panel is shown', () => {
    renderTabs({ defaultValue: 'overview' });

    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(selected('Overview')).toBe('true');
    expect(selected('Settings')).toBe('false');
    expect(activePanel().textContent).toContain('Overview content');
  });

  it('selects a tab on click: aria-selected + panel switch + onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderTabs({ defaultValue: 'overview', onValueChange });

    await user.click(tab('Settings'));

    expect(selected('Settings')).toBe('true');
    expect(selected('Overview')).toBe('false');
    expect(activePanel().textContent).toContain('Settings content');
    expect(onValueChange).toHaveBeenCalledWith('settings');
  });

  it('keeps only the active tab in the tab order (roving tabindex)', () => {
    renderTabs({ defaultValue: 'settings' });

    expect(tabIndex('Settings')).toBe('0');
    expect(tabIndex('Overview')).toBe('-1');
    expect(tabIndex('Billing')).toBe('-1');
  });

  it('ArrowRight moves selection AND focus to the next tab (automatic activation)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderTabs({ defaultValue: 'overview', onValueChange });

    tab('Overview').focus();
    await user.keyboard('{ArrowRight}');

    expect(selected('Settings')).toBe('true');
    expect(document.activeElement).toBe(tab('Settings'));
    expect(tabIndex('Settings')).toBe('0');
    expect(onValueChange).toHaveBeenLastCalledWith('settings');
  });

  it('ArrowLeft from the first tab wraps to the last; Home/End jump to the ends', async () => {
    const user = userEvent.setup();
    renderTabs({ defaultValue: 'overview' });

    tab('Overview').focus();
    await user.keyboard('{ArrowLeft}');
    expect(selected('Billing')).toBe('true');
    expect(document.activeElement).toBe(tab('Billing'));

    await user.keyboard('{Home}');
    expect(selected('Overview')).toBe('true');

    await user.keyboard('{End}');
    expect(selected('Billing')).toBe('true');
  });

  it('respects vertical orientation: ArrowDown/Up navigate, ArrowRight/Left are ignored', async () => {
    const user = userEvent.setup();
    renderTabs({ defaultValue: 'overview', orientation: 'vertical' });

    tab('Overview').focus();
    await user.keyboard('{ArrowRight}');
    // Cross-axis key is a no-op in vertical orientation.
    expect(selected('Overview')).toBe('true');

    await user.keyboard('{ArrowDown}');
    expect(selected('Settings')).toBe('true');
    expect(document.activeElement).toBe(tab('Settings'));
  });

  it('skips a disabled tab during keyboard navigation', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderTabs({
      defaultValue: 'a',
      onValueChange,
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' }
      ]
    });

    tab('A').focus();
    await user.keyboard('{ArrowRight}');

    // The disabled middle tab must not become active — a disabled <button> can't
    // hold focus, so selecting it strands aria-selected on an unfocusable tab.
    // Navigation should land on C.
    expect(selected('C')).toBe('true');
    expect(selected('B')).toBe('false');
    expect(document.activeElement).toBe(tab('C'));
    expect(onValueChange).toHaveBeenLastCalledWith('c');
  });

  // Wiring, not configuration. `tabVariants({fullWidth:true}).trigger()` has
  // always returned `flex-1` — the variants test stayed green while TabContext
  // simply didn't carry the field, so TabItem never asked for it and the prop
  // was dead end to end. Only a mounted composition sees the difference.
  it('carries fullWidth through the context onto every trigger', () => {
    renderTabs({ defaultValue: 'overview', fullWidth: true });

    for (const label of ['Overview', 'Settings', 'Billing']) {
      expect(tab(label).className).toContain('flex-1');
    }
  });

  it('leaves the triggers unstretched without fullWidth', () => {
    renderTabs({ defaultValue: 'overview' });

    // Negative half of the pair: without it the assertion above would also pass
    // on a component that hard-codes `flex-1` on every trigger.
    expect(tab('Overview').className).not.toContain('flex-1');
  });
});
