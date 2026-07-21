// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'svelte';
import { flushSync, mount, tick, unmount } from 'svelte';
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

describe('ButtonGroup (single-select roving tabindex + keyboard nav)', () => {
  // A `selection="single"` group is a WAI-ARIA radiogroup: ONE tab stop, arrow
  // keys move + select (roving tabindex), Home/End jump to the ends, disabled
  // radios are stepped over. fireEvent.keyDown + flushSync drive it
  // deterministically (the container's keydown handler is synchronous; the
  // tabindex + aria-checked updates settle on the flush).

  it('exposes a single tab stop: the selected radio is tabbable, the rest leave the tab order', () => {
    renderGroup({ selection: 'single', value: 'grid' });

    expect(radio('List').tabIndex).toBe(-1);
    expect(radio('Grid').tabIndex).toBe(0);
    expect(radio('Map').tabIndex).toBe(-1);
  });

  it('parks the tab stop on the first enabled radio when nothing is selected yet', () => {
    renderGroup({ selection: 'single' });

    expect(radio('List').tabIndex).toBe(0);
    expect(radio('Grid').tabIndex).toBe(-1);
    expect(radio('Map').tabIndex).toBe(-1);
  });

  it('ArrowRight moves selection + focus to the next radio and rolls the tab stop with it', () => {
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'single', value: 'list', onSelectionChange });

    radio('List').focus();
    fireEvent.keyDown(radio('List'), { key: 'ArrowRight' });
    flushSync();

    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(radio('List').getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(radio('Grid'));
    expect(radio('Grid').tabIndex).toBe(0);
    expect(radio('List').tabIndex).toBe(-1);
    expect(onSelectionChange).toHaveBeenLastCalledWith('grid', ['grid']);
  });

  it('ArrowLeft moves selection + focus to the previous radio', () => {
    renderGroup({ selection: 'single', value: 'grid' });

    radio('Grid').focus();
    fireEvent.keyDown(radio('Grid'), { key: 'ArrowLeft' });
    flushSync();

    expect(radio('List').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('List'));
  });

  it('navigates on both axes: ArrowDown/ArrowUp behave like Right/Left', () => {
    renderGroup({ selection: 'single', value: 'list' });

    radio('List').focus();
    fireEvent.keyDown(radio('List'), { key: 'ArrowDown' });
    flushSync();
    expect(document.activeElement).toBe(radio('Grid'));
    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(radio('Grid'), { key: 'ArrowUp' });
    flushSync();
    expect(document.activeElement).toBe(radio('List'));
    expect(radio('List').getAttribute('aria-checked')).toBe('true');
  });

  it('wraps around the ends', () => {
    renderGroup({ selection: 'single', value: 'map' });

    radio('Map').focus();
    fireEvent.keyDown(radio('Map'), { key: 'ArrowRight' });
    flushSync();

    expect(document.activeElement).toBe(radio('List'));
    expect(radio('List').getAttribute('aria-checked')).toBe('true');
  });

  it('SKIPS a disabled radio during arrow navigation', () => {
    renderGroup({
      selection: 'single',
      value: 'list',
      items: [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid', disabled: true },
        { value: 'map', label: 'Map' }
      ]
    });

    expect(radio('Grid').hasAttribute('disabled')).toBe(true);

    radio('List').focus();
    fireEvent.keyDown(radio('List'), { key: 'ArrowRight' });
    flushSync();

    // Grid is stepped over → selection + focus land on Map, not the disabled Grid.
    expect(radio('Grid').getAttribute('aria-checked')).toBe('false');
    expect(radio('Map').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('Map'));
  });

  it('ignores a value-less action button: no radio role, tab stop + roving stay index-aligned', () => {
    // A value-less Button (an action, not an option) placed BEFORE the selected
    // option must not enter the radio set — otherwise the roving index space
    // (query of [role=radio]) drifts from the value registry and the tab stop /
    // arrow origin land on the wrong button (and arrow-nav can deselect).
    renderGroup({
      selection: 'single',
      value: 'grid',
      items: [
        { value: undefined, label: 'Refresh' },
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
        { value: 'map', label: 'Map' }
      ]
    });

    // The action button is not a selection option → plain button, no radio role.
    const action = screen.getByRole('button', { name: 'Refresh' });
    expect(action.getAttribute('role')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(3);

    // The single tab stop rolls onto the SELECTED option, not the leading action.
    expect(action.tabIndex).toBe(0); // native default, untouched by roving
    expect(radio('Grid').tabIndex).toBe(0);
    expect(radio('List').tabIndex).toBe(-1);
    expect(radio('Map').tabIndex).toBe(-1);

    // Arrow-nav computes from the correct origin (Grid) → advances to Map;
    // it must NOT misfire onto/deselect Grid.
    radio('Grid').focus();
    fireEvent.keyDown(radio('Grid'), { key: 'ArrowRight' });
    flushSync();

    expect(document.activeElement).toBe(radio('Map'));
    expect(radio('Map').getAttribute('aria-checked')).toBe('true');
    expect(radio('Grid').getAttribute('aria-checked')).toBe('false');
  });

  it('Home / End jump to the first / last radio', () => {
    renderGroup({ selection: 'single', value: 'grid' });

    radio('Grid').focus();
    fireEvent.keyDown(radio('Grid'), { key: 'Home' });
    flushSync();
    expect(document.activeElement).toBe(radio('List'));
    expect(radio('List').getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(radio('List'), { key: 'End' });
    flushSync();
    expect(document.activeElement).toBe(radio('Map'));
    expect(radio('Map').getAttribute('aria-checked')).toBe('true');
  });

  it('resolves the tab stop by value, not position: duplicate values do not drift it', () => {
    // Two buttons sharing a value: the old registration order deduped to
    // ['a','b'] while the DOM held three radios, so the selected value 'b'
    // resolved to index 1 and parked the tab stop on "Alpha again". data-value
    // matching pins it to the element whose value is actually selected.
    renderGroup({
      selection: 'single',
      value: 'b',
      items: [
        { value: 'a', label: 'Alpha' },
        { value: 'a', label: 'Alpha again' },
        { value: 'b', label: 'Beta' }
      ]
    });

    expect(radio('Beta').tabIndex).toBe(0);
    expect(radio('Alpha').tabIndex).toBe(-1);
    expect(radio('Alpha again').tabIndex).toBe(-1);
  });

  it('keeps tab stop and selection aligned after a preceding radio is removed at runtime', async () => {
    // The old value registry only ever grew, so after removing "List" a
    // selection of 'grid' still resolved through ['list','grid','map'] to
    // index 1 — the tab stop landed on "Map" while "Grid" was selected.
    const user = userEvent.setup();
    renderGroup({ selection: 'single', value: 'map' });

    await user.click(screen.getByTestId('harness-remove-first'));
    await user.click(radio('Grid'));

    expect(screen.queryAllByRole('radio')).toHaveLength(2);
    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(radio('Grid').tabIndex).toBe(0);
    expect(radio('Map').tabIndex).toBe(-1);
  });

  it('roves a radio mounted after the initial render into the single-tab-stop contract', async () => {
    // Registration bumps a deferred registry version, so the roving effect
    // re-runs for late-mounted buttons — without it the new radio kept its
    // native tabbability: a second tab stop inside the radiogroup.
    const user = userEvent.setup();
    renderGroup({ selection: 'single', value: 'grid' });

    await user.click(screen.getByTestId('harness-append-photo'));
    await tick();
    flushSync();

    expect(radio('Photo').tabIndex).toBe(-1);
    expect(radio('Grid').tabIndex).toBe(0);

    // The late radio is a full roving citizen: End jumps onto it.
    radio('Grid').focus();
    fireEvent.keyDown(radio('Grid'), { key: 'End' });
    flushSync();
    expect(document.activeElement).toBe(radio('Photo'));
    expect(radio('Photo').getAttribute('aria-checked')).toBe('true');
  });

  it('reflects the group orientation via aria-orientation on the radiogroup', () => {
    renderGroup({ selection: 'single', ariaLabel: 'View', orientation: 'vertical' });

    expect(screen.getByRole('radiogroup', { name: 'View' }).getAttribute('aria-orientation')).toBe(
      'vertical'
    );
  });

  it('omits aria-orientation on the multi-selection arm, where ARIA disallows it', () => {
    renderGroup({ selection: 'multiple', ariaLabel: 'Filters', orientation: 'vertical' });

    // role=group does not support aria-orientation (axe: aria-allowed-attr).
    expect(screen.getByRole('group', { name: 'Filters' }).hasAttribute('aria-orientation')).toBe(
      false
    );
  });
});

describe('ButtonGroup (multiple-select keyboard)', () => {
  it('stays per-item tabbable and does NOT rove — arrow keys are inert', () => {
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'multiple', value: ['list'], onSelectionChange });

    // Checkbox-group convention: every button keeps its native tab stop (no -1).
    expect(checkbox('List').tabIndex).toBe(0);
    expect(checkbox('Grid').tabIndex).toBe(0);
    expect(checkbox('Map').tabIndex).toBe(0);

    checkbox('List').focus();
    fireEvent.keyDown(checkbox('List'), { key: 'ArrowRight' });
    flushSync();

    // Roving is single-select only → focus + selection are untouched.
    expect(document.activeElement).toBe(checkbox('List'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
