// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToastProps } from './index';
import Toaster from './Toaster.svelte';
import { toaster } from './toast.store.svelte';

// Interaction layer for the Toaster action/cancel buttons (TST-1). The store
// logic (promise/update) is covered in toast.store.test.ts; here we mount the
// renderer, push a toast through the store, and drive the buttons. Same stack as
// the other DOM tests: Svelte's own mount/unmount, @testing-library/dom + native
// matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  toaster.clear();
  document.body.replaceChildren();
});

function renderToaster(props: Partial<ToastProps> = {}) {
  const instance = mount(Toaster, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Toaster — action buttons', () => {
  it('renders the action button, fires its handler, and dismisses', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    renderToaster();

    toaster.add({ title: 'Deleted', action: { label: 'Undo', onClick: onUndo } });
    flushSync();

    const btn = screen.getByRole('button', { name: 'Undo' });
    await user.click(btn);

    expect(onUndo).toHaveBeenCalledOnce();
    // Default dismissOnClick removes the toast from the store. (The DOM node
    // lingers through the fly outro — jsdom never fires the WAAPI onfinish — so
    // assert on the store, the source of truth, not on DOM removal.)
    expect(toaster.toasts).toHaveLength(0);
  });

  it('keeps the toast open when the action opts out of dismiss', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderToaster();

    toaster.add({
      title: 'Failed',
      action: { label: 'Retry', onClick: onRetry, dismissOnClick: false }
    });
    flushSync();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('cancel button fires its handler and dismisses by default', async () => {
    const user = userEvent.setup();
    const onLater = vi.fn();
    renderToaster();

    toaster.add({ title: 'Update available', cancel: { label: 'Later', onClick: onLater } });
    flushSync();

    await user.click(screen.getByRole('button', { name: 'Later' }));

    expect(onLater).toHaveBeenCalledOnce();
    expect(toaster.toasts).toHaveLength(0);
  });
});

describe('Toaster — dismiss button & stacking', () => {
  it('renders a localized dismiss button that removes the toast from the store', async () => {
    const user = userEvent.setup();
    renderToaster();

    toaster.add({ title: 'Saved' });
    flushSync();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    // Store is the source of truth; the DOM node lingers through the fly outro
    // (jsdom never fires the WAAPI onfinish — see the action test above).
    expect(toaster.toasts).toHaveLength(0);
  });

  it('omits the dismiss button when the toast is not dismissible', () => {
    renderToaster();

    toaster.add({ title: 'Locked', dismissible: false });
    flushSync();

    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('renders at most `max` toasts, hiding the oldest first', () => {
    // Seed the store before mounting so the overflowed toast never renders —
    // no outro-lingering DOM node to trip the count.
    toaster.add({ title: 'first' });
    toaster.add({ title: 'second' });
    toaster.add({ title: 'third' });
    renderToaster({ max: 2 });

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.queryByText('first')).toBeNull();
    expect(screen.getByText('second')).toBeTruthy();
    expect(screen.getByText('third')).toBeTruthy();
    // The hidden toast stays queued in the store (only rendering is capped).
    expect(toaster.toasts).toHaveLength(3);
  });
});
