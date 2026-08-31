// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComboboxMultiHarness from './__fixtures__/ComboboxMultiHarness.svelte';
import Combobox from './Combobox.svelte';
import type { ComboboxMultipleProps, ComboboxOption, ComboboxProps } from './index';

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

  it('shows the clear button for a selected falsy value (numeric 0)', () => {
    // `hasValue` uses `value != null`, not a truthy check — so a legitimately
    // selected `0` / `''` / `false` is still clearable, not stranded.
    renderCombobox({
      options: [
        { value: 0, label: 'Zero' },
        { value: 1, label: 'One' }
      ],
      value: 0,
      clearable: true
    });
    expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy();
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

  it('aborts the in-flight request when the component unmounts mid-flight', async () => {
    // Regression for f51eee8: the effect cleanup must abort a pending request on
    // teardown so a late resolve can't write state after unmount. `deferred`
    // keeps the request in flight until we choose to resolve it.
    const user = userEvent.setup();
    const d = deferred<Opt[]>();
    const signals: AbortSignal[] = [];
    const queryFn = vi.fn((_q: string, signal: AbortSignal) => {
      signals.push(signal);
      return d.promise;
    });
    renderCombobox({ queryFn, debounceMs: 1 });

    await user.click(screen.getByRole('combobox'));
    await settle(); // debounce fires → queryFn runs → signals[0], request pending
    expect(signals[0].aborted).toBe(false);

    dispose?.(); // unmount while the request is still in flight
    dispose = undefined;
    flushSync();

    expect(signals[0].aborted).toBe(true);

    // A late resolve after unmount must be a no-op (guarded by signal.aborted),
    // not throw or touch state.
    d.resolve([{ value: 'late', label: 'Late' }]);
    await settle();
  });

  it('keeps the selected label after a later search drops that option', async () => {
    const user = userEvent.setup();
    // Only 'fo…' queries return Foo. After selecting, the query is its label
    // "Foo" (capital F), which does NOT start with 'fo', so re-opening fetches an
    // empty list — `allOptions` can no longer supply the label, only
    // `selectedCache` can. (The earlier version left Foo in `asyncOptions`, so the
    // assertion passed without touching the cache path at all.)
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
    expect(input.value).toBe('Foo');

    // Re-open via keyboard (re-clicking a focused field is a no-op). The async
    // effect re-runs the query ("Foo") and gets an empty list, so `asyncOptions`
    // drops Foo. `value` stays 'foo' (ArrowDown doesn't reset it), so the selected
    // label is resolved through `selectedCache`, not the option list.
    await user.keyboard('{ArrowDown}');
    await settle();
    flushSync();
    expect(screen.queryByRole('option', { hidden: true })).toBeNull(); // list dropped Foo
    expect(input.value).toBe('Foo'); // selection still held
  });

  // Failure contract (queryFn rejection → onError, ConfirmDialog precedent):
  // a real rejection ends the loading state, keeps the previous — now stale —
  // options in place, and reports through onError exactly once. AbortError
  // (a superseded/closed request) stays silent, and without a handler the
  // rejection falls back to the DEV console.warn instead of escaping.
  it('reports a real queryFn rejection through onError once, ends loading, and keeps stale options', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const failure = new Error('server said no');
    let call = 0;
    const queryFn = vi.fn((): Promise<Opt[]> => {
      call += 1;
      return call === 1
        ? Promise.resolve([{ value: 'a', label: 'Alpha' }])
        : Promise.reject(failure);
    });
    renderCombobox({ queryFn, debounceMs: 1, onError });

    const input = screen.getByRole('combobox');
    await user.click(input); // call 1 → resolves with Alpha
    await settle();
    flushSync();
    expect(screen.getByRole('option', { name: 'Alpha', hidden: true })).toBeTruthy();

    await user.type(input, 'x'); // call 2 → rejects
    await settle();
    flushSync();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(failure);
    // Loading ended — the status row is gone, not stuck on "Loading…".
    expect(screen.queryByRole('status', { hidden: true })).toBeNull();
    // Stale-options decision: the previous result set stays in place (no
    // result-set clobber; a UI error slot is deliberately out of scope).
    expect(screen.getByRole('option', { name: 'Alpha', hidden: true })).toBeTruthy();
  });

  it('stays silent on an AbortError rejection — no onError, no dev warn', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queryFn = vi.fn(
      (): Promise<Opt[]> => Promise.reject(new DOMException('aborted', 'AbortError'))
    );
    renderCombobox({ queryFn, debounceMs: 1, onError });

    await user.click(screen.getByRole('combobox'));
    await settle();
    flushSync();

    expect(queryFn).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to the DEV console.warn without onError, and nothing escapes unhandled', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const failure = new Error('boom');
      const queryFn = vi.fn((): Promise<Opt[]> => Promise.reject(failure));
      renderCombobox({ queryFn, debounceMs: 1 });

      await user.click(screen.getByRole('combobox'));
      await settle();
      flushSync();
      // Unhandled-rejection detection runs after the microtask queue drains —
      // yield a macrotask before asserting the listener stayed silent.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(warn).toHaveBeenCalledWith('[Combobox] queryFn rejected:', failure);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
      warn.mockRestore();
    }
  });
});

