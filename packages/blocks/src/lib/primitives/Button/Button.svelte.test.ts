// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Button from './Button.svelte';
import type { ButtonProps } from './index';

// Interaction layer for Button — the paths the variant tests deliberately can't
// reach: the loading-state activation guard (loading suppresses onclick WITHOUT
// hard-disabling the element, so it stays focusable and announces via
// aria-busy), the spinner/content slot wiring per loadingPlacement, and the
// pressed/active → aria-pressed reflection. Same stack as the Combobox pilot:
// Svelte's own `mount`/`unmount`, @testing-library/dom + user-event, native
// vitest matchers (no jest-dom). Selection behaviour inside a ButtonGroup is
// covered by ButtonGroup.svelte.test.ts (context registration needs a harness).

const label = (text = 'Save'): Snippet =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderButton(props: Partial<ButtonProps> = {}) {
  const instance = mount(Button, {
    target: document.body,
    props: { children: label(), ...props } as ButtonProps
  });
  dispose = () => unmount(instance);
  flushSync();
  return instance;
}

const button = () => screen.getByRole('button', { name: 'Save' });
// The two structural child spans: [0] spinner slot, [1] content slot.
const slots = () => {
  const spans = button().querySelectorAll<HTMLSpanElement>(':scope > span');
  return { spinner: spans[0], content: spans[1] };
};

