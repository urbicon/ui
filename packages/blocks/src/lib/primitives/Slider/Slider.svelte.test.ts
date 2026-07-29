// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliderProps } from './index';
import Slider from './Slider.svelte';

// Interaction layer for Slider — the ARIA slider keyboard contract: Arrow keys
// step by `step`, PageUp/Down by 10×step, Home/End to the bounds, all clamped
// and step-snapped to [min, max]; range mode adds two thumbs that can't cross.
// The pointer-drag path is layout-driven (getBoundingClientRect), so jsdom (no
// layout) can't exercise it — that is Playwright's job. Keyboard is pure math on
// value/min/max/step, which a mounted DOM drives exactly.
//
// Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers. Slider is fully
// declarative (value/min/max/step props), so no composition fixture is needed.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderSlider(props: SliderProps = {}) {
  const instance = mount(Slider, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const slider = (name?: string) =>
  (name ? screen.getByRole('slider', { name }) : screen.getByRole('slider')) as HTMLElement;
const valueNow = (el: HTMLElement) => el.getAttribute('aria-valuenow');

describe('Slider (component interaction)', () => {
  it('renders a single slider whose aria-value* reflect value/min/max', () => {
    renderSlider({ value: 50, min: 0, max: 100, label: 'Volume' });

    const el = slider('Volume');
    expect(el.getAttribute('role')).toBe('slider');
    expect(valueNow(el)).toBe('50');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('100');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('increments by step on ArrowRight/ArrowUp and fires onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSlider({ value: 50, onValueChange });

    const el = slider();
    el.focus();
    await user.keyboard('{ArrowRight}');
    expect(valueNow(el)).toBe('51');
    expect(onValueChange).toHaveBeenLastCalledWith(51);

    await user.keyboard('{ArrowUp}');
    expect(valueNow(el)).toBe('52');
  });

  it('decrements by step on ArrowLeft/ArrowDown', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 50 });

    const el = slider();
    el.focus();
    await user.keyboard('{ArrowLeft}');
    expect(valueNow(el)).toBe('49');
    await user.keyboard('{ArrowDown}');
    expect(valueNow(el)).toBe('48');
  });

  it('jumps to min/max on Home/End', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 50, min: 0, max: 100 });

    const el = slider();
    el.focus();
    await user.keyboard('{End}');
    expect(valueNow(el)).toBe('100');
    await user.keyboard('{Home}');
    expect(valueNow(el)).toBe('0');
  });

  it('moves by 10×step on PageUp/PageDown', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 50, step: 1 });

    const el = slider();
    el.focus();
    await user.keyboard('{PageUp}');
    expect(valueNow(el)).toBe('60');
    await user.keyboard('{PageDown}');
    expect(valueNow(el)).toBe('50');
  });

  it('clamps at the max and min bounds', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 100, min: 0, max: 100 });

    const el = slider();
    el.focus();
    await user.keyboard('{ArrowRight}');
    expect(valueNow(el)).toBe('100'); // can't exceed max

    await user.keyboard('{Home}');
    await user.keyboard('{ArrowLeft}');
    expect(valueNow(el)).toBe('0'); // can't go below min
  });

  it('steps by a custom step size', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 50, step: 10 });

    const el = slider();
    el.focus();
    await user.keyboard('{ArrowRight}');
    expect(valueNow(el)).toBe('60');
  });

  it('does not respond to the keyboard when disabled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSlider({ value: 50, disabled: true, onValueChange });

    const el = slider();
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    el.focus();
    await user.keyboard('{ArrowRight}');

    expect(valueNow(el)).toBe('50');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('renders two labelled thumbs in range mode and steps the focused one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSlider({ value: [20, 80], range: true, label: 'Price', onValueChange });

    expect(screen.getAllByRole('slider')).toHaveLength(2);
    const start = slider('Price minimum');
    const end = slider('Price maximum');
    expect(valueNow(start)).toBe('20');
    expect(valueNow(end)).toBe('80');

    start.focus();
    await user.keyboard('{ArrowRight}');
    expect(valueNow(start)).toBe('21');
    expect(onValueChange).toHaveBeenLastCalledWith([21, 80]);
  });

  it('keeps the range start thumb from crossing past the end thumb', async () => {
    const user = userEvent.setup();
    renderSlider({ value: [79, 80], range: true, label: 'Price', step: 1 });

    const start = slider('Price minimum');
    start.focus();
    await user.keyboard('{ArrowRight}'); // 79 → 80 (meets end)
    expect(valueNow(start)).toBe('80');
    await user.keyboard('{ArrowRight}'); // would be 81, clamped to end (80)
    expect(valueNow(start)).toBe('80');
  });
});

describe('Slider (external aria-labelledby)', () => {
  // A slider thumb is a `role="slider"` div — not a labelable element, so an
  // external caption cannot reach it via `<label for>`. It has to name the
  // thumb through `aria-labelledby`, and restProps land on the roleless
  // wrapper div, so the component must thread it to the thumbs itself.
  function caption(id: string, text: string) {
    const el = document.createElement('span');
    el.id = id;
    el.textContent = text;
    document.body.append(el);
    return el;
  }

  it('names the single thumb from an external caption', () => {
    caption('pad-label', 'Padding');
    renderSlider({ value: 40, 'aria-labelledby': 'pad-label' });

    const el = slider('Padding');
    expect(el.getAttribute('aria-labelledby')).toBe('pad-label');
    // The generic fallback name must step aside, not stack with it.
    expect(el.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the generic aria-label when no external caption is given', () => {
    renderSlider({ value: 40 });

    const el = slider();
    expect(el.hasAttribute('aria-labelledby')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('Slider');
  });

  it('qualifies both range thumbs so an external caption does not name them identically', () => {
    caption('span-label', 'Range');
    renderSlider({ value: [20, 80], range: true, 'aria-labelledby': 'span-label' });

    // aria-labelledby concatenates its references in order → "Range Minimum" /
    // "Range Maximum", preserving the distinction the `label`-prop arm has.
    // (The qualifier reuses the standalone `accessibility.minimum` string, so
    // it is capitalised where the `label` arm reads "Volume minimum" — a
    // spoken name, so the casing is immaterial and no new i18n key is minted.)
    // Resolving these two names *is* the assertion: getByRole computes the
    // accessible name from the idref chain, so a miswired chain throws here.
    const start = slider('Range Minimum');
    const end = slider('Range Maximum');
    expect(start.getAttribute('aria-labelledby')).toMatch(/^span-label /);
    expect(end.getAttribute('aria-labelledby')).toMatch(/^span-label /);
    expect(start.hasAttribute('aria-label')).toBe(false);
    expect(end.hasAttribute('aria-label')).toBe(false);
  });
});

// Point 20b's third shape: a slider always holds a value, so it has no
// unselected state to paint danger — the error rides a ring on the thumb.
// Before this, `error` coloured only the sentence under the control.
describe('Slider (error marks the control, not just the message)', () => {
  const thumb = () => screen.getByRole('slider') as HTMLElement;

  it('rings the thumb when the value is in error', () => {
    renderSlider({ value: 40, error: 'Above your plan limit' });
    expect(thumb().className).toContain('ring-danger/60');
  });

  it('leaves the thumb unringed without an error', () => {
    renderSlider({ value: 40 });
    expect(thumb().className).not.toContain('ring-danger');
  });

  it('still colours the message', () => {
    renderSlider({ value: 40, error: 'Above your plan limit' });
    expect(screen.getByText('Above your plan limit').className).toContain('text-danger');
  });
});
