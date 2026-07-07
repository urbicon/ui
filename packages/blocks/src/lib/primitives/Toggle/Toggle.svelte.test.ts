// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToggleProps } from './index';
import Toggle from './Toggle.svelte';

// Interaction layer for Toggle — a native `<input type="checkbox" role="switch">`
// visually hidden (`sr-only`) behind a styled track. The browser owns the toggle
// mechanics (click, Space); what only a mounted DOM test can verify is the
// component's own `onCheckedChange` contract: the JSDoc promises the callback
// "receives the new checked value", which hinges on reading the *post-change*
// state, not a stale binding. That timing is exactly what a variant test can't see.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom). The
// input is `sr-only` (visually hidden, not a11y-hidden), so `getByRole('switch')`
// finds it without `{ hidden: true }` — jsdom applies no stylesheet, so it is a
// plain focusable control here.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderToggle(props: ToggleProps = {}) {
  const instance = mount(Toggle, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const toggle = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement;

describe('Toggle (component interaction)', () => {
  it('renders a switch labelled by its wrapping label, unchecked by default', () => {
    renderToggle({ label: 'Wireless' });

    const el = toggle('Wireless');
    expect(el.getAttribute('role')).toBe('switch');
    expect(el.checked).toBe(false);
    expect(el.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles on click and fires onCheckedChange with the NEW value', async () => {
    // The contract discriminator: onCheckedChange must report `true` on the
    // first click, not the pre-change `false`. handleChange reads the bound
    // `checked` state, so this fails if the binding hasn't propagated when the
    // user `onchange` runs — the same timing Checkbox guards by reading
    // event.target.checked. A stale read would call the callback with `false`.
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    await user.click(el);

    expect(el.checked).toBe(true);
    expect(el.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles back off on a second click, reporting false', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    await user.click(el);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('toggles via the keyboard Space key (native switch activation)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    el.focus();
    expect(document.activeElement).toBe(el);

    await user.keyboard(' ');

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle or fire the callback when disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', disabled: true, onCheckedChange });

    const el = toggle('Wireless');
    expect(el.disabled).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('falls back to an accessible name when no label is given', () => {
    renderToggle({});
    // Without a label the input carries an explicit aria-label ('Toggle' EN
    // fallback), so it still exposes an accessible name to assistive tech.
    expect(screen.getByRole('switch')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-label')).toBeTruthy();
  });
});
