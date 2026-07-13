// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ButtonGroupHarness from './__fixtures__/ButtonGroupHarness.svelte';

// Interaction layer for ButtonGroup — the selection contract child Buttons get
// through ButtonGroupContext: single-select (radiogroup/radio + aria-checked,
// toggle-off on re-click), multi-select (group/checkbox, accumulate/remove),
// `onSelectionChange` payloads, bind:value round-trip in both directions, and
// the group-level disabled propagation. Buttons register through context, so a
// createRawSnippet of plain HTML can't drive this — the tests mount a real
// composition from __fixtures__/ButtonGroupHarness.svelte (the repo's harness
// pattern, see TabHarness). Same stack as the Combobox pilot: Svelte's own
// `mount`/`unmount`, @testing-library/dom + user-event, native vitest matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderGroup(props: ComponentProps<typeof ButtonGroupHarness> = {}) {
  const instance = mount(ButtonGroupHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const radio = (name: string) => screen.getByRole('radio', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const probe = () => screen.getByTestId('value-probe').textContent;

describe('ButtonGroup (single selection)', () => {
  it('renders a radiogroup whose buttons reflect the bound value via role/aria-checked', () => {
    renderGroup({ selection: 'single', value: 'list', ariaLabel: 'View' });

    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeTruthy();
    expect(radio('List').getAttribute('aria-checked')).toBe('true');
    expect(radio('Grid').getAttribute('aria-checked')).toBe('false');
    expect(radio('Map').getAttribute('aria-checked')).toBe('false');
    // With a selection role present, aria-pressed must NOT double-announce.
    expect(radio('List').hasAttribute('aria-pressed')).toBe(false);
  });

  it('selects on click: aria-checked flips, onSelectionChange fires, bind:value updates', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'single', onSelectionChange });

    await user.click(radio('Grid'));

    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith('grid', ['grid']);
    expect(probe()).toBe('"grid"');
  });

  it('moves the selection when another button is clicked (only one checked)', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'single', onSelectionChange });

    await user.click(radio('List'));
    await user.click(radio('Grid'));

    expect(radio('List').getAttribute('aria-checked')).toBe('false');
    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(onSelectionChange).toHaveBeenLastCalledWith('grid', ['grid']);
    expect(probe()).toBe('"grid"');
  });

  it('toggles the selection off when the selected button is clicked again', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'single', value: 'grid', onSelectionChange });

    await user.click(radio('Grid'));

    expect(radio('Grid').getAttribute('aria-checked')).toBe('false');
    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith(undefined, []);
    expect(probe()).toBe('null');
  });

  it('adopts a value set by the parent after mount (bind:value into the group)', async () => {
    const user = userEvent.setup();
    renderGroup({ selection: 'single' });

    expect(radio('Grid').getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByTestId('harness-set-grid'));
    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
  });

  it('still forwards the child Button onclick alongside the selection', async () => {
    const user = userEvent.setup();
    const onGridClick = vi.fn();
    const onSelectionChange = vi.fn();
    renderGroup({
      selection: 'single',
      onSelectionChange,
      items: [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid', onclick: onGridClick }
      ]
    });

    await user.click(radio('Grid'));

    expect(onGridClick).toHaveBeenCalledOnce();
    expect(onSelectionChange).toHaveBeenCalledOnce();
  });
});

describe('ButtonGroup (multiple selection)', () => {
  it('renders a plain group whose buttons act as checkboxes', () => {
    renderGroup({ selection: 'multiple', value: ['list'], ariaLabel: 'Formats' });

    expect(screen.getByRole('group', { name: 'Formats' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(checkbox('List').getAttribute('aria-checked')).toBe('true');
    expect(checkbox('Grid').getAttribute('aria-checked')).toBe('false');
  });

  it('accumulates picks and removes them on re-click, reporting array values', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'multiple', value: [], onSelectionChange });

    await user.click(checkbox('List'));
    expect(onSelectionChange).toHaveBeenNthCalledWith(1, ['list'], ['list']);

    await user.click(checkbox('Grid'));
    expect(onSelectionChange).toHaveBeenNthCalledWith(2, ['list', 'grid'], ['list', 'grid']);
    expect(checkbox('List').getAttribute('aria-checked')).toBe('true');
    expect(checkbox('Grid').getAttribute('aria-checked')).toBe('true');

    await user.click(checkbox('List'));
    expect(onSelectionChange).toHaveBeenNthCalledWith(3, ['grid'], ['grid']);
    expect(checkbox('List').getAttribute('aria-checked')).toBe('false');
    expect(probe()).toBe('["grid"]');
  });
});

describe('ButtonGroup (disabled / none)', () => {
  it('disables every child button and ignores clicks when the group is disabled', () => {
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'single', disabled: true, ariaLabel: 'View', onSelectionChange });

    expect(screen.getByRole('radiogroup', { name: 'View' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    const list = radio('List');
    expect(list.hasAttribute('disabled')).toBe(true);

    // fireEvent bypasses native disabled suppression → asserts the context
    // guard in registerButton().onClick, not just the platform behaviour.
    fireEvent.click(list);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(list.getAttribute('aria-checked')).toBe('false');
  });

  it('selection="none" keeps plain buttons: no selection roles, no aria-pressed, onclick passes through', async () => {
    const user = userEvent.setup();
    const onListClick = vi.fn();
    const onSelectionChange = vi.fn();
    renderGroup({
      selection: 'none',
      onSelectionChange,
      items: [
        { value: 'list', label: 'List', onclick: onListClick },
        { value: 'grid', label: 'Grid' }
      ]
    });

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    const list = screen.getByRole('button', { name: 'List' });
    expect(list.hasAttribute('aria-checked')).toBe(false);
    expect(list.hasAttribute('aria-pressed')).toBe(false);

    await user.click(list);
    expect(onListClick).toHaveBeenCalledOnce();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
