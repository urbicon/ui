// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Collapsible from './Collapsible.svelte';
import type { CollapsibleProps } from './index';

// Interaction layer for Collapsible — the disclosure contract: a native
// <button aria-expanded> toggles a role=region, the controlled/uncontrolled
// open state, and the disabled guard. The collapse itself is CSS
// (grid-template-rows 0fr↔1fr), so the region is always in the DOM — these
// assert aria-expanded + the onOpenChange callback, not visual height.
//
// Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers. The `children`
// content snippet is built with createRawSnippet (like the Dialog suite).

const body = (text = 'Panel content'): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCollapsible(props: Partial<CollapsibleProps> = {}) {
  const instance = mount(Collapsible, {
    target: document.body,
    props: { title: 'Details', children: body(), ...props } as CollapsibleProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('button', { name: /Details/ });
const expanded = () => trigger().getAttribute('aria-expanded');

describe('Collapsible (component interaction)', () => {
  it('renders a collapsed trigger controlling a labelled region', () => {
    renderCollapsible();

    expect(expanded()).toBe('false');
    const region = screen.getByRole('region');
    // The trigger owns the region via aria-controls / aria-labelledby.
    expect(trigger().getAttribute('aria-controls')).toBe(region.id);
    expect(region.getAttribute('aria-labelledby')).toBe(trigger().id);
  });

  it('opens on click and fires onOpenChange(true)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderCollapsible({ onOpenChange });

    await user.click(trigger());

    expect(expanded()).toBe('true');
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('toggles closed again on a second click, reporting false', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderCollapsible({ onOpenChange });

    await user.click(trigger());
    await user.click(trigger());

    expect(expanded()).toBe('false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('toggles via the keyboard (native button Enter/Space)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderCollapsible({ onOpenChange });

    trigger().focus();
    await user.keyboard('{Enter}');
    expect(expanded()).toBe('true');

    await user.keyboard(' ');
    expect(expanded()).toBe('false');
  });

  it('reflects the controlled open prop', () => {
    renderCollapsible({ open: true });
    expect(expanded()).toBe('true');
  });

  it('starts open from defaultOpen when uncontrolled', () => {
    renderCollapsible({ defaultOpen: true });
    expect(expanded()).toBe('true');
  });

  it('does not toggle or fire the callback when disabled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderCollapsible({ disabled: true, onOpenChange });

    const el = trigger();
    expect(el.hasAttribute('disabled')).toBe(true);
    await user.click(el);

    expect(expanded()).toBe('false');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
