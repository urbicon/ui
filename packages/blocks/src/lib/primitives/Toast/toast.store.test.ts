import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from './toast.store.svelte';

// Store-level tests for the Sonner-style extensions (TST-1): action/cancel
// fields, `update()` in-place mutation, and `promise()` lifecycle. No DOM — the
// store is a plain reactive module; the `$state` array is read back directly
// after each mutation. The button rendering + click→dismiss wiring lives in the
// Toaster component and is covered by svelte-check + the runAction helper.

const settle = () => new Promise((r) => setTimeout(r, 0));
const byId = (id: string) => toaster.toasts.find((t) => t.id === id);

afterEach(() => {
  toaster.clear();
  vi.useRealTimers();
});

describe('toaster store — actions, update & promise (TST-1)', () => {
  it('carries action/cancel/loading through add()', () => {
    const onClick = vi.fn();
    const id = toaster.add({
      title: 'Deleted',
      action: { label: 'Undo', onClick },
      cancel: { label: 'Dismiss' },
      loading: false
    });
    const t = byId(id)!;
    expect(t.action?.label).toBe('Undo');
    expect(t.cancel?.label).toBe('Dismiss');
  });

  it('update() merges fields in place, preserving id and stack position', () => {
    const a = toaster.add({ title: 'A' });
    const b = toaster.add({ title: 'B' });

    toaster.update(a, { title: 'A2', intent: 'success' });

    expect(toaster.toasts[0].id).toBe(a); // still first
    expect(toaster.toasts[0].title).toBe('A2');
    expect(toaster.toasts[0].intent).toBe('success');
    expect(toaster.toasts[1].id).toBe(b);
  });

  it('update() is a no-op for an unknown id', () => {
    toaster.add({ title: 'A' });
    expect(() => toaster.update('nope', { title: 'x' })).not.toThrow();
    expect(toaster.toasts).toHaveLength(1);
  });

  it('promise(): pending is a persistent spinner toast, resolve flips it to success in place', async () => {
    let resolve!: (v: string) => void;
    const p = new Promise<string>((r) => {
      resolve = r;
    });
    const id = toaster.promise(p, {
      loading: 'Saving…',
      success: (v) => `Saved ${v}`,
      error: 'Failed'
    });

    let t = byId(id)!;
    expect(t.loading).toBe(true);
    expect(t.title).toBe('Saving…');
    expect(t.dismissible).toBe(false);
    expect(t.duration).toBe(0);

    resolve('draft');
    await settle();

    t = byId(id)!;
    // Same toast id (flipped in place, not replaced).
    expect(t.loading).toBe(false);
    expect(t.intent).toBe('success');
    expect(t.title).toBe('Saved draft');
    expect(t.dismissible).toBe(true);
    expect(t.duration).toBeGreaterThan(0);
  });

  it('promise(): reject flips it to danger via the error function', async () => {
    const p = Promise.reject(new Error('boom'));
    const id = toaster.promise(p, {
      loading: 'Working…',
      success: 'Done',
      error: (e) => `Oops: ${(e as Error).message}`
    });

    await settle();

    const t = byId(id)!;
    expect(t.intent).toBe('danger');
    expect(t.title).toBe('Oops: boom');
    expect(t.loading).toBe(false);
  });

  it('promise(): loading description is cleared when the success config omits one', async () => {
    const p = Promise.resolve('ok');
    const id = toaster.promise(p, {
      loading: { title: 'Uploading', description: '0%' },
      success: 'Uploaded',
      error: 'Failed'
    });
    await settle();
    const t = byId(id)!;
    expect(t.title).toBe('Uploaded');
    expect(t.description).toBeUndefined();
  });

  it('promise(): a throwing success formatter still settles the toast (no unhandled rejection)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = Promise.resolve('draft');
    const id = toaster.promise(p, {
      loading: 'Saving…',
      success: () => {
        throw new Error('formatter boom');
      },
      error: 'Failed'
    });
    await settle();
    const t = byId(id)!;
    // Without the guard the throw skips `update`, stranding the toast in loading.
    expect(t.loading).toBe(false);
    expect(t.intent).toBe('success');
    expect(t.duration).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('promise(): a throwing error formatter still settles the toast to danger', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = Promise.reject(new Error('boom'));
    const id = toaster.promise(p, {
      loading: 'Working…',
      success: 'Done',
      error: () => {
        throw new Error('formatter boom');
      }
    });
    await settle();
    const t = byId(id)!;
    expect(t.loading).toBe(false);
    expect(t.intent).toBe('danger');
    warn.mockRestore();
  });
});

// Auto-dismiss timer lifecycle, driven deterministically with fake timers.
// (afterEach above restores real timers and clears the store.)
describe('toaster store — auto-dismiss timers', () => {
  it('auto-dismisses a toast exactly when its duration elapses', () => {
    vi.useFakeTimers();
    const id = toaster.add({ title: 'Bye', duration: 3000 });

    vi.advanceTimersByTime(2999);
    expect(byId(id)).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(byId(id)).toBeUndefined();
  });

  it('duration: 0 creates a persistent toast with no timer', () => {
    vi.useFakeTimers();
    const id = toaster.add({ title: 'Stay', duration: 0 });

    vi.advanceTimersByTime(60_000);
    expect(byId(id)).toBeTruthy();
  });

  it('update() restarts the auto-dismiss clock from the new duration', () => {
    vi.useFakeTimers();
    const id = toaster.add({ title: 'A', duration: 3000 });

    vi.advanceTimersByTime(2000);
    toaster.update(id, { title: 'A2', duration: 3000 });

    // The original timer would have fired at t=3000 — the reset one at t=5000.
    vi.advanceTimersByTime(2999);
    expect(byId(id)).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(byId(id)).toBeUndefined();
  });

  it('update() to duration 0 cancels auto-dismiss entirely', () => {
    vi.useFakeTimers();
    const id = toaster.add({ title: 'A', duration: 3000 });

    toaster.update(id, { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(byId(id)).toBeTruthy();
  });

  it('manual dismiss clears the pending timer without disturbing others', () => {
    vi.useFakeTimers();
    const a = toaster.add({ title: 'A', duration: 3000 });
    const b = toaster.add({ title: 'B', duration: 5000 });

    toaster.dismiss(a);
    expect(byId(a)).toBeUndefined();

    // B's timer still fires on its own schedule; A's stale timer does nothing.
    vi.advanceTimersByTime(4999);
    expect(byId(b)).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(toaster.toasts).toHaveLength(0);
  });

  it('clear() removes every toast and cancels all timers', () => {
    vi.useFakeTimers();
    toaster.add({ title: 'A', duration: 3000 });
    toaster.add({ title: 'B', duration: 0 });

    toaster.clear();
    expect(toaster.toasts).toHaveLength(0);
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    expect(toaster.toasts).toHaveLength(0);
  });
});
