// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Combobox from './Combobox.svelte';
import type { ComboboxOption, ComboboxProps } from './index';

// First DOM/component test in the repo — the interaction layer the variant tests deliberately
// can't reach (focus / keyboard / click timing). Combobox is the reference case because its
// headline bug (Codeberg #19: `focus()` re-opening the listbox after a selection) is exactly the
// class of regression that only a mounted-in-a-DOM test catches.
//
// Mounting uses Svelte's own `mount`/`unmount` rather than @testing-library/svelte: the latter
// pulls in @testing-library/svelte-core, which resolves a *second* svelte instance and makes
// svelte-check see two unrelated `Snippet` types across the whole package. Native mount shares
// blocks' svelte instance, so there is no clash. Queries + interactions still use the svelte-free
// @testing-library/dom (screen) + @testing-library/user-event, so the ergonomics are unchanged.
//
// Assertions use vitest's native matchers (not @testing-library/jest-dom — its expect augmentation
// doesn't compose with vitest 4's Assertion type). `expanded()` reads the DOM directly.
//
// jsdom note: the listbox renders in a native popover (`popover="manual"`). jsdom applies the UA
// `[popover]:not(:popover-open)` display:none but has no real top layer to open it into, so the
// options live in the DOM but read as "hidden" to accessibility queries. These tests assert open /
// selection *logic* (aria-expanded, callbacks, keyboard nav), not visual visibility — that is
// Playwright's job — so option queries pass `{ hidden: true }`.

const OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

// `mount(Combobox, …)` infers the value type from Combobox's `T extends string | number | boolean`
// constraint (not the `= string` default), so the props are typed at that width. Our string-valued
// OPTIONS are assignable to it.
function renderCombobox(props: ComboboxProps<string | number | boolean>) {
  const instance = mount(Combobox, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const option = (name: string) => screen.getByRole('option', { name, hidden: true });
const expanded = (input: HTMLElement) => input.getAttribute('aria-expanded');

describe('Combobox (component interaction)', () => {
  it('opens the listbox on focus and lists the options', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: OPTIONS });

    const input = screen.getByRole('combobox');
    expect(expanded(input)).toBe('false');

    await user.click(input);

    expect(expanded(input)).toBe('true');
    expect(option('Apple')).toBeTruthy();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
  });

  it('reports every interaction-driven open transition through onOpenChange exactly once', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderCombobox({ options: OPTIONS, onOpenChange });

    const input = screen.getByRole('combobox');
    // Focus-open — the focus event and the click-open race is exactly why
    // setOpen guards on no-change: one transition, one callback.
    await user.click(input);
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    // Typing while already open must stay quiet (handleInput calls setOpen(true) per keystroke).
    await user.keyboard('an');
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    // Selection closes — the focus restore (suppressFocusOpen) must not re-announce an open.
    await user.click(option('Banana'));
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);

    await user.keyboard('{ArrowDown}');
    expect(onOpenChange).toHaveBeenNthCalledWith(3, true);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenNthCalledWith(4, false);
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });

  it('keeps the listbox closed after selecting an option (Codeberg #19)', async () => {
    // The focus restore in select() re-focuses the input, which fires a synchronous `focus` event.
    // Without the suppressFocusOpen guard, handleFocus flips `open` back to true on that event —
    // leaving the listbox open after every click-selection. This is the regression the whole DOM
    // test layer exists to catch.
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ options: OPTIONS, onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(option('Banana'));

    expect(onValueChange).toHaveBeenCalledWith('banana');
    expect(expanded(input)).toBe('false');
    // Focus is restored to the input (ARIA combobox pattern) but the listbox must stay closed.
    expect(document.activeElement).toBe(input);
    // `{ hidden: true }` makes this strict: it would still catch an option left rendered-but-hidden
    // by a wrongly-reopened listbox, not just a fully torn-down one.
    expect(screen.queryByRole('option', { hidden: true })).toBeNull();
  });

  it('closes on Escape without reopening', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    renderCombobox({ options: OPTIONS, onEscape });

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(expanded(input)).toBe('true');

    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalledOnce();
    expect(expanded(input)).toBe('false');
    expect(screen.queryByRole('option', { hidden: true })).toBeNull();
  });

  it('supports keyboard navigation: ArrowDown highlights, Enter selects', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ options: OPTIONS, onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);

    // First ArrowDown moves the active option to index 0; aria-activedescendant tracks it without
    // moving DOM focus off the input (the ARIA combobox pattern).
    await user.keyboard('{ArrowDown}');
    expect(input.hasAttribute('aria-activedescendant')).toBe(true);
    await user.keyboard('{ArrowDown}'); // → Banana (index 1)
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('banana');
    expect(expanded(input)).toBe('false');
  });

  it('filters the options as the user types', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: OPTIONS });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'ch');

    expect(option('Cherry')).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Apple', hidden: true })).toBeNull();
  });
});

// Group support (CMB-5). Grouped options render under section headers; filtering
// hides empty groups; keyboard nav + selection flow across group boundaries via
// the same flattened `filtered` cursor a flat list uses.
const GROUPS = [
  {
    label: 'Fruit',
    options: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' }
    ]
  },
  { label: 'Veg', options: [{ value: 'carrot', label: 'Carrot' }] }
];