// Multi-select with tags (CMB-2). `multiple` binds `value` to an array; picks
// render as removable tag chips below the search input; selecting keeps the
// listbox open; Backspace on an empty query removes the last tag; `maxItems`
// caps additions; a selected option can always be toggled back off.
const removeTagBtn = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`remove ${label}`, 'i') });
const queryRemoveTagBtn = (label: string) =>
  screen.queryByRole('button', { name: new RegExp(`remove ${label}`, 'i') });

describe('Combobox (multiple)', () => {
  it('renders the selected values as removable tags', () => {
    renderCombobox({ options: OPTIONS, multiple: true, value: ['apple', 'banana'] });

    expect(removeTagBtn('Apple')).toBeTruthy();
    expect(removeTagBtn('Banana')).toBeTruthy();
    expect(queryRemoveTagBtn('Cherry')).toBeNull();
    // Multi-mode listbox announces itself as multiselectable.
    expect(screen.getByRole('listbox', { hidden: true }).getAttribute('aria-multiselectable')).toBe(
      'true'
    );
  });

  it('adds a tag on select and keeps the listbox open', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ options: OPTIONS, multiple: true, value: [], onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(option('Apple'));

    expect(onValueChange).toHaveBeenCalledWith(['apple']);
    expect(removeTagBtn('Apple')).toBeTruthy();
    // Multi keeps the listbox open so several picks flow without re-opening.
    expect(expanded(input)).toBe('true');
    expect(option('Banana')).toBeTruthy();
  });

  it('removes a tag via its × button, firing onRemoveTag then onValueChange', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    const onValueChange = vi.fn();
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['apple', 'banana'],
      onRemoveTag,
      onValueChange
    });

    await user.click(removeTagBtn('Apple'));

    expect(onRemoveTag).toHaveBeenCalledWith('apple');
    expect(onValueChange).toHaveBeenCalledWith(['banana']);
    expect(queryRemoveTagBtn('Apple')).toBeNull();
    expect(removeTagBtn('Banana')).toBeTruthy();
  });

  it('removes the last tag on Backspace when the query is empty', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    renderCombobox({ options: OPTIONS, multiple: true, value: ['apple', 'banana'], onRemoveTag });

    const input = screen.getByRole('combobox');
    await user.click(input); // focus, empty query
    await user.keyboard('{Backspace}');

    expect(onRemoveTag).toHaveBeenCalledWith('banana');
  });

  it('does not remove a tag on Backspace while the query is non-empty', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    renderCombobox({ options: OPTIONS, multiple: true, value: ['apple'], onRemoveTag });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'x'); // query = 'x'
    await user.keyboard('{Backspace}'); // deletes the 'x', must not touch the tag

    expect(onRemoveTag).not.toHaveBeenCalled();
  });

  it('toggles a selected option off from the listbox', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    const onValueChange = vi.fn();
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['apple'],
      onRemoveTag,
      onValueChange
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(option('Apple')); // already selected → toggles off

    expect(onRemoveTag).toHaveBeenCalledWith('apple');
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it('caps additions at maxItems but keeps selected options removable', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ options: OPTIONS, multiple: true, value: [], maxItems: 1, onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(option('Apple'));
    expect(onValueChange).toHaveBeenCalledWith(['apple']);
    expect(onValueChange).toHaveBeenCalledTimes(1);

    // At the cap, a non-selected option is disabled and cannot be added.
    expect(option('Banana').getAttribute('aria-disabled')).toBe('true');
    await user.click(option('Banana'));
    expect(onValueChange).toHaveBeenCalledTimes(1); // no second call

    // The already-selected option is NOT disabled — it can still be toggled off.
    expect(option('Apple').getAttribute('aria-disabled')).not.toBe('true');
    await user.click(option('Apple'));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it('clears every tag via the clear button without firing onRemoveTag per tag', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRemoveTag = vi.fn();
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['apple', 'banana'],
      clearable: true,
      onValueChange,
      onRemoveTag
    });

    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(queryRemoveTagBtn('Apple')).toBeNull();
    // A bulk clear signals through onValueChange([]) only — never per-tag.
    expect(onRemoveTag).not.toHaveBeenCalled();
  });

  it('clears the query and restores the full option list after a pick', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: OPTIONS, multiple: true, value: [], placeholder: 'Pick…' });

    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.getAttribute('placeholder')).toBe('Pick…');

    await user.click(input);
    await user.type(input, 'ban'); // filters to Banana
    await user.click(option('Banana'));

    // Query cleared so the next search starts fresh; the full list is back.
    expect(input.value).toBe('');
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
    // Placeholder is suppressed once a tag exists.
    expect(input.getAttribute('placeholder')).toBe('');
  });

  it('keyboard navigation skips a disabled option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' }
      ],
      multiple: true,
      value: [],
      onValueChange
    });

    const input = screen.getByRole('combobox');
    await user.click(input);
    // -1 → A(0) → skip disabled B → C(2).
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(['c']);
  });

  it('Home and End land on the first and last activatable option (#198)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({
      options: [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
        { value: 'd', label: 'D', disabled: true }
      ],
      multiple: true,
      value: [],
      onValueChange
    });

    const input = screen.getByRole('combobox');
    await user.click(input);

    // End skips the disabled tail D and lands on C — same skip the arrows apply.
    await user.keyboard('{End}');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-c$/);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith(['c']);

    // Home skips the disabled head A and lands on B.
    await user.keyboard('{Home}');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-b$/);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith(['c', 'b']);
  });

  it('renders a removable fallback tag for an orphan value (bound but not in options)', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    const onValueChange = vi.fn();
    // The fallback warns in dev (pointing at seedOptions); silence it so the
    // assertion output stays clean — the warn itself is asserted in the
    // seedOptions suite below.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['ghost'],
      onRemoveTag,
      onValueChange
    });

    // The orphan renders as a raw-value tag and is still removable.
    const ghostBtn = removeTagBtn('ghost');
    expect(ghostBtn).toBeTruthy();
    await user.click(ghostBtn);
    expect(onRemoveTag).toHaveBeenCalledWith('ghost');
    expect(onValueChange).toHaveBeenCalledWith([]);
    warn.mockRestore();
  });

  it('does not crash on a bound array with duplicate values', () => {
    // Duplicate values would throw `each_key_duplicate` if the tag list were
    // keyed on the bare value; the positional key keeps it fail-soft.
    expect(() =>
      renderCombobox({
        options: OPTIONS,
        multiple: true,
        value: ['apple', 'apple']
      })
    ).not.toThrow();
  });

  it('selects via keyboard (Enter) without closing the listbox', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCombobox({ options: OPTIONS, multiple: true, value: [], onValueChange });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}'); // → Apple

    expect(onValueChange).toHaveBeenCalledWith(['apple']);
    expect(expanded(input)).toBe('true');
  });

  it('emits one hidden input per selected value for native form submission', () => {
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['apple', 'banana'],
      name: 'fruit'
    });

    const hidden = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="fruit"]')
    );
    expect(hidden.map((h) => h.value)).toEqual(['apple', 'banana']);
  });
});

