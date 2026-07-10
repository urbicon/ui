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

  it('reports every interaction-driven open transition through onOpenChange exactly once', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSelect({ options: OPTIONS, onOpenChange });

    await user.click(trigger());
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);

    // Selection closes single-select — the second transition.
    await user.click(option('France'));
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);

    await user.click(trigger());
    expect(onOpenChange).toHaveBeenNthCalledWith(3, true);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenNthCalledWith(4, false);
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });

  it('fires onOpenChange(false) when an outside click dismisses the listbox', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSelect({ options: OPTIONS, onOpenChange });

    await user.click(trigger());
    await user.click(document.body);

    expect(expanded()).toBe('false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
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

  it('inline mode (usePortal=false) opens in place with the dropdown z-index so later siblings cannot paint over it', async () => {
    const user = userEvent.setup();
    renderSelect({ options: OPTIONS, usePortal: false });

    // Closed: hidden via display, and no z-index yet — the hook stamps it on
    // the show path only, so these assertions also prove the panel opened.
    const listbox = screen.getByRole('listbox', { hidden: true });
    expect(listbox.style.display).toBe('none');
    expect(listbox.style.zIndex).toBe('');

    await user.click(trigger());

    // In-place panel (e.g. a Select inside a Popover): `position: absolute`
    // without the popover top layer. Button/Input/Select roots are all
    // `position: relative`, so any positioned sibling AFTER the select in the
    // DOM paints over the open panel unless it carries an explicit z-index —
    // the table FilterMenu overdraw bug. The fallback keeps the panel stacked
    // when a consumer's Tailwind build prunes the unused @theme token.
    expect(listbox.style.display).not.toBe('none');
    expect(listbox.style.position).toBe('absolute');
    expect(listbox.style.zIndex).toBe('var(--z-dropdown, 1150)');
  });

  it('top-layer mode (default) needs no inline z-index — the top layer owns stacking', async () => {
    const user = userEvent.setup();
    renderSelect({ options: OPTIONS });

    const listbox = screen.getByRole('listbox', { hidden: true });
    await user.click(trigger());

    expect(listbox.style.position).toBe('fixed');
    expect(listbox.style.zIndex).toBe('');
  });

  it('in-dialog mode (anchor in an open modal <dialog>) renders fixed WITH the dropdown z-index', async () => {
    // jsdom's selector engine does not know `:modal`, so reflect the
    // vitest-setup showModal stub (which sets the `open` attribute) into the
    // pseudo-class — this is what lets isAnchoredInModalDialog see the modal
    // state and pick the in-place fixed mode (Codeberg #23, the WebKit path).
    const origMatches = Element.prototype.matches;
    const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string
    ) {
      if (selector === ':modal') return this.tagName === 'DIALOG' && this.hasAttribute('open');
      return origMatches.call(this, selector);
    });
    try {
      const user = userEvent.setup();
      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);
      dialog.showModal();
      const instance = mount(Select, {
        target: dialog,
        props: { options: OPTIONS } as SelectProps<string | number | boolean>
      });
      dispose = () => unmount(instance);
      flushSync();

      const listbox = screen.getByRole('listbox', { hidden: true });
      await user.click(trigger());

      // Not top-layer (a second top-layer panel over a modal dialog is
      // invisible on iOS/WebKit), but fixed so it escapes the dialog body's
      // overflow clipping — and it still needs the z-index against later
      // positioned siblings inside the dialog.
      expect(listbox.style.position).toBe('fixed');
      expect(listbox.style.display).not.toBe('none');
      expect(listbox.style.zIndex).toBe('var(--z-dropdown, 1150)');
    } finally {
      matchesSpy.mockRestore();
    }
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