describe('Combobox (groups)', () => {
  const group = (name: string) => screen.getByRole('group', { name, hidden: true });

  it('renders section headers and all grouped options', async () => {
    const user = userEvent.setup();
    renderCombobox({ groups: GROUPS });

    await user.click(screen.getByRole('combobox'));
    expect(group('Fruit')).toBeTruthy();
    expect(group('Veg')).toBeTruthy();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
  });

  it('flows keyboard navigation across group boundaries', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ groups: GROUPS, onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);
    // -1 → Apple(0) → Banana(1) → Carrot(2), crossing from Fruit into Veg.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('carrot');
  });

  it('hides a group once all its options filter out', async () => {
    const user = userEvent.setup();
    renderCombobox({ groups: GROUPS });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'carr');

    expect(group('Veg')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Fruit', hidden: true })).toBeNull();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(1);
  });

  it('selects a grouped option on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ groups: GROUPS, onValueChange });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Banana', hidden: true }));
    expect(onValueChange).toHaveBeenCalledWith('banana');
  });
});

// Async / server-side search (CMB-3). queryFn replaces client filtering: it is
// debounced, its result replaces the option list, a superseded request is
// aborted so a slow stale response can't clobber a fresh one, and the selected
// label survives a later result set that no longer contains it.
type Opt = ComboboxOption<string | number | boolean>;
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
// Let the debounce timer fire and any resolved queryFn promise settle.
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('Combobox (async queryFn)', () => {
  it('debounces, then replaces the options with the query result', async () => {
    const user = userEvent.setup();
    const queryFn = vi.fn(
      async (q: string): Promise<Opt[]> => (q ? [{ value: q, label: `Hit: ${q}` }] : [])
    );
    renderCombobox({ queryFn, debounceMs: 5 });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'ab');
    await settle();
    flushSync();

    expect(queryFn).toHaveBeenCalledWith('ab', expect.any(AbortSignal));
    expect(screen.getByRole('option', { name: 'Hit: ab', hidden: true })).toBeTruthy();
  });

  it('shows the loading row while a request is in flight', async () => {
    const user = userEvent.setup();
    const d = deferred<Opt[]>();
    const queryFn = vi.fn(() => d.promise);
    renderCombobox({ queryFn, debounceMs: 1, loadingText: 'Searching…' });

    await user.click(screen.getByRole('combobox'));
    await settle();
    flushSync();
    expect(screen.getByRole('status', { hidden: true }).textContent).toContain('Searching…');

    d.resolve([{ value: 'x', label: 'X' }]);
    await settle();
    flushSync();
    expect(screen.queryByRole('status', { hidden: true })).toBeNull();
    expect(screen.getByRole('option', { name: 'X', hidden: true })).toBeTruthy();
  });

  it('shows loading immediately on open, not the no-results row, during the debounce window', async () => {
    const user = userEvent.setup();
    const d = deferred<Opt[]>();
    const queryFn = vi.fn(() => d.promise);
    // A long debounce makes the window observable: loading must be true the
    // moment the field opens, before the fetch is even scheduled — not "no
    // results" (asyncOptions is still []).
    renderCombobox({
      queryFn,
      debounceMs: 500,
      loadingText: 'Searching…',
      noResultsText: 'Nothing'
    });

    await user.click(screen.getByRole('combobox'));
    flushSync();

    expect(screen.getByRole('status', { hidden: true }).textContent).toContain('Searching…');
    expect(screen.queryByText('Nothing')).toBeNull();
  });

  it('aborts a superseded request so the stale result is discarded', async () => {
    const user = userEvent.setup();
    const d1 = deferred<Opt[]>();
    const d2 = deferred<Opt[]>();
    const results = [d1, d2];
    const signals: AbortSignal[] = [];
    let call = 0;
    const queryFn = vi.fn((_q: string, signal: AbortSignal) => {
      signals.push(signal);
      return results[call++]?.promise ?? Promise.resolve([]);
    });
    renderCombobox({ queryFn, debounceMs: 1 });

    const input = screen.getByRole('combobox');
    await user.click(input); // → queryFn('') → d1 / signals[0]
    await settle();
    await user.type(input, 'z'); // → queryFn('z') → d2 / signals[1], aborts signals[0]
    await settle();

    expect(signals[0].aborted).toBe(true);
    d2.resolve([{ value: 'fresh', label: 'Fresh' }]);
    await settle();
    d1.resolve([{ value: 'stale', label: 'Stale' }]); // resolves last, must not overwrite
    await settle();
    flushSync();

    expect(screen.getByRole('option', { name: 'Fresh', hidden: true })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Stale', hidden: true })).toBeNull();
  });

  it('keeps the selected label after a later search drops that option', async () => {
    const user = userEvent.setup();
    const queryFn = vi.fn(
      async (q: string): Promise<Opt[]> =>
        q.startsWith('fo') ? [{ value: 'foo', label: 'Foo' }] : []
    );
    const onValueChange = vi.fn();
    renderCombobox({ queryFn, debounceMs: 1, onValueChange });

    const input = screen.getByRole('combobox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, 'fo');
    await settle();
    flushSync();
    await user.click(screen.getByRole('option', { name: 'Foo', hidden: true }));
    expect(onValueChange).toHaveBeenCalledWith('foo');
    // Selection cached: the input keeps showing "Foo" even though a fresh search
    // for a different term would no longer return it.
    expect(input.value).toBe('Foo');
  });
});
