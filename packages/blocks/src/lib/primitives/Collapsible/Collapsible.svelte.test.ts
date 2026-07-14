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

// The open-state family contract (COMPONENT-API-CONVENTIONS.md §Open-state
// vocabulary): transitions are applied optimistically — `open` is written
// *before* `onOpenChange` fires. A `$state` proxy passed as mount props gives
// the child's bindable write somewhere to land, i.e. the bind:open path;
// a plain props object is the controlled-without-bind path. The proxy must be
// handed to `mount` as-is — spreading it (renderCollapsible) would sever the
// write-back.
function mountCollapsible(props: CollapsibleProps) {
  const instance = mount(Collapsible, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Collapsible (controlled contract)', () => {
  it('bind:open — the optimistic write propagates; parent writes are not echoed', async () => {
    const user = userEvent.setup();
    const seen: Array<{ next: boolean; propAtCall: boolean }> = [];
    const props = $state({
      title: 'Details',
      children: body(),
      open: false,
      onOpenChange: (next: boolean) => seen.push({ next, propAtCall: props.open })
    });
    mountCollapsible(props);

    await user.click(trigger());
    // The bindable write happened before the callback and reached the parent.
    expect(seen).toEqual([{ next: true, propAtCall: true }]);
    expect(props.open).toBe(true);
    expect(expanded()).toBe('true');

    // A consumer write via bind:open updates the view but never re-announces.
    props.open = false;
    flushSync();
    expect(expanded()).toBe('false');
    expect(seen).toHaveLength(1);
  });

  it('bind:open — a veto (writing the previous value back in onOpenChange) reverts', async () => {
    const user = userEvent.setup();
    const props = $state({
      title: 'Details',
      children: body(),
      open: false,
      onOpenChange: () => {
        props.open = false; // reject every open attempt
      }
    });
    mountCollapsible(props);

    await user.click(trigger());
    expect(props.open).toBe(false);
    expect(expanded()).toBe('false');
  });

  it('controlled without bind — toggles optimistically; the consumer must mirror onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    // Plain (non-reactive) props object: the parent's source of truth stays
    // `false` because nothing mirrors the callback — the component still shows
    // the new state. Exactly the divergence the documented contract forbids.
    renderCollapsible({ open: false, onOpenChange });

    await user.click(trigger());
    expect(expanded()).toBe('true');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