// Label seed for pre-selected values (the async-mount pattern): `seedOptions`
// is the LAST lookup source when a selected value's label resolves — live
// options first, then the pick-cache, then the seed — so it supplies labels
// for values bound before any options exist without ever shadowing a live
// option. One shape for single and multi. Its existence also makes the orphan
// warn meaningful in async mode: a value in none of the three sources is a
// consumer gap the warn can now name an API for.
describe('Combobox (seedOptions label seed)', () => {
  it('resolves a pre-bound multi value through the seed instead of the raw fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['ghost'],
      seedOptions: [{ value: 'ghost', label: 'Ghost Label' }]
    });

    expect(removeTagBtn('Ghost Label')).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('never shadows a live option: the current options win over a stale seed', () => {
    renderCombobox({
      options: OPTIONS,
      multiple: true,
      value: ['apple'],
      seedOptions: [{ value: 'apple', label: 'Stale Apple' }]
    });

    expect(removeTagBtn('Apple')).toBeTruthy();
    expect(queryRemoveTagBtn('Stale Apple')).toBeNull();
  });

  it('labels a pre-bound async (queryFn) value before any request has run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCombobox({
      queryFn: vi.fn(() => Promise.resolve([])),
      multiple: true,
      value: ['u-42'],
      seedOptions: [{ value: 'u-42', label: 'Ada Lovelace' }]
    });

    // No query has fired (listbox never opened) — the seed alone labels the tag.
    expect(removeTagBtn('Ada Lovelace')).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns (DEV, once) in async mode when a pre-bound value has no source, naming seedOptions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCombobox({
      queryFn: vi.fn(() => Promise.resolve([])),
      multiple: true,
      value: ['u-42']
    });

    // Pre-seedOptions this stayed silent (there was no API to point at);
    // now the raw-value fallback is a closable consumer gap.
    expect(removeTagBtn('u-42')).toBeTruthy();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('seedOptions');
    warn.mockRestore();
  });

  it('restores the seeded label into the single-mode input on mount', () => {
    renderCombobox({
      queryFn: vi.fn(() => Promise.resolve([])),
      value: 'apple',
      seedOptions: [{ value: 'apple', label: 'Apple' }]
    });

    // The label-restore effect reads selectedOption, which now resolves
    // through the seed — the field shows the label, not an empty input.
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Apple');
  });
});

