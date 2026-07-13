// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
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
  vi.useRealTimers();
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

/** The toaster region (the `aria-live` container the pause handlers sit on). */
function region() {
  return document.querySelector('[aria-live="polite"]') as HTMLElement;
}

/** The animated progress element of the first rendered toast. */
function progressBar() {
  return region().querySelector('[style*="blocks-toast-progress"]') as HTMLElement | null;
}

/** Read the progress bar's `animation-play-state`, tolerant of how jsdom stores inline style. */
function playState(el: HTMLElement) {
  return (
    el.style.animationPlayState ||
    el.getAttribute('style')?.match(/animation-play-state:\s*(\w+)/)?.[1] ||
    ''
  );
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

// Sonner-style hover-to-pause wiring. The region's bubbling pointer/focus
// handlers must freeze the store (which freezes the timers) and sync each
// progress bar's `animation-play-state`. Timing math itself is covered in
// toast.store.test.ts; here we assert the component drives the store + the DOM.
describe('Toaster — hover / focus to pause', () => {
  it('pointer over the region pauses (progress frozen + timer frozen); leaving resumes', () => {
    renderToaster();
    toaster.add({ title: 'Hover me', duration: 5000 }); // showProgress defaults true
    flushSync();

    const bar = progressBar();
    expect(bar).toBeTruthy();
    expect(toaster.paused).toBe(false);
    expect(playState(bar!)).toBe('running');

    fireEvent.pointerOver(region());
    flushSync();
    expect(toaster.paused).toBe(true); // store frozen → all auto-dismiss timers cleared
    expect(playState(bar!)).toBe('paused');

    fireEvent.pointerOut(region(), { relatedTarget: document.body });
    flushSync();
    expect(toaster.paused).toBe(false);
    expect(playState(bar!)).toBe('running');
  });

  it('does NOT resume when the pointer moves between elements inside the region', () => {
    renderToaster();
    toaster.add({ title: 'x', duration: 5000, action: { label: 'Undo' } });
    flushSync();

    fireEvent.pointerOver(region());
    flushSync();
    expect(toaster.paused).toBe(true);

    // pointerout whose relatedTarget is still inside the region (toast → its
    // action button) is not a real leave — the stack stays paused (no flicker).
    const undo = screen.getByRole('button', { name: 'Undo' });
    fireEvent.pointerOut(region(), { relatedTarget: undo });
    flushSync();
    expect(toaster.paused).toBe(true);
  });

  it('keyboard focus entering the region pauses; focus leaving resumes (a11y equivalent of hover)', () => {
    renderToaster();
    toaster.add({ title: 'x', duration: 5000, action: { label: 'Undo' } });
    flushSync();

    fireEvent.focusIn(region());
    flushSync();
    expect(toaster.paused).toBe(true);

    fireEvent.focusOut(region(), { relatedTarget: document.body });
    flushSync();
    expect(toaster.paused).toBe(false);
  });

  it('a hovered toast survives past its duration and dismisses from the remaining time on leave', () => {
    vi.useFakeTimers();
    renderToaster();
    toaster.add({ title: 'x', duration: 3000 });
    flushSync();

    vi.advanceTimersByTime(1500); // 1500ms left
    fireEvent.pointerOver(region());
    flushSync();

    // Frozen: blow past the original 3s expiry with the pointer still inside.
    vi.advanceTimersByTime(10_000);
    flushSync();
    expect(toaster.toasts).toHaveLength(1);

    fireEvent.pointerOut(region(), { relatedTarget: document.body });
    flushSync();
    vi.advanceTimersByTime(1500); // banked remainder elapses
    expect(toaster.toasts).toHaveLength(0);
  });
});
