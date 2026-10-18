// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage, restoreStorage } from '../../../../../../scripts/vitest-storage';
import Input from './Input.svelte';
import type { InputProps } from './index';

// Interaction layer for Input — clearable (click + Escape clear, onClear,
// focus return), the icon-button callbacks (onLeftIconClick/onRightIconClick +
// their disabled guard), and the consumer-handler passthrough: Input hardcodes
// its own onkeydown on the element, and an earlier regression swallowed the
// consumer's handler (fixed by forwarding userOnKeydown) — these tests pin
// that. Same stack as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom).
// The clear button's accessible name is the package i18n default
// ('accessibility.clearInput' → "Clear input", EN base locale, no provider).

const icon = (testId: string): Snippet =>
  createRawSnippet(() => ({ render: () => `<svg data-testid="${testId}"></svg>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderInput(props: Partial<InputProps> = {}) {
  const instance = mount(Input, { target: document.body, props: props as InputProps });
  dispose = () => unmount(instance);
  flushSync();
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const clearButton = () => screen.getByRole('button', { name: 'Clear input' });
const queryClearButton = () => screen.queryByRole('button', { name: 'Clear input' });

describe('Input (clearable)', () => {
  it('clears on click: empties the value, fires onClear, and returns focus to the input', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderInput({ clearable: true, value: 'hello', onClear });

    await user.click(clearButton());

    expect(input().value).toBe('');
    expect(onClear).toHaveBeenCalledOnce();
    // Focus must land back in the field so the user can keep typing — not be
    // stranded on the (now removed) clear button.
    expect(document.activeElement).toBe(input());
    expect(queryClearButton()).toBeNull();
  });

  it('shows the clear button only once the input has a value', async () => {
    const user = userEvent.setup();
    renderInput({ clearable: true });

    expect(queryClearButton()).toBeNull();
    await user.type(input(), 'abc');
    expect(queryClearButton()).toBeTruthy();
  });

  it('clears on Escape while still forwarding the keydown to the consumer handler', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onkeydown = vi.fn();
    renderInput({ clearable: true, value: 'abc', onClear, onkeydown });

    await user.click(input());
    await user.keyboard('{Escape}');

    expect(input().value).toBe('');
    expect(onClear).toHaveBeenCalledOnce();
    // The Escape-clear path must not swallow the consumer's onkeydown either.
    expect(onkeydown).toHaveBeenCalledOnce();
  });

  it('does not show the clear button when disabled or readonly', () => {
    renderInput({ clearable: true, value: 'abc', readonly: true });
    expect(queryClearButton()).toBeNull();

    dispose?.();
    document.body.replaceChildren();
    renderInput({ clearable: true, value: 'abc', disabled: true });
    expect(queryClearButton()).toBeNull();
  });

  it('replaces the right icon with the clear button while a value is present', async () => {
    const user = userEvent.setup();
    const onRightIconClick = vi.fn();
    renderInput({
      clearable: true,
      rightIcon: icon('right-icon'),
      onRightIconClick,
      rightIconAriaLabel: 'Toggle visibility'
    });

    // Empty → the consumer's right-icon button is live.
    await user.click(screen.getByRole('button', { name: 'Toggle visibility' }));
    expect(onRightIconClick).toHaveBeenCalledOnce();

    await user.type(input(), 'x');
    expect(screen.queryByRole('button', { name: 'Toggle visibility' })).toBeNull();
    expect(clearButton()).toBeTruthy();

    // Clearing brings the consumer icon back.
    await user.click(clearButton());
    expect(screen.getByRole('button', { name: 'Toggle visibility' })).toBeTruthy();
  });
});

describe('Input (icon buttons)', () => {
  it('renders the left icon as a labelled button when onLeftIconClick is set, and fires it', async () => {
    const user = userEvent.setup();
    const onLeftIconClick = vi.fn();
    renderInput({ leftIcon: icon('left-icon'), onLeftIconClick, leftIconAriaLabel: 'Search' });

    const btn = screen.getByRole('button', { name: 'Search' });
    expect(btn.querySelector('[data-testid="left-icon"]')).toBeTruthy();
    await user.click(btn);
    expect(onLeftIconClick).toHaveBeenCalledOnce();
  });

  it('renders the left icon as plain decoration (no button) without a click handler', () => {
    renderInput({ leftIcon: icon('left-icon') });
    expect(screen.getByTestId('left-icon')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not fire icon callbacks while the input is disabled', () => {
    const onLeftIconClick = vi.fn();
    renderInput({
      leftIcon: icon('left-icon'),
      onLeftIconClick,
      leftIconAriaLabel: 'Search',
      disabled: true
    });

    const btn = screen.getByRole('button', { name: 'Search' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    // fireEvent bypasses native disabled suppression → asserts the handler's
    // own `!disabled` guard, not just the platform behaviour.
    fireEvent.click(btn);
    expect(onLeftIconClick).not.toHaveBeenCalled();
  });
});

describe('Input (id / external label association)', () => {
  // Input used to hardcode `input-${propsId}` as its field id, silently
  // discarding a consumer-supplied `id` (it arrived via restProps but was
  // overwritten by the hardcoded `id=` further down the element). That broke
  // every consumer pairing an Input with an external `<label for>` — the label
  // pointed at nothing. These pin the two-step `$props.id()` contract.
  function externalLabel(htmlFor: string, text: string) {
    const label = document.createElement('label');
    label.setAttribute('for', htmlFor);
    label.textContent = text;
    document.body.append(label);
    return label;
  }

  it('applies a consumer-supplied id to the input itself', () => {
    renderInput({ id: 'email-field' });
    expect(input().id).toBe('email-field');
  });

  it('associates an external <label for> with the input and focuses it on click', async () => {
    const user = userEvent.setup();
    const label = externalLabel('email-field', 'Email');
    renderInput({ id: 'email-field' });

    // The DOM's own view of the association — this is what a dead `for` breaks.
    expect(label.control).toBe(input());
    expect(Array.from(input().labels ?? [])).toContain(label);
    // ...and the association is what makes the label clickable-to-focus.
    await user.click(label);
    expect(document.activeElement).toBe(input());
  });

  it('derives the error/helper description ids from the supplied id', () => {
    renderInput({ id: 'email-field', error: 'Required' });
    expect(input().getAttribute('aria-describedby')).toBe('email-field-error');
    expect(document.getElementById('email-field-error')?.textContent?.trim()).toBe('Required');
  });

  it('still generates a stable id (label and input agree) when none is supplied', () => {
    renderInput({ label: 'Email' });

    const generated = input().id;
    // No consumer id → the component owns it: non-empty, and the internal
    // label must resolve to the very same input.
    expect(generated).toBeTruthy();
    expect(generated.startsWith('input-')).toBe(true);
    expect(screen.getByText('Email').getAttribute('for')).toBe(generated);
  });
});

describe('Input (consumer handler passthrough)', () => {
  it('forwards regular keydown events to the consumer handler (regression: onkeydown swallow)', async () => {
    const user = userEvent.setup();
    const onkeydown = vi.fn();
    renderInput({ onkeydown });

    await user.type(input(), 'ab');

    expect(onkeydown).toHaveBeenCalledTimes(2);
    expect((onkeydown.mock.calls[0][0] as KeyboardEvent).key).toBe('a');
    expect(input().value).toBe('ab');
  });
});

describe('Input (persistence)', () => {
  // The auto-save is debounced; fake timers decide when it lands. The field is
  // written through an `input` event rather than user-event, whose own delays
  // would wait on the frozen clock.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Unmounting writes a save still pending, so it has to reach the storage
    // this test installed — before the restore, not after it.
    dispose?.();
    dispose = undefined;
    vi.useRealTimers();
    restoreStorage();
    vi.restoreAllMocks();
  });

  /** A memory storage that also records every write, in order. */
  function recordingStorage(seed?: Record<string, string>) {
    const storage = installMemoryStorage('localStorage', seed);
    const writes: Array<[string, string]> = [];
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      writes.push([key, value]);
      setItem(key, value);
    };
    return { storage, writes };
  }

  function typeText(text: string) {
    input().value = text;
    fireEvent.input(input());
    flushSync();
  }

  function remount(props: Partial<InputProps>) {
    dispose?.();
    document.body.replaceChildren();
    renderInput(props);
  }

  it('restores a stored empty value over the consumer value', () => {
    const { storage } = recordingStorage({ urbicon_note_v1: '""' });
    renderInput({ persistKey: 'note', value: 'Hallo' });

    // The user cleared the field; a reload must not bring the default back.
    expect(input().value).toBe('');
    vi.advanceTimersByTime(1000);
    expect(storage.getItem('urbicon_note_v1')).toBe('""');
  });

  it('writes the consumer value once when nothing is stored, and restores it next time', () => {
    const { writes } = recordingStorage();
    renderInput({ persistKey: 'note', value: 'Hallo' });
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([['urbicon_note_v1', '"Hallo"']]);

    remount({ persistKey: 'note', value: 'Servus' });
    vi.advanceTimersByTime(1000);

    expect(input().value).toBe('Hallo');
    expect(writes).toHaveLength(1);
  });

  it('creates no entry for a field nobody typed into', () => {
    const { writes } = recordingStorage();
    renderInput({ persistKey: 'note' });
    vi.advanceTimersByTime(1000);

    dispose?.();
    dispose = undefined;
    // An entry for '' would read as "the user cleared this" and beat every
    // `value` the consumer passes from then on.
    expect(writes).toEqual([]);
  });

  it('persists typing and clearing, and a cleared field stays cleared', () => {
    const { storage } = recordingStorage();
    renderInput({ persistKey: 'note', value: 'Hallo', clearable: true });

    typeText('abc');
    vi.advanceTimersByTime(1000);
    expect(storage.getItem('urbicon_note_v1')).toBe('"abc"');

    fireEvent.click(clearButton());
    flushSync();
    vi.advanceTimersByTime(1000);
    expect(storage.getItem('urbicon_note_v1')).toBe('""');

    remount({ persistKey: 'note', value: 'Hallo' });
    expect(input().value).toBe('');
  });

  it('writes a save still pending when the field unmounts', () => {
    const { storage } = recordingStorage();
    renderInput({ persistKey: 'note' });

    typeText('last words');
    dispose?.();
    dispose = undefined;

    expect(storage.getItem('urbicon_note_v1')).toBe('"last words"');
  });

  it('switches to the new key at runtime and leaves the old one alone', () => {
    const { storage, writes } = recordingStorage({ urbicon_b_v1: '"from b"' });
    const props = $state<Partial<InputProps>>({ persistKey: 'a' });
    const instance = mount(Input, { target: document.body, props: props as InputProps });
    dispose = () => unmount(instance);
    flushSync();

    // Typed under `a` and still inside the debounce when the key changes.
    typeText('typed in a');
    props.persistKey = 'b';
    flushSync();

    // The pending text landed under the key it was typed for, and the field
    // now shows what `b` holds.
    expect(storage.getItem('urbicon_a_v1')).toBe('"typed in a"');
    expect(input().value).toBe('from b');

    writes.length = 0;
    typeText('typed in b');
    vi.advanceTimersByTime(1000);

    // One live instance: nothing reaches `a` after the switch — no timer of
    // the replaced instance, no write routed to it.
    expect(writes).toEqual([['urbicon_b_v1', '"typed in b"']]);
    expect(storage.getItem('urbicon_a_v1')).toBe('"typed in a"');
  });

  it('lets the consumer value win over an entry that is not a stored string', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    recordingStorage({ urbicon_junk_v1: '{not json', urbicon_number_v1: '5' });

    renderInput({ persistKey: 'junk', value: 'Hallo' });
    expect(input().value).toBe('Hallo');

    remount({ persistKey: 'number', value: 'Hallo' });
    expect(input().value).toBe('Hallo');
  });

  it('deletes the entry of a lower persistVersion and starts from the consumer value', () => {
    const { storage } = recordingStorage({ urbicon_note_v1: '"old"' });
    renderInput({ persistKey: 'note', persistVersion: 2, value: 'Hallo' });
    vi.advanceTimersByTime(1000);

    expect(input().value).toBe('Hallo');
    expect(storage.getItem('urbicon_note_v1')).toBe(null);
    expect(storage.getItem('urbicon_note_v2')).toBe('"Hallo"');
  });
});
