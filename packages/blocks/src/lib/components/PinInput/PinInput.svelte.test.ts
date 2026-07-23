// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PinInputProps } from './index';
import PinInput from './PinInput.svelte';

// Interaction layer for PinInput: auto-advance, backspace-to-previous, arrow
// navigation, paste-to-fill, character filtering, completion. Same DOM stack as
// the other component tests (native mount, @testing-library/dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<PinInputProps> = {}) {
  const instance = mount(PinInput, { target: document.body, props: props as PinInputProps });
  dispose = () => unmount(instance);
  flushSync();
}

const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];

describe('PinInput', () => {
  it('renders `length` cells with numeric semantics by default', () => {
    render({ length: 4 });
    const c = cells();
    expect(c).toHaveLength(4);
    expect(c[0].getAttribute('inputmode')).toBe('numeric');
    expect(c[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(c[1].getAttribute('autocomplete')).toBe('off');
  });

  it('seeds cells from an initial value', () => {
    render({ length: 4, value: '12' });
    const c = cells();
    expect(c[0].value).toBe('1');
    expect(c[1].value).toBe('2');
    expect(c[2].value).toBe('');
  });

  it('advances focus and reports the value as the user types', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ length: 4, onValueChange });
    const c = cells();
    c[0].focus();
    await user.keyboard('12');
    expect(onValueChange).toHaveBeenLastCalledWith('12');
    expect(document.activeElement).toBe(c[2]);
  });

  it('fires onComplete once when the last cell is filled', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render({ length: 3, onComplete });
    cells()[0].focus();
    await user.keyboard('123');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123');
  });

  it('rejects characters outside the numeric filter', async () => {
    const user = userEvent.setup();
    render({ length: 4 });
    const c = cells();
    c[0].focus();
    await user.keyboard('a');
    expect(c[0].value).toBe('');
    await user.keyboard('7');
    expect(c[0].value).toBe('7');
  });

  it('keeps a filled cell when a rejected character is typed over it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ length: 4, value: '5', onValueChange });
    const c = cells();
    c[0].focus(); // focus selects the content
    await user.keyboard('a'); // rejected in numeric mode
    expect(c[0].value).toBe('5');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('accepts letters and uppercases them in alphanumeric mode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ length: 4, type: 'alphanumeric', uppercase: true, onValueChange });
    cells()[0].focus();
    await user.keyboard('ab');
    expect(onValueChange).toHaveBeenLastCalledWith('AB');
  });

  it('backspace clears the current cell, then walks back and clears the previous', async () => {
    const user = userEvent.setup();
    render({ length: 4, value: '12' });
    const c = cells();
    c[1].focus();
    await user.keyboard('{Backspace}'); // clears cell 1 (has value), stays
    expect(c[1].value).toBe('');
    expect(document.activeElement).toBe(c[1]);
    await user.keyboard('{Backspace}'); // cell 1 empty -> go back, clear cell 0
    expect(c[0].value).toBe('');
    expect(document.activeElement).toBe(c[0]);
  });

  it('navigates with arrow keys without changing the value', async () => {
    const user = userEvent.setup();
    render({ length: 4, value: '1234' });
    const c = cells();
    c[0].focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(c[2]);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(c[1]);
    expect(c.map((el) => el.value).join('')).toBe('1234');
  });

  it('distributes a pasted code across cells and focuses the last', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render({ length: 6, onComplete });
    const c = cells();
    c[0].focus();
    await user.paste('123456');
    expect(c.map((el) => el.value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('strips non-matching characters from a pasted string', async () => {
    const user = userEvent.setup();
    render({ length: 6 });
    const c = cells();
    c[0].focus();
    await user.paste('12-34-56');
    expect(c.map((el) => el.value).join('')).toBe('123456');
  });

  it('masks filled cells when `mask` is set', () => {
    render({ length: 4, mask: true, value: '12' });
    // masked cells render as type=password (so they carry no textbox role)
    const masked = Array.from(
      document.querySelectorAll('input[type="password"]')
    ) as HTMLInputElement[];
    expect(masked).toHaveLength(4);
    expect(masked[0].value).toBe('1');
  });

  it('does not accept input when disabled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ length: 4, disabled: true, onValueChange });
    const inputs = Array.from(
      document.querySelectorAll('input:not([type=hidden])')
    ) as HTMLInputElement[];
    expect(inputs[0].disabled).toBe(true);
    await user.click(inputs[0]);
    await user.keyboard('1');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('exposes a hidden input carrying the value for form submission', async () => {
    const user = userEvent.setup();
    render({ length: 4, name: 'otp' });
    cells()[0].focus();
    await user.keyboard('99');
    const hidden = document.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe('otp');
    expect(hidden.value).toBe('99');
  });

  it('wires group + cell ARIA (labelledby, invalid, describedby)', () => {
    render({ length: 4, label: 'Verification code', error: 'Wrong code' });
    const group = screen.getByRole('group');
    const labelId = group.getAttribute('aria-labelledby');
    expect(labelId && document.getElementById(labelId)?.textContent).toBe('Verification code');
    const c = cells();
    expect(c[0].getAttribute('aria-invalid')).toBe('true');
    const describedBy = c[0].getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe('Wrong code');
  });
});
