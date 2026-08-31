import { afterEach, describe, expect, it } from 'vitest';
import { installMemoryStorage, restoreStorage } from '../../../../scripts/vitest-storage';
import { clearStored, readStored, writeStored } from './storage';

/**
 * The app's own copy of the library guard, pinned the way
 * `packages/blocks/src/lib/internal/storage.ssr.test.ts` pins the library's.
 * Without a test here the `typeof window` line can vanish from this file
 * without a word — and this file is the shape a consumer copies.
 *
 * This suite runs in the node environment (vitest.config.ts), so `window` is
 * genuinely undefined rather than deleted: the real server condition.
 */
const KEY = 'urbicon-locale';

afterEach(() => {
  restoreStorage();
});

describe('docs-app storage off the browser', () => {
  it('neither reads nor writes a fully working global storage while there is no window', () => {
    // Node's `--localstorage-file` puts exactly this on the global: a real,
    // working, PROCESS-GLOBAL store. Persisting one request's preference there
    // would persist it for every other request.
    const storage = installMemoryStorage('localStorage', { [KEY]: 'de' });

    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    expect(storage.getItem(KEY)).toBe('de');

    expect(readStored(KEY)).toBeNull();

    writeStored(KEY, 'en');
    expect(storage.getItem(KEY)).toBe('de');

    clearStored(KEY);
    expect(storage.getItem(KEY)).toBe('de');
  });
});
