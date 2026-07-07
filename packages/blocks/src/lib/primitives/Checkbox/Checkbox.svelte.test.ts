// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.svelte';
import type { CheckboxProps } from './index';

// Interaction layer for Checkbox — a native `<input type="checkbox">` visually
// hidden (`sr-only`) behind a styled box. The native control owns click/Space
// toggling; what needs a mounted DOM is the component's own logic on top: the
// `indeterminate` third state (`aria-checked="mixed"`, the reflected
// `input.indeterminate` flag, and the "resets to unchecked on next user toggle"
// contract) plus reading the post-change value from `event.target.checked` so
// `onCheckedChange` reports the value the user just set.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCheckbox(props: CheckboxProps = {}) {
  const instance = mount(Checkbox, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

describe('Checkbox (component interaction)', () => {
  it('renders an unchecked checkbox labelled by its wrapping label', () => {
    renderCheckbox({ label: 'Accept terms' });

    const el = box('Accept terms');
    expect(el.checked).toBe(false);
    expect(el.getAttribute('aria-checked')).toBeNull();
  });

  it('checks on click and fires onCheckedChange(true)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', onCheckedChange });

    const el = box('Accept terms');
    await user.click(el);

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('unchecks on a second click, reporting false', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', checked: true, onCheckedChange });

    const el = box('Accept terms');
    expect(el.checked).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('toggles via the keyboard Space key', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', onCheckedChange });

    const el = box('Accept terms');
    el.focus();
    await user.keyboard(' ');

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('exposes the indeterminate state via aria-checked="mixed" and the input flag', () => {
    renderCheckbox({ label: 'Select all', indeterminate: true });

    const el = box('Select all');
    // aria-checked is only set explicitly for the mixed state; checked/unchecked
    // rely on the native property.
    expect(el.getAttribute('aria-checked')).toBe('mixed');
    // The $effect mirrors the prop onto the DOM property (no HTML attribute exists
    // for it), which is what actually paints the dash in a real browser.
    expect(el.indeterminate).toBe(true);
  });

  it('clears indeterminate and becomes checked on the next user toggle', async () => {
    // The documented "resets to unchecked on next user toggle" contract: handleChange
    // flips `indeterminate` off, then reads event.target.checked (true) — so the box
    // lands in a definite checked state and the callback reports it. A variant test
    // can't reach this because it needs a real change event.
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Select all', indeterminate: true, onCheckedChange });

    const el = box('Select all');
    await user.click(el);
    flushSync();

    expect(el.checked).toBe(true);
    expect(el.indeterminate).toBe(false);
    expect(el.getAttribute('aria-checked')).toBeNull();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle or fire the callback when disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', disabled: true, onCheckedChange });

    const el = box('Accept terms');
    expect(el.disabled).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('links an error message via role=alert and marks the input invalid', () => {
    renderCheckbox({ label: 'Accept terms', error: 'Required' });

    const el = box('Accept terms');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Required');
    // The error owns the describedby wiring so a screen reader announces it.
    expect(el.getAttribute('aria-describedby')).toBe(alert.id);
  });
});