// The `customTag` snippet can't be passed through `mount(Combobox, { props })`
// as plain data, so these mount a real composition from __fixtures__/ (the
// repo's harness pattern). It also gives the parent-side `bind:value`
// assertions a natural home — though an *unspread* `$state` proxy handed to
// `mount` would work too (see the Collapsible controlled-contract tests).
describe('Combobox (multiple — customTag + reactivity)', () => {
  function renderHarness(props: ComponentProps<typeof ComboboxMultiHarness>) {
    const instance = mount(ComboboxMultiHarness, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
  }

  it('renders tags through the customTag snippet and wires its remove callback', async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    renderHarness({ onRemoveTag });

    // Build the selection by picking two options — exercises the real add path.
    await user.click(screen.getByRole('combobox'));
    await user.click(option('Apple'));
    await user.click(option('Banana'));

    const chips = screen.getAllByTestId('custom-tag');
    expect(chips.map((c) => c.getAttribute('data-value'))).toEqual(['apple', 'banana']);

    // The `remove` closure the snippet receives drops the right tag.
    await user.click(screen.getByTestId('custom-remove-apple'));
    expect(onRemoveTag).toHaveBeenCalledWith('apple');
    expect(screen.queryByTestId('custom-remove-apple')).toBeNull();
    expect(screen.getByTestId('custom-remove-banana')).toBeTruthy();
  });

  it('re-renders tags when the bound value is mutated from the parent', async () => {
    const user = userEvent.setup();
    renderHarness({});

    expect(screen.queryAllByTestId('custom-tag')).toHaveLength(0);
    await user.click(screen.getByTestId('harness-add-cherry'));
    const chips = screen.getAllByTestId('custom-tag');
    expect(chips.map((c) => c.getAttribute('data-value'))).toEqual(['cherry']);
  });
});

// Multi-mode tagCache: the array analogue of the single-mode selectedCache test —
// a picked tag must keep its label after an async result set no longer contains it.
describe('Combobox (multiple + async queryFn)', () => {
  it('keeps a selected tag label after a later search drops that option', async () => {
    const user = userEvent.setup();
    const queryFn = vi.fn(
      async (q: string): Promise<Opt[]> =>
        q.startsWith('fo') ? [{ value: 'foo', label: 'Foo' }] : []
    );
    renderCombobox({ queryFn, debounceMs: 1, multiple: true, value: [] });

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'fo');
    await settle();
    flushSync();
    await user.click(option('Foo')); // pick → tag 'Foo', query cleared, tagCache seeded
    expect(removeTagBtn('Foo')).toBeTruthy();

    // A fresh search returns nothing → asyncOptions drops Foo; the tag must keep
    // its cached label, not fall back to the raw value 'foo'.
    await user.type(input, 'x');
    await settle();
    flushSync();
    expect(removeTagBtn('Foo')).toBeTruthy();
  });
});

