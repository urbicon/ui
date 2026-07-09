// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SelectProps } from './index';
import Select from './Select.svelte';

// Interaction layer for Select — the focus / keyboard / open-close timing the
// variant tests deliberately can't reach. Select is the ARIA *Listbox* case:
// DOM focus stays on the `role="combobox"` trigger and a virtual cursor moves
// via `aria-activedescendant`; the listbox element never receives key events.
// That is the exact pattern most likely to regress silently (arrows that
// preventDefault but don't advance the cursor), so it earns a mounted test.
//
// Conventions match Combobox.svelte.test.ts: Svelte's own `mount`/`unmount`
// (never @testing-library/svelte — a second svelte instance breaks svelte-check),
// @testing-library/dom + user-event for queries/interaction, and vitest's native
// matchers (no jest-dom). The listbox renders in a native popover with no top
// layer in jsdom, so options are queried with `{ hidden: true }`; these tests
// assert selection *logic* (aria, callbacks, focus), not visual visibility —
// that is Playwright's job.

const OPTIONS = [
  { label: 'Germany', value: 'de' },
  { label: 'France', value: 'fr' },
  { label: 'Spain', value: 'es' }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

// `mount(Select, …)` widens the value type to Select's `T extends string | number
// | boolean` constraint (not the `= string` default), so the props are typed at
// that width — same reason as Combobox. Our string-valued OPTIONS assign to it.
function renderSelect(props: SelectProps<string | number | boolean>) {
  const instance = mount(Select, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('combobox');
const option = (name: string) => screen.getByRole('option', { name, hidden: true });
const expanded = () => trigger().getAttribute('aria-expanded');

describe('Select (component interaction)', () => {
  it('opens the listbox on trigger click and lists the options', async () => {
    const user = userEvent.setup();
    renderSelect({ options: OPTIONS });

    expect(expanded()).toBe('false');
    // Options only render while open — nothing in the DOM yet.
    expect(screen.queryByRole('option', { hidden: true })).toBeNull();

    await user.click(trigger());

    expect(expanded()).toBe('true');
    expect(option('Germany')).toBeTruthy();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
  });

  it('selects an option, fires onValueChange, closes, and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({ options: OPTIONS, onValueChange });

    await user.click(trigger());
    await user.click(option('France'));

    expect(onValueChange).toHaveBeenCalledWith('fr');
    // Single-select closes on pick (effectiveCloseOnSelect defaults to !multiple).
    expect(expanded()).toBe('false');
    // ARIA Button/Listbox pattern: focus returns to the trigger after selection.
    expect(document.activeElement).toBe(trigger());
    expect(screen.queryByRole('option', { hidden: true })).toBeNull();
  });

  it('closes on Escape, fires onEscape, and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    renderSelect({ options: OPTIONS, onEscape });

    await user.click(trigger());
    expect(expanded()).toBe('true');

    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalledOnce();
    expect(expanded()).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('keyboard: ArrowDown moves the active descendant and Enter selects it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({ options: OPTIONS, onValueChange });

    const el = trigger();
    await user.click(el);
    // Pointer-open leaves the virtual cursor unset (-1) so no phantom highlight;
    // the first ArrowDown moves it to row 0, the second to row 1 (France).
    expect(el.hasAttribute('aria-activedescendant')).toBe(false);
    await user.keyboard('{ArrowDown}');
    expect(el.getAttribute('aria-activedescendant')).toBe(
      `${el.id.replace('-trigger', '')}-option-0`
    );
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('fr');
    expect(expanded()).toBe('false');
  });

  it('multi-select keeps the listbox open and accumulates values', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({ multiple: true, options: OPTIONS, onValueChange });

    await user.click(trigger());
    await user.click(option('Germany'));
    // Multi-select keeps the listbox open (closeOnSelect defaults to false).
    expect(expanded()).toBe('true');
    await user.click(option('Spain'));

    expect(onValueChange).toHaveBeenNthCalledWith(1, ['de']);
    expect(onValueChange).toHaveBeenNthCalledWith(2, ['de', 'es']);
    expect(option('Germany').getAttribute('aria-selected')).toBe('true');
    expect(option('Spain').getAttribute('aria-selected')).toBe('true');
    expect(option('France').getAttribute('aria-selected')).toBe('false');
  });

  it('inline mode (usePortal=false) carries the dropdown z-index so later siblings cannot paint over it', async () => {
    const user = userEvent.setup();
    renderSelect({ options: OPTIONS, usePortal: false });

    const listbox = screen.getByRole('listbox', { hidden: true });
    await user.click(trigger());

    // In-place panel (e.g. a Select inside a Popover): `position: absolute`
    // without the popover top layer. Button/Input/Select roots are all
    // `position: relative`, so any positioned sibling AFTER the select in the
    // DOM paints over the open panel unless it carries an explicit z-index —
    // the table FilterMenu overdraw bug.
    expect(listbox.style.position).toBe('absolute');
    expect(listbox.style.zIndex).toBe('var(--z-dropdown)');
  });

  it('top-layer mode (default) needs no inline z-index — the top layer owns stacking', async () => {
    const user = userEvent.setup();
    renderSelect({ options: OPTIONS });

    const listbox = screen.getByRole('listbox', { hidden: true });
    await user.click(trigger());

    expect(listbox.style.position).toBe('fixed');
    expect(listbox.style.zIndex).toBe('');
  });

  it('does not select a disabled option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({
      options: [
        { label: 'Germany', value: 'de' },
        { label: 'France', value: 'fr', disabled: true }
      ],
      onValueChange
    });

    await user.click(trigger());
    await user.click(option('France'));

    expect(onValueChange).not.toHaveBeenCalled();
    // Disabled pick is a no-op — the listbox stays open.
    expect(expanded()).toBe('true');
  });
});
