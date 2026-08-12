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

describe('ButtonGroup (restProps-first contract on child Buttons)', () => {
  // Button spreads {...restProps} FIRST and merges its selection attributes
  // after it (COMPONENT-API-CONVENTIONS §restProps ordering), so a consumer
  // passing role/aria-checked/data-value through restProps cannot override the
  // group's selection wiring — the exposure that motivated the migration.

  it('consumer role/aria-checked/data-value via restProps cannot override the selection wiring', () => {
    renderGroup({
      selection: 'single',
      value: 'grid',
      items: [
        { value: 'list', label: 'List' },
        {
          value: 'grid',
          label: 'Grid',
          attrs: { role: 'link', 'aria-checked': 'false', 'data-value': 'evil' }
        },
        // The unselected option's internal `false` must also win — the merge
        // is `??` (undefined-only fallback), not `||`.
        { value: 'map', label: 'Map', attrs: { 'aria-checked': 'true' } }
      ]
    });

    // Still a radio (consumer role lost), still checked, still the real value.
    const grid = radio('Grid');
    expect(grid.getAttribute('role')).toBe('radio');
    expect(grid.getAttribute('aria-checked')).toBe('true');
    expect(grid.getAttribute('data-value')).toBe('grid');
    expect(radio('Map').getAttribute('aria-checked')).toBe('false');
    // Roving resolves the tab stop through the REAL data-value, so the
    // radiogroup keeps its single tab stop on the selected option.
    expect(grid.tabIndex).toBe(0);
    expect(radio('List').tabIndex).toBe(-1);
    expect(radio('Map').tabIndex).toBe(-1);
  });

  it('selection still works on a button carrying adversarial restProps', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGroup({
      selection: 'single',
      onSelectionChange,
      items: [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid', attrs: { role: 'link', 'data-value': 'evil' } }
      ]
    });

    await user.click(radio('Grid'));

    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith('grid', ['grid']);
    expect(probe()).toBe('"grid"');
  });

  it('forces aria-pressed off on selection options, even against restProps', () => {
    renderGroup({
      selection: 'single',
      value: 'list',
      items: [{ value: 'list', label: 'List', attrs: { 'aria-pressed': 'true' } }]
    });

    // A selection role announces via aria-checked; a consumer aria-pressed
    // would double-announce, so the component actively removes it here.
    expect(radio('List').hasAttribute('aria-pressed')).toBe(false);
  });

  it('lets consumer attributes through on a value-less action button inside the group', () => {
    renderGroup({
      selection: 'single',
      value: 'grid',
      items: [
        { value: undefined, label: 'Docs', attrs: { role: 'link', 'aria-current': 'page' } },
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' }
      ]
    });

    // No selection wiring on the action button → the standalone arm applies
    // and the consumer's own role/aria survive the merge.
    const action = screen.getByRole('link', { name: 'Docs' });
    expect(action.getAttribute('aria-current')).toBe('page');
    expect(screen.queryAllByRole('radio')).toHaveLength(2);
  });
});

