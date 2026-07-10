// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function renderToaster() {
  const instance = mount(Toaster, { target: document.body });
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
});
