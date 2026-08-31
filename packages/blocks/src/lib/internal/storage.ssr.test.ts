// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { installMemoryStorage, restoreStorage } from '../../../../../scripts/vitest-storage';
import { getStorage } from './storage';

/**
 * Off the browser there is no per-user storage even where the global works:
 * `node --localstorage-file=<path>` puts a real, file-backed `localStorage` on
 * the global with `window` still undefined (measured on 25.2.1), and that store
 * is process-global — one request's state would be every request's. The
 * `typeof window` guard is what refuses it; the try/catch cannot, because
 * nothing throws.
 */

afterEach(() => {
  restoreStorage();
});

describe('getStorage on the server', () => {
  it('refuses a fully working global storage while there is no window', () => {
    const storage = installMemoryStorage();

    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    expect(storage.getItem).toBeTypeOf('function');
    expect(getStorage('localStorage')).toBeNull();
  });
});
