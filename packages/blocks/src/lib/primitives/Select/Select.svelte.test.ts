// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SelectMultipleProps, SelectProps } from './index';
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

// ── Accessible naming: aria-label forwarding + aria-labelledby guard ───────────
// restProps land on the role-less base <div>, so a consumer `aria-label` used to
// become an axe `aria-prohibited-attr` there while the trigger went unnamed
// (axe `button-name`). The trigger must resolve to an accessible name in EVERY
// case: a visible `label` names it via aria-labelledby; else a consumer
// `aria-label` is forwarded onto the trigger button (not the wrapper); else the
// button's own text (value/placeholder). LocaleSwitcher relies on the aria-label
// branch (it passes `aria-label` with no visible `label`), so this guards that
// inherited behaviour at the Select level.
describe('Select (accessible naming)', () => {
  it('forwards a consumer aria-label onto the trigger button, never the role-less wrapper', () => {
    renderSelect({ options: OPTIONS, 'aria-label': 'Pick a country' });

    const t = trigger();
    expect(t.getAttribute('aria-label')).toBe('Pick a country');
    // No visible label → aria-labelledby must be absent, not dangling to a
    // nonexistent `${uid}-label` id.
    expect(t.hasAttribute('aria-labelledby')).toBe(false);
    // The forwarded label lives on the trigger ALONE — the wrapper/base divs the
    // restProps used to catch it on stay clean (kills the aria-prohibited-attr).
    const labelled = Array.from(document.querySelectorAll('[aria-label="Pick a country"]'));
    expect(labelled).toHaveLength(1);
    expect(labelled[0]).toBe(t);
  });

  it('names the trigger via aria-labelledby when a visible label renders, suppressing aria-label', () => {
    renderSelect({ options: OPTIONS, label: 'Country', 'aria-label': 'ignored' });

    const t = trigger();
    const labelledby = t.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    // The referenced id actually exists and holds the visible label text — not a
    // dangling reference.
    expect(document.getElementById(labelledby as string)?.textContent).toContain('Country');
    // Visible label wins (aria-labelledby > aria-label), so the redundant
    // aria-label is not emitted alongside it.
    expect(t.hasAttribute('aria-label')).toBe(false);
  });

  it('leaves the trigger named by its own content when neither label nor aria-label is set', () => {
    renderSelect({ options: OPTIONS });

    const t = trigger();
    expect(t.hasAttribute('aria-labelledby')).toBe(false);
    expect(t.hasAttribute('aria-label')).toBe(false);
    // Falls back to the button's text content (the placeholder here).
    expect(t.textContent).toContain('Select...');
  });
});

// ── Grouped options: cross-boundary keyboard nav + stable {#each} key ──────────
// groups flatten into one keyboard-navigable list; the virtual cursor crosses
// group boundaries seamlessly, and each option's flat index is resolved through
// the precomputed O(1) `enabledIndexByOption` map (previously an O(n) `indexOf`
// per option per render). Two groups sharing a label must not collide on the
// {#each} key (was keyed on `group.label` → `each_key_duplicate` dev crash).
const SELECT_GROUPS = [
  {
    label: 'Europe',
    options: [
      { label: 'Germany', value: 'de' },
      { label: 'France', value: 'fr' }
    ]
  },
  {
    label: 'Americas',
    options: [
      { label: 'Brazil', value: 'br' },
      { label: 'Canada', value: 'ca' }
    ]
  }
];