// aria-describedby merge (parity with Select's d298d2c + Input). restProps land
// on the role-less wrapper <div>, so a consumer `aria-describedby` used to never
// reach the focusable <input>. It must now merge with the internal error/helper
// id chain — internal descriptions first, the consumer's supplemental one last —
// on the input itself.
describe('Combobox (aria-describedby merge)', () => {
  it('merges a consumer aria-describedby with the internal helper id (internal first) on the input', () => {
    renderCombobox({ options: OPTIONS, helper: 'Pick one', 'aria-describedby': 'external-hint' });

    const input = screen.getByRole('combobox');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    // Both the internal (helper) id and the consumer id are present.
    expect(ids).toHaveLength(2);
    expect(ids).toContain('external-hint');
    // Internal first, consumer last.
    expect(ids[ids.length - 1]).toBe('external-hint');
    const internalId = ids[0];
    expect(internalId).not.toBe('external-hint');
    // The internal id resolves to the rendered helper text — a live reference.
    expect(document.getElementById(internalId)?.textContent).toContain('Pick one');
    // The description reaches the input ALONE, not the wrapper it used to land on.
    const described = Array.from(document.querySelectorAll('[aria-describedby]'));
    expect(described).toHaveLength(1);
    expect(described[0]).toBe(input);
  });

  it('uses the consumer aria-describedby verbatim when there is no helper or error', () => {
    renderCombobox({ options: OPTIONS, 'aria-describedby': 'external-hint' });

    expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBe('external-hint');
  });
});

