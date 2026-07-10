// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NumberInputProps } from './index';
import NumberInput from './NumberInput.svelte';

// Interaction layer for NumberInput: stepper buttons, Arrow-key + wheel
// increment, min/max clamping, decimal-step float safety. Built on Input, so
// this also guards that Input actually forwards the numeric handlers. Same DOM
// stack as the other component tests (native mount, @testing-library/dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<NumberInputProps> = {}) {
  const instance = mount(NumberInput, { target: document.body, props: props as NumberInputProps });
  dispose = () => unmount(instance);
  flushSync();
}

const spin = () => screen.getByRole('spinbutton') as HTMLInputElement;
// The stepper buttons are aria-hidden (the spinbutton owns a11y), so query the DOM.
const steppers = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];

describe('NumberInput', () => {
  it('exposes spinbutton semantics with value/min/max', () => {
    render({ value: 5, min: 0, max: 10 });
    expect(spin().getAttribute('aria-valuenow')).toBe('5');
    expect(spin().getAttribute('aria-valuemin')).toBe('0');
    expect(spin().getAttribute('aria-valuemax')).toBe('10');
  });

  it('steps up and down by step via the stepper buttons', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: 5, step: 2, onValueChange });
    const [up, down] = steppers();

    await user.click(up);
    expect(onValueChange).toHaveBeenLastCalledWith(7);
    await user.click(down);
    expect(onValueChange).toHaveBeenLastCalledWith(5);
  });

  it('disables the up stepper at max', () => {
    render({ value: 10, min: 0, max: 10, step: 1 });
    const [up, down] = steppers();
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(false);
  });

  it('steps with ArrowUp / ArrowDown (Input forwards onkeydown)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: 3, step: 1, onValueChange });

    spin().focus();
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it('rounds a decimal step to the step scale (no float drift)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: 0.1, step: 0.2, onValueChange });

    await user.click(steppers()[0]);
    expect(onValueChange).toHaveBeenLastCalledWith(0.3); // not 0.30000000000000004
  });

  it('clamps typed input to max on blur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: null, min: 0, max: 100, onValueChange });

    const input = spin();
    await user.type(input, '250');
    expect(onValueChange).toHaveBeenLastCalledWith(250); // raw while typing
    await user.tab();
    flushSync();
    expect(onValueChange).toHaveBeenLastCalledWith(100); // clamped on blur
    expect(input.value).toBe('100');
  });

  it('accepts a comma as the decimal separator', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: null, onValueChange });

    await user.type(spin(), '1,5');
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
  });

  it('keeps the stepper clickable (pointer-events re-enabled inside Input decoration)', () => {
    // Input renders a right-side snippet in a `pointer-events-none` decoration
    // container, so the stepper wrapper must re-enable pointer events or the
    // buttons are dead to mouse in a real browser. jsdom can't observe the
    // computed value, so assert the class that restores it; real clickability is
    // an e2e concern.
    render({ value: 1 });
    expect(steppers()[0].parentElement?.classList.contains('pointer-events-auto')).toBe(true);
  });

  it('lands on the near bound when stepping from empty', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: null, min: 5, max: 9, step: 1, onValueChange });

    await user.click(steppers()[0]); // ↑ from empty → min, not min + step
    expect(onValueChange).toHaveBeenLastCalledWith(5);
  });

  it('lands on max when stepping down from empty', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: null, min: 5, max: 9, step: 1, onValueChange });

    await user.click(steppers()[1]); // ↓ from empty → max
    expect(onValueChange).toHaveBeenLastCalledWith(9);
  });

  it('does not step a readonly field via Arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: 5, step: 1, readonly: true, onValueChange });

    spin().focus();
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('formats to fixed precision', () => {
    render({ value: 1.5, precision: 2 });
    expect(spin().value).toBe('1.50');
  });

  it('rounds a sub-decimal (exponential) step on its own scale', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render({ value: 0, step: 1e-7, onValueChange });

    await user.click(steppers()[0]);
    // decimalsOf must read the exponent (1e-7 stringifies without a literal '.')
    // or the value rounds down to 0 decimals and the step is swallowed.
    expect(onValueChange).toHaveBeenLastCalledWith(1e-7);
  });
});