describe('Select (groups)', () => {
  const group = (name: string) => screen.getByRole('group', { name, hidden: true });

  it('renders section headers and every grouped option', async () => {
    const user = userEvent.setup();
    renderSelect({ groups: SELECT_GROUPS });

    await user.click(trigger());
    expect(group('Europe')).toBeTruthy();
    expect(group('Americas')).toBeTruthy();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(4);
  });

  it('flows keyboard navigation across group boundaries and selects the crossed option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({ groups: SELECT_GROUPS, onValueChange });

    const el = trigger();
    await user.click(el);
    // -1 → Germany(0) → France(1) → Brazil(2): the cursor crosses from Europe
    // into Americas. The active-descendant addresses the flat index the O(1) map
    // resolves — a wrong map (or O(n) drift) would point at the wrong option.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(el.getAttribute('aria-activedescendant')).toBe(
      `${el.id.replace('-trigger', '')}-option-2`
    );
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('br');
  });

  it('renders both groups when two share the same label (stable {#each} key)', () => {
    // With the old `group.label` key this mount throws `each_key_duplicate` in the
    // initial flush; the positional key renders both. open:true forces the keyed
    // group list to render synchronously inside renderSelect's flushSync.
    renderSelect({
      open: true,
      groups: [
        { label: 'Team', options: [{ label: 'Alice', value: 'a' }] },
        { label: 'Team', options: [{ label: 'Bob', value: 'b' }] }
      ]
    });
    expect(screen.getAllByRole('group', { name: 'Team', hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(2);
  });
});

// ── Active highlight: no phantom highlight on a disabled option (unset cursor) ─
// A disabled option is absent from `enabledOptions`, so it resolves optIdx === -1.
// On pointer-open with no selection the cursor is also unset (activeIndex === -1),
// so `optIdx === activeIndex` would be true and wrongly paint the disabled row
// with the active-highlight token. The `optIdx >= 0` guard keeps -1 (unset) from
// matching -1 (disabled) — nothing is highlighted until the cursor actually lands.
describe('Select (active highlight)', () => {
  it('does not highlight a disabled option when the cursor is unset (pointer-open, no selection)', async () => {
    const user = userEvent.setup();
    renderSelect({
      options: [
        { label: 'Germany', value: 'de', disabled: true },
        { label: 'France', value: 'fr' }
      ]
    });

    await user.click(trigger());
    // Pointer-open leaves the virtual cursor unset — no active descendant, so no
    // option should carry the highlight. classList.contains is an exact-token
    // match, so a `hover:bg-surface-hover` variant can't false-positive here.
    expect(trigger().hasAttribute('aria-activedescendant')).toBe(false);
    expect(option('Germany').classList.contains('bg-surface-hover')).toBe(false);
    expect(option('France').classList.contains('bg-surface-hover')).toBe(false);
  });
});

// Orphan dev-warn dedup — mirrors Combobox. Both warn sites live in the
// `selectedOptions` $derived.by whose deps include the `options` reference, so
// a parent re-render passing a fresh `options` array (the common
// `options={items.map(…)}` idiom) used to re-fire the warn per recompute. The
// warned-values Set (deliberately outside the reactive graph) makes it exactly
// one warn per orphan value per instance. The `$state` proxy is handed to
// `mount` unspread so prop mutations reach the component (the Collapsible
// controlled-contract pattern).
describe('Select (orphan warn dedup)', () => {
  function mountSelect(props: SelectProps<string | number | boolean>) {
    const instance = mount(Select, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
  }

  it('multi mode: warns once per orphan value, not per re-render with a fresh options array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Typed as the multi arm (not the SelectProps union): TS types property
    // WRITES on a union as the intersection of the arms' property types, which
    // for `value` ((T | null) & T[]) nothing satisfies.
    const props = $state<SelectMultipleProps<string | number | boolean>>({
      options: [...OPTIONS],
      multiple: true,
      value: ['ghost']
    });
    mountSelect(props);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('ghost');

    // Fresh array reference (same content) invalidates the derived — the warn
    // must not re-fire for the same orphan.
    props.options = [...OPTIONS];
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);

    // A different orphan still warns (per-value dedup, not a one-shot latch).
    props.value = ['ghost', 'phantom'];
    flushSync();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toContain('phantom');
    warn.mockRestore();
  });

  it('single mode: warns once for an orphan bound value across fresh options arrays', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const props = $state<SelectProps<string | number | boolean>>({
      options: [...OPTIONS],
      value: 'ghost'
    });
    mountSelect(props);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('ghost');

    props.options = [...OPTIONS];
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
