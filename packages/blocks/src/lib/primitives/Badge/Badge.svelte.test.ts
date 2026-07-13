// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Badge from './Badge.svelte';
import type { BadgeProps } from './index';

// The `purpose` axis (BDG-1) is orchestrated in the component (it maps to the
// existing tv() visual props), so it needs a mounted DOM to observe, not a
// variant-config test. Also guards back-compat: the deprecated `variant="dot"`
// and `counter` boolean must keep working when `purpose` is unset.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const label = (t = 'Badge') => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

function render(props: Partial<BadgeProps> = {}) {
  const instance = mount(Badge, {
    target: document.body,
    props: { children: label(), ...props } as BadgeProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const badge = () => screen.getByRole('status');

describe('Badge — purpose axis (BDG-1)', () => {
  it('reflects purpose on data-purpose', () => {
    render({ purpose: 'status', intent: 'success' });
    expect(badge().getAttribute('data-purpose')).toBe('status');
  });

  it('purpose="dot" hides content and applies dot styling, overriding variant', () => {
    render({ purpose: 'dot', variant: 'filled', children: label('hidden') });
    const el = badge();
    expect(el.className).toContain('border-none'); // dot-only base class
    expect(el.textContent).not.toContain('hidden'); // dot renders no content span
  });

  it('purpose="counter" applies the numeric-pill styling', () => {
    render({ purpose: 'counter', children: label('5') });
    expect(badge().className).toContain('tabular-nums');
  });

  it('purpose="chip" makes the badge interactive (focusable)', () => {
    render({ purpose: 'chip', children: label('React') });
    expect(badge().getAttribute('tabindex')).toBe('0');
  });

  it('back-compat: variant="dot" still renders a dot without purpose', () => {
    render({ variant: 'dot' });
    expect(badge().className).toContain('border-none');
  });

  it('back-compat: the counter boolean still applies the pill styling', () => {
    render({ counter: true, children: label('9') });
    expect(badge().className).toContain('tabular-nums');
  });
});

// Interaction layer: remove button, keyboard activation/removal, hover callback,
// and the disabled contract. Keyboard paths use fireEvent — the handlers hang on
// the badge span, and a direct keydown dispatch exercises exactly the wiring
// under test without a focus dance (the guards, not focus routing, are the
// subject; the remove *button* focusability is asserted separately).
describe('Badge — remove & interaction', () => {
  it('remove button fires onRemove without triggering the badge onclick', async () => {
    const onRemove = vi.fn();
    const onclick = vi.fn();
    render({ removable: true, onRemove, onclick, children: label('React') });

    const removeBtn = screen.getByRole('button', { name: 'Remove badge' });
    await userEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
    // handleRemove stops propagation — removing a chip must not also "click" it.
    expect(onclick).not.toHaveBeenCalled();
  });

  it('labels a removable badge and removes it via Delete/Backspace', () => {
    const onRemove = vi.fn();
    render({ removable: true, interactive: true, onRemove });

    const el = badge();
    expect(el.getAttribute('aria-label')).toBe('Removable badge');
    fireEvent.keyDown(el, { key: 'Delete' });
    fireEvent.keyDown(el, { key: 'Backspace' });
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it('Enter and Space activate an interactive badge', () => {
    const onclick = vi.fn();
    render({ onclick });

    // onclick alone makes the badge interactive (focusable).
    expect(badge().getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(badge(), { key: 'Enter' });
    fireEvent.keyDown(badge(), { key: ' ' });
    expect(onclick).toHaveBeenCalledTimes(2);
  });

  it('reports hover transitions through onHover', () => {
    const onHover = vi.fn();
    render({ onHover });

    fireEvent.mouseEnter(badge());
    expect(onHover).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(badge());
    expect(onHover).toHaveBeenLastCalledWith(false);
    expect(onHover).toHaveBeenCalledTimes(2);
  });

  it('disabled blocks pointer activation (JS guard, not just pointer-events CSS)', () => {
    const onclick = vi.fn();
    render({ onclick, disabled: true });

    // Direct dispatch bypasses pointer-events-none (jsdom computes no Tailwind
    // styles anyway) — the handleClick guard must hold on its own.
    fireEvent.click(badge());
    expect(onclick).not.toHaveBeenCalled();
  });

  it('disabled blocks keyboard activation and keyboard removal', () => {
    // Regression guard: handleKeydown lacked the disabled guard, so a disabled
    // badge was mouse-dead (pointer-events-none) but still keyboard-activatable.
    const onclick = vi.fn();
    const onRemove = vi.fn();
    render({ onclick, onRemove, removable: true, interactive: true, disabled: true });

    fireEvent.keyDown(badge(), { key: 'Enter' });
    fireEvent.keyDown(badge(), { key: ' ' });
    fireEvent.keyDown(badge(), { key: 'Delete' });
    fireEvent.keyDown(badge(), { key: 'Backspace' });
    expect(onclick).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('disabled removes the badge from the tab order and disables the remove button', () => {
    render({ removable: true, interactive: true, disabled: true, onRemove: vi.fn() });

    expect(badge().getAttribute('tabindex')).toBeNull();
    // The inner remove Button must be natively disabled — otherwise Tab still
    // reaches it and Enter removes a disabled badge.
    const removeBtn = screen.getByRole('button', { name: 'Remove badge' }) as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });
});
