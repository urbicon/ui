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
});
