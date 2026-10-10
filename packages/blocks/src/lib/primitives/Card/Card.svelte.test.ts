// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Card from './Card.svelte';
import type { CardProps } from './index';

// Render layer for Card's `disabled` state on each of the three elements it
// can be: the ARIA state it announces and whether a disabled link card can
// still be reached and followed.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const body = createRawSnippet(() => ({ render: () => '<p>Quarterly report</p>' }));

function render(props: Partial<CardProps> = {}) {
  const instance = mount(Card, {
    target: document.body,
    props: { children: body, ...props } as CardProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const root = () => document.body.firstElementChild as HTMLElement;

describe('Card (disabled)', () => {
  it('announces no ARIA state on a passive card, disabled or not', () => {
    // ARIA does not support `aria-disabled` on a generic element. A disabled
    // <div> card is dimmed and mouse-dead, and that is all it is.
    render();
    expect(root().tagName).toBe('DIV');
    expect(root().hasAttribute('aria-disabled')).toBe(false);

    dispose?.();
    document.body.replaceChildren();

    render({ disabled: true });
    expect(root().tagName).toBe('DIV');
    expect(root().hasAttribute('aria-disabled')).toBe(false);
    expect(root().className).toContain('pointer-events-none');
    expect(root().className).toContain('opacity-50');
  });

  it('does not bring aria-disabled back to a disabled passive card for a role of yours', () => {
    render({ disabled: true, role: 'group' });
    expect(root().getAttribute('role')).toBe('group');
    expect(root().hasAttribute('aria-disabled')).toBe(false);
  });

  it('keeps a tabindex and aria-disabled of yours on an enabled card and on a passive one', () => {
    render({ onclick: vi.fn(), tabindex: -1, 'aria-disabled': true });
    expect(root().tagName).toBe('BUTTON');
    expect(root().getAttribute('tabindex')).toBe('-1');
    expect(root().getAttribute('aria-disabled')).toBe('true');

    dispose?.();
    document.body.replaceChildren();

    // A role that supports `aria-disabled` takes the consumer's own.
    render({ disabled: true, role: 'group', tabindex: 0, 'aria-disabled': true });
    expect(root().tagName).toBe('DIV');
    expect(root().getAttribute('tabindex')).toBe('0');
    expect(root().getAttribute('aria-disabled')).toBe('true');
  });

  it('marks a disabled button card aria-disabled and an enabled one not at all', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    render({ onclick, disabled: true });
    expect(root().tagName).toBe('BUTTON');
    expect(root().getAttribute('aria-disabled')).toBe('true');

    // `aria-disabled`, not the native attribute: the button stays focusable
    // and its activation does nothing.
    await user.tab();
    expect(document.activeElement).toBe(root());
    await user.keyboard('{Enter}');
    expect(onclick).not.toHaveBeenCalled();

    dispose?.();
    document.body.replaceChildren();

    render({ onclick });
    expect(root().hasAttribute('aria-disabled')).toBe(false);
  });

  it('takes a disabled link card out of the tab order while keeping its address', async () => {
    const user = userEvent.setup();
    render({ href: '#reports-q3', disabled: true });

    expect(root().tagName).toBe('A');
    expect(root().getAttribute('aria-disabled')).toBe('true');
    expect(root().getAttribute('tabindex')).toBe('-1');
    expect(root().getAttribute('href')).toBe('#reports-q3');

    await user.tab();
    expect(document.activeElement).not.toBe(root());
  });

  it('keeps a disabled link card disabled against a tabindex and aria-disabled of yours', () => {
    render({ href: '#reports-q3', disabled: true, tabindex: 0, 'aria-disabled': false });
    expect(root().getAttribute('tabindex')).toBe('-1');
    expect(root().getAttribute('aria-disabled')).toBe('true');
  });

  it('cancels the navigation of a disabled link card that is clicked anyway', () => {
    // `pointer-events-none` only stops hit testing: assistive-technology
    // activation calls `element.click()` on the anchor whatever CSS says.
    const onclick = vi.fn();
    render({ href: '#reports-q3', disabled: true, onclick });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    root().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onclick).not.toHaveBeenCalled();
  });

  it('cancels a disabled link card activated by Enter from the keyboard', async () => {
    const user = userEvent.setup();
    render({ href: '#reports-q3', disabled: true });

    // Recorded on the way back up, after the card's own handler has run.
    const clicks: boolean[] = [];
    const record = (event: Event) => clicks.push(event.defaultPrevented);
    document.addEventListener('click', record);
    try {
      root().focus();
      await user.keyboard('{Enter}');
    } finally {
      document.removeEventListener('click', record);
    }

    expect(clicks).toEqual([true]);
  });

  it('leaves an enabled link card in the tab order and lets it navigate', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    render({ href: '#reports-q3', onclick });

    expect(root().hasAttribute('aria-disabled')).toBe(false);
    expect(root().hasAttribute('tabindex')).toBe(false);

    await user.tab();
    expect(document.activeElement).toBe(root());

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    root().dispatchEvent(event);
    expect(onclick).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });
});