// Grouped {#each} key stability (mirrors Select). Two groups sharing a label must
// not collide on the key (was keyed on `group.label` → `each_key_duplicate`).
// Cross-boundary keyboard nav through the O(1) flat-index map is already covered
// by "flows keyboard navigation across group boundaries" above.
describe('Combobox (groups — stable key)', () => {
  it('renders both groups when two share the same label', () => {
    // Old `group.label` key throws `each_key_duplicate` on render; the positional
    // key renders both. open:true renders the keyed group list in the mount flush.
    renderCombobox({
      open: true,
      groups: [
        { label: 'Team', options: [{ value: 'a', label: 'Alice' }] },
        { label: 'Team', options: [{ value: 'b', label: 'Bob' }] }
      ]
    });
    expect(screen.getAllByRole('group', { name: 'Team', hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(2);
  });
});

// aria-label forwarding with a precedence gate (the Combobox analogue of Select's
// Fix 1). restProps land on the role-less wrapper <div>, so a consumer `aria-label`
// used to become an axe `aria-prohibited-attr` there. It must reach the focusable
// <input role="combobox"> — but ONLY when no visible `label` renders: the input is
// named via a native `<label for>` (LOWER ARIA precedence than aria-label), so an
// unconditional aria-label would override a visible label (the opposite of Select,
// which names via the higher-precedence aria-labelledby).
describe('Combobox (aria-label forwarding)', () => {
  it('forwards a consumer aria-label onto the input when no visible label renders, never the wrapper', () => {
    renderCombobox({ options: OPTIONS, 'aria-label': 'Search fruit' });

    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-label')).toBe('Search fruit');
    // The forwarded label lives on the input ALONE — the wrapper the restProps
    // used to catch it on stays clean (kills the aria-prohibited-attr).
    const labelled = Array.from(document.querySelectorAll('[aria-label="Search fruit"]'));
    expect(labelled).toHaveLength(1);
    expect(labelled[0]).toBe(input);
  });

  it('suppresses aria-label when a visible label renders, so the native <label for> wins', () => {
    renderCombobox({ options: OPTIONS, label: 'Fruit', 'aria-label': 'ignored' });

    const input = screen.getByRole('combobox');
    // Visible label present → aria-label is NOT emitted (it would override the
    // lower-precedence native association otherwise).
    expect(input.hasAttribute('aria-label')).toBe(false);
    expect(document.querySelector('[aria-label="ignored"]')).toBeNull();
    // The visible <label for> actually names the input.
    const nativeLabel = document.querySelector(`label[for="${input.id}"]`);
    expect(nativeLabel?.textContent).toContain('Fruit');
  });
});

// Orphan dev-warn dedup. The warn lives in the `selectedTags` $derived.by whose
// deps include the `options` reference, so a parent re-render passing a fresh
// `options` array (the common `options={items.map(…)}` idiom) used to re-fire
// it per recompute. The warned-values Set (deliberately outside the reactive
// graph) makes it exactly one warn per orphan value per instance. The `$state`
// proxy is handed to `mount` unspread so prop mutations reach the component
// (the Collapsible controlled-contract pattern).
describe('Combobox (orphan warn dedup)', () => {
  it('warns once per orphan value, not per re-render with a fresh options array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Typed as the multi arm (not the ComboboxProps union): TS types property
    // WRITES on a union as the intersection of the arms' property types, which
    // for `value` ((T | null) & T[]) nothing satisfies.
    const props = $state<ComboboxMultipleProps<string | number | boolean>>({
      options: [...OPTIONS],
      multiple: true,
      value: ['ghost']
    });
    const instance = mount(Combobox, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('ghost');

    // Parent re-render idiom: a NEW array reference (same content) invalidates
    // the derived — the warn must not re-fire for the same orphan.
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
});

describe('Combobox (validation frame)', () => {
  // The variant tests prove the frame EXISTS; these prove it is actually wired
  // — before this wave an invalid Combobox announced itself through
  // `aria-invalid` only and looked exactly like a valid one.
  it('paints the error frame on the single-mode input and flags it invalid', () => {
    renderCombobox({ options: OPTIONS, error: 'Pick a fruit' });
    const input = screen.getByRole('combobox');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('class')).toContain('border-danger');
    expect(input.getAttribute('class')).toContain('focus-visible:border-danger');
  });

  it('paints the error frame on the multi-mode tokenizer control', () => {
    const props = $state<ComboboxMultipleProps<string | number | boolean>>({
      options: [...OPTIONS],
      multiple: true,
      value: [],
      error: 'Pick a fruit'
    });
    const instance = mount(Combobox, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();

    // In multi mode the frame is the control div wrapping the search input.
    const control = screen.getByRole('combobox').parentElement as HTMLElement;
    expect(control.getAttribute('class')).toContain('border-danger');
    expect(control.getAttribute('class')).toContain('focus-within:border-danger');
  });

  it('keeps a helper message quiet and the frame neutral while valid', () => {
    renderCombobox({ options: OPTIONS, helper: 'Start typing to search' });
    const input = screen.getByRole('combobox');
    const helper = screen.getByText('Start typing to search');

    expect(input.getAttribute('aria-invalid')).toBe(null);
    expect(input.getAttribute('class')).not.toContain('border-danger');
    expect(helper.getAttribute('class')).toContain('text-text-tertiary');
    expect(helper.getAttribute('class')).not.toContain('text-danger');
  });

  it('renders the error message in the error tone', () => {
    renderCombobox({ options: OPTIONS, error: 'Pick a fruit' });
    const message = screen.getByRole('alert');

    expect(message.textContent?.trim()).toBe('Pick a fruit');
    expect(message.getAttribute('class')).toContain('text-danger');
  });

  // The option element is the one place in this component where three class
  // sources meet on one element: the `option` slot, and the `optionActive` /
  // `optionSelected` state slots. All three carry a `bg-*`, so the order they
  // reach `tv()` in decides which one paints, and a `slotClasses.option` has to
  // win it — the same rung order every other slot honours.
  it('lets a slotClasses.option beat the active state class it collides with', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: OPTIONS, slotClasses: { option: 'bg-white' } });

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');

    const classes = option('Apple').getAttribute('class')?.split(/\s+/) ?? [];
    expect(option('Apple').getAttribute('data-active')).toBe('true');
    expect(classes, 'the consumer entry arrived').toContain('bg-white');
    expect(classes, 'the state class lost its bucket').not.toContain('bg-surface-hover');
  });

  it('lets a slotClasses.optionActive beat slotClasses.option, and both beat the library', async () => {
    const user = userEvent.setup();
    renderCombobox({
      options: OPTIONS,
      slotClasses: { option: 'bg-white', optionActive: 'bg-black' }
    });

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');

    const classes = option('Apple').getAttribute('class')?.split(/\s+/) ?? [];
    expect(classes).toContain('bg-black');
    expect(classes).not.toContain('bg-white');
    expect(classes).not.toContain('bg-surface-hover');
  });
});
