// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuProps } from './index';
import Menu from './Menu.svelte';

// Interaction layer for Menu — the W3C *menu* pattern (roving tabindex, real DOM
// focus moving between `role="menuitem"` buttons, Escape restoring focus to the
// trigger). Unlike Select's listbox (virtual cursor on the trigger), Menu moves
// focus into the panel, which only a mounted-in-a-DOM test exercises.
//
// Menu renders its panel through Popover in manual mode (autoTrigger=false); in
// jsdom there is no top layer, so items live in the DOM but read as "hidden" —
// queried with `{ hidden: true }`. Same stack + rationale as the Combobox pilot:
// Svelte's own `mount`/`unmount`, @testing-library/dom + user-event, native
// vitest matchers. These assert menu *logic* (open state, activation callbacks,
// keyboard nav, focus restore), not visual visibility — that is Playwright's job.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderMenu(props: MenuProps) {
  const instance = mount(Menu, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('button', { name: /Actions/ });
const item = (name: string) => screen.getByRole('menuitem', { name, hidden: true });
const expanded = () => trigger().getAttribute('aria-expanded');

describe('Menu (component interaction)', () => {
  it('opens on trigger click and lists the menu items', async () => {
    const user = userEvent.setup();
    renderMenu({ placeholder: 'Actions', items: [{ label: 'Edit' }, { label: 'Delete' }] });

    expect(expanded()).toBe('false');
    expect(screen.queryByRole('menuitem', { hidden: true })).toBeNull();

    await user.click(trigger());

    expect(expanded()).toBe('true');
    expect(item('Edit')).toBeTruthy();
    expect(screen.getAllByRole('menuitem', { hidden: true })).toHaveLength(2);
  });

  it('activates an item on click: fires onSelect once and closes the menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu({
      placeholder: 'Actions',
      items: [{ label: 'Edit', onSelect: onEdit }, { label: 'Delete' }]
    });

    await user.click(trigger());
    await user.click(item('Edit'));

    expect(onEdit).toHaveBeenCalledOnce();
    // Default activation closes the menu (keepOpen unset).
    expect(expanded()).toBe('false');
    expect(screen.queryByRole('menuitem', { hidden: true })).toBeNull();
  });

  it('keeps the menu open after activating a keepOpen item', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderMenu({
      placeholder: 'Actions',
      items: [{ label: 'Add tag', onSelect: onAdd, keepOpen: true }, { label: 'Delete' }]
    });

    await user.click(trigger());
    await user.click(item('Add tag'));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(expanded()).toBe('true');
    // Panel stays mounted for a follow-up pick.
    expect(item('Add tag')).toBeTruthy();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    renderMenu({ placeholder: 'Actions', items: [{ label: 'Edit' }, { label: 'Delete' }] });

    const el = trigger();
    await user.click(el);
    expect(expanded()).toBe('true');

    await user.keyboard('{Escape}');

    expect(expanded()).toBe('false');
    // W3C menu pattern: Escape returns focus to the trigger button.
    expect(document.activeElement).toBe(el);
  });

  it('keyboard: ArrowDown focuses the first item, Enter activates it', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu({
      placeholder: 'Actions',
      items: [{ label: 'Edit', onSelect: onEdit }, { label: 'Delete' }]
    });

    await user.click(trigger());
    // Pointer-open parks focus on the panel; the first ArrowDown moves it onto
    // item 0 (roving tabindex), then Enter activates the focused item.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('Edit'));
    await user.keyboard('{Enter}');

    expect(onEdit).toHaveBeenCalledOnce();
    expect(expanded()).toBe('false');
  });

  it('skips a disabled item in roving keyboard navigation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderMenu({
      placeholder: 'Actions',
      items: [
        { label: 'Edit' },
        { label: 'Delete', onSelect: onDelete, disabled: true },
        { label: 'Share' }
      ]
    });

    await user.click(trigger());
    expect(item('Delete').getAttribute('aria-disabled')).toBe('true');

    // Roving focus (getFocusableItems filters `:not([disabled])`) walks Edit →
    // Share and never lands on Delete. This exercises the component's own guard:
    // a native `<button disabled>` can't receive a click at all, so a click-based
    // test would pass regardless of whether the menu skips disabled items.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('Edit'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('Share'));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
