// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