describe('Button (component interaction)', () => {
  it('fires onclick with the mouse event and defaults to type="button"', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    renderButton({ onclick });

    expect(button().getAttribute('type')).toBe('button');
    await user.click(button());

    expect(onclick).toHaveBeenCalledOnce();
    expect(onclick).toHaveBeenCalledWith(expect.any(MouseEvent));
  });

  it('does not fire onclick when disabled', () => {
    const onclick = vi.fn();
    renderButton({ disabled: true, onclick });

    const el = button();
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBe('true');

    // fireEvent bypasses the native disabled activation suppression, so this
    // asserts the component-level guard in handleClick, not just the platform.
    fireEvent.click(el);
    expect(onclick).not.toHaveBeenCalled();
  });

  it('suppresses onclick while loading but keeps the button focusable (aria-busy, not disabled)', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    renderButton({ loading: true, onclick });

    const el = button();
    // Loading is a soft lock: announced via aria-busy, NOT via the disabled
    // attribute — the button must keep keyboard focus so focus doesn't drop to
    // body mid-submit.
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.hasAttribute('disabled')).toBe(false);
    el.focus();
    expect(document.activeElement).toBe(el);

    await user.click(el);
    await user.keyboard('{Enter}');
    expect(onclick).not.toHaveBeenCalled();
  });

  it('hides the spinner slot when idle', () => {
    renderButton({});
    const { spinner } = slots();
    expect(spinner.className).toContain('hidden');
    expect(spinner.getAttribute('aria-hidden')).toBe('true');
    expect(button().getAttribute('aria-busy')).toBe('false');
  });

  it('overlays the spinner and hides the content while loading (loadingPlacement=overlay)', () => {
    renderButton({ loading: true });
    const { spinner, content } = slots();
    expect(spinner.className).toContain('opacity-100');
    expect(spinner.className).toContain('absolute');
    expect(spinner.className).not.toContain('hidden');
    expect(content.className).toContain('opacity-0');
    // Content stays in the DOM (dimensions preserved) — only visually hidden.
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('orders the spinner before/after the content for start/end placement', () => {
    renderButton({ loading: true, loadingPlacement: 'start' });
    expect(slots().spinner.className).toContain('order-first');
    expect(slots().content.className).not.toContain('opacity-0');

    dispose?.();
    document.body.replaceChildren();
    renderButton({ loading: true, loadingPlacement: 'end' });
    expect(slots().spinner.className).toContain('order-last');
  });

  it('reflects pressed and active via aria-pressed, absent by default', () => {
    renderButton({});
    expect(button().hasAttribute('aria-pressed')).toBe(false);

    dispose?.();
    document.body.replaceChildren();
    renderButton({ pressed: true });
    expect(button().getAttribute('aria-pressed')).toBe('true');

    dispose?.();
    document.body.replaceChildren();
    renderButton({ active: true });
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('flattens the press sink when the mint is off, and keeps it for every other mint (#192)', () => {
    // The sink is a micro-interaction, so `mint` is its switch. It is steered by
    // rewriting the press token on the element — deliberately not by a variant
    // axis, which docs-gen would publish as a `<Button pressCue>` prop. The
    // `active:scale-[var(…)]` class therefore stays put in every case; what
    // changes is what the var resolves to.
    //
    // `mint="none"` is the only way to reach the off state here: the prop
    // defaults to 'scale', so an omitted mint is a mint. Any name other than
    // 'none' keeps the sink, even one whose effect is unrelated to movement.
    const flattened = () => button().className.includes('[--blocks-press-scale:1]');

    renderButton({ mint: 'none' });
    expect(flattened()).toBe(true);
    // The depth step is NOT silenced — a quiet button would otherwise report a
    // click with nothing at all on any path that skips hover.
    expect(button().className).toContain('active:shadow-[var(--blocks-shadow-sm)]');

    dispose?.();
    document.body.replaceChildren();

    renderButton({ mint: 'glow' });
    expect(flattened()).toBe(false);

    dispose?.();
    document.body.replaceChildren();

    renderButton({});
    expect(flattened()).toBe(false);
  });

  it('never leaks the press switch as a DOM attribute (#192)', () => {
    // Regression guard for the shape this fix deliberately avoids: a `pressCue`
    // tv() axis becomes a public prop that Button does not destructure, so it
    // reaches the element through restProps and stamps `presscue="false"` while
    // changing nothing.
    renderButton({ mint: 'none' });
    expect(button().getAttributeNames()).not.toContain('presscue');
  });

  it('leaves a consumer-set press scale alone (#192)', () => {
    // A utility class, not a `style:` directive: `style:--blocks-press-scale`
    // with an undefined value REMOVES the property from the style string
    // restProps spread in, which would delete exactly the override the token
    // reference documents. As a class it also loses to the inline value, which
    // is the right way round for an explicit consumer setting.
    renderButton({ mint: 'scale', style: 'color: rgb(1, 2, 3); --blocks-press-scale: 0.5' });
    expect(button().style.getPropertyValue('--blocks-press-scale')).toBe('0.5');
    expect(button().style.color).toBe('rgb(1, 2, 3)');
  });

  it('exposes the underlying element via getElement()', () => {
    const instance = renderButton({});
    expect(instance.getElement()).toBe(button());
  });
});

describe('Button (restProps-first contract, standalone)', () => {
  // restProps spreads FIRST (COMPONENT-API-CONVENTIONS §restProps ordering);
  // the merges after it must not delete consumer attributes outside a
  // selection group — an explicit `undefined` after a spread removes the
  // attribute, which is exactly what the migration had to avoid.

  it('keeps a consumer role and supplemental aria/data attributes from restProps', () => {
    renderButton({ role: 'link', 'aria-current': 'page', 'data-value': 'cta' });

    const el = screen.getByRole('link', { name: 'Save' });
    expect(el.getAttribute('role')).toBe('link');
    expect(el.getAttribute('aria-current')).toBe('page');
    // Outside a group, data-value has no internal owner → consumer's survives.
    expect(el.getAttribute('data-value')).toBe('cta');
  });

  it('keeps consumer toggle semantics (role="switch" + aria-checked) from restProps', () => {
    renderButton({ role: 'switch', 'aria-checked': 'true' });

    const el = screen.getByRole('switch', { name: 'Save' });
    expect(el.getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to a consumer aria-pressed only while the component has no pressed state', () => {
    renderButton({ 'aria-pressed': 'false' });
    expect(button().getAttribute('aria-pressed')).toBe('false');

    dispose?.();
    document.body.replaceChildren();
    // The modeled state wins: pressed=true beats a contradicting restProps value.
    renderButton({ pressed: true, 'aria-pressed': 'false' });
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('lets internal disabled/busy state win over contradicting restProps values', () => {
    renderButton({ disabled: true, 'aria-disabled': 'false' });
    expect(button().getAttribute('aria-disabled')).toBe('true');

    dispose?.();
    document.body.replaceChildren();
    renderButton({ loading: true, 'aria-busy': 'false' });
    expect(button().getAttribute('aria-busy')).toBe('true');
  });

  it('accepts consumer soft-state (aria-disabled/aria-busy) when the component is idle', () => {
    renderButton({ 'aria-disabled': 'true', 'aria-busy': 'true' });

    const el = button();
    // Soft-disable pattern: announced, but not hard-disabled by the component.
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.hasAttribute('disabled')).toBe(false);
  });
});