describe('ButtonGroup (restProps-first contract on the container)', () => {
  // The container div spreads {...restProps} FIRST and applies its computed
  // attributes after it (COMPONENT-API-CONVENTIONS §restProps ordering) — the
  // same migration Button got one level down. A consumer role cannot defeat
  // the radiogroup semantics, and a consumer onkeydown supplements the roving
  // keyboard nav via composeHandlers instead of replacing it.

  it('consumer role via restProps cannot override the computed radiogroup role', () => {
    renderGroup({ selection: 'single', value: 'grid', ariaLabel: 'View', role: 'menu' });

    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('internal aria-orientation wins on the radiogroup arm, even against restProps', () => {
    renderGroup({
      selection: 'single',
      ariaLabel: 'View',
      orientation: 'vertical',
      'aria-orientation': 'horizontal'
    });

    expect(screen.getByRole('radiogroup', { name: 'View' }).getAttribute('aria-orientation')).toBe(
      'vertical'
    );
  });

  it('actively removes a consumer aria-orientation on the group arm, where ARIA disallows it', () => {
    // role=group does not support aria-orientation (axe: aria-allowed-attr) —
    // letting the consumer value through would ship the violation for them,
    // so the component removes it (mirrors Button's aria-pressed force-off).
    renderGroup({ selection: 'multiple', ariaLabel: 'Filters', 'aria-orientation': 'vertical' });

    expect(screen.getByRole('group', { name: 'Filters' }).hasAttribute('aria-orientation')).toBe(
      false
    );
  });

  it('a real disabled beats a consumer aria-disabled="false"; idle falls back to the consumer value', () => {
    renderGroup({
      selection: 'single',
      disabled: true,
      ariaLabel: 'View',
      'aria-disabled': 'false'
    });
    expect(screen.getByRole('radiogroup', { name: 'View' }).getAttribute('aria-disabled')).toBe(
      'true'
    );

    dispose?.();
    document.body.replaceChildren();

    renderGroup({ selection: 'single', ariaLabel: 'View', 'aria-disabled': 'true' });
    expect(screen.getByRole('radiogroup', { name: 'View' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
  });

  it('consumer onkeydown supplements the roving nav — both run, consumer second', () => {
    // The old spread-last order let a consumer onkeydown REPLACE the roving
    // keyboard navigation. Composed, the internal handler runs first (arrow
    // selection still moves) and the consumer observes the event afterwards —
    // defaultPrevented tells them the group claimed the key.
    const seenDefaultPrevented: boolean[] = [];
    const onkeydown = vi.fn((event: KeyboardEvent) =>
      seenDefaultPrevented.push(event.defaultPrevented)
    );
    renderGroup({ selection: 'single', value: 'list', onkeydown });

    radio('List').focus();
    fireEvent.keyDown(radio('List'), { key: 'ArrowRight' });
    flushSync();

    // Roving nav survived: selection + focus + tab stop moved to Grid.
    expect(radio('Grid').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('Grid'));
    expect(radio('Grid').tabIndex).toBe(0);
    // The consumer handler still ran, after the internal one claimed the key.
    expect(onkeydown).toHaveBeenCalledOnce();
    expect(seenDefaultPrevented).toEqual([true]);
  });

  it('runs the consumer onkeydown even where the internal handler is inert (multiple arm)', () => {
    const onkeydown = vi.fn();
    const onSelectionChange = vi.fn();
    renderGroup({ selection: 'multiple', value: ['list'], onkeydown, onSelectionChange });

    checkbox('List').focus();
    fireEvent.keyDown(checkbox('List'), { key: 'ArrowRight' });
    flushSync();

    // No roving on the checkbox arm — but the composed consumer handler fires.
    expect(onkeydown).toHaveBeenCalledOnce();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(checkbox('List'));
  });

  it('lets legitimate restProps through: data-*, id, and a native aria-label label the group', () => {
    renderGroup({
      selection: 'single',
      'aria-label': 'Views (native)',
      'data-analytics': 'view-switch',
      id: 'view-group'
    });

    // No ariaLabel prop → the consumer's own aria-label survives the merge.
    const group = screen.getByRole('radiogroup', { name: 'Views (native)' });
    expect(group.getAttribute('data-analytics')).toBe('view-switch');
    expect(group.id).toBe('view-group');
  });

  it('prefers the dedicated ariaLabel prop over a restProps aria-label', () => {
    renderGroup({ selection: 'single', ariaLabel: 'Prop label', 'aria-label': 'Native label' });

    expect(screen.getByRole('radiogroup', { name: 'Prop label' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Native label' })).toBeNull();
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

describe('ButtonGroup (press cue)', () => {
  it('renders its children without the press sink — the shared seam must not break on click (#192)', () => {
    // The group's `mint` default is 'none' and always wins over a child's own
    // mint, so no button in a connected group sinks under the pointer while its
    // neighbours stay put. Passing a real mint opts the whole group back in.
    renderGroup({ connected: true });
    expect(screen.getByRole('button', { name: 'List' }).className).not.toContain('active:scale-');

    dispose?.();
    document.body.replaceChildren();

    renderGroup({ connected: true, mint: 'scale' });
    expect(screen.getByRole('button', { name: 'List' }).className).toContain(
      'active:scale-[var(--blocks-press-scale)]'
    );
  });
});

// The cap radius is a tv() compound (covered in buttongroup.variants.test.ts);
// what these assert is the *default* the component feeds that axis, which only
// exists here — `effectiveTier` in ButtonGroup.svelte.
describe('ButtonGroup (tier default per orientation)', () => {
  const group = () => screen.getByRole('group');

  it('caps a connected vertical group softly — the pill cap would dome it into a lozenge (#194)', () => {
    renderGroup({ orientation: 'vertical', connected: true });

    // Horizontally the pill cap is clamped by the button height (the group's
    // short side) and reads as a segmented control; vertically it is clamped by
    // the width, so a stack of text buttons domes top and bottom into a capsule.
    expect(group().className).toContain('[&>:first-child]:rounded-t-modify');
    expect(group().className).toContain('[&>:last-child]:rounded-b-modify');
    expect(group().className).not.toContain('rounded-t-commit');
  });

  it('keeps the pill cap horizontally — that IS the segmented control', () => {
    renderGroup({ orientation: 'horizontal', connected: true });

    expect(group().className).toContain('[&>:first-child]:rounded-l-commit');
    expect(group().className).toContain('[&>:last-child]:rounded-r-commit');
  });

  it('honours an explicit tier="commit" on a vertical group — a narrow icon stack wants the capsule', () => {
    renderGroup({ orientation: 'vertical', connected: true, tier: 'commit' });

    expect(group().className).toContain('[&>:first-child]:rounded-t-commit');
    expect(group().className).toContain('[&>:last-child]:rounded-b-commit');
  });

  it('leaves a DISCONNECTED vertical group on the pill default — it has no caps to dome', () => {
    renderGroup({ orientation: 'vertical', connected: false });

    // No cap compounds on the container at all; the child Buttons keep the pill
    // radius a spaced vertical stack of buttons should read as.
    expect(group().className).not.toContain('rounded-t-');
    expect(screen.getByRole('button', { name: 'List' }).className).toContain('rounded-commit');
  });
});
