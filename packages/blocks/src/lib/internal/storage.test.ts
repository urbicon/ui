// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installMemoryStorage,
  installStorage,
  restoreStorage
} from '../../../../../scripts/vitest-storage';
import { getStorage } from './storage';

/**
 * The shapes of Web Storage reachable in a real browser or runtime. Only a
 * usable one may come back; every other answer must be `null` rather than a
 * throw, because callers read `null` as "no persistence" and a throw as a
 * crash. A storage that passes the check and then refuses an operation has to
 * degrade the same way — the quota is hit by the value, not by the check.
 */

afterEach(() => {
  restoreStorage();
  vi.restoreAllMocks();
});

describe('getStorage', () => {
  it('round-trips through a working storage', () => {
    const storage = installMemoryStorage();

    const handle = getStorage('localStorage');
    expect(handle?.setItem('k', 'v')).toBe(true);
    expect(storage.getItem('k')).toBe('v');
    expect(handle?.getItem('k')).toBe('v');
    expect(handle?.removeItem('k')).toBe(true);
    expect(storage.getItem('k')).toBeNull();
  });

  it('writes nothing in order to answer', () => {
    const storage = installMemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const removeItem = vi.spyOn(storage, 'removeItem');

    expect(getStorage('localStorage')).not.toBeNull();

    // A probe write lands in the consumer's storage and reaches every other tab
    // on the origin as a `storage` event naming a key of ours — for a verdict
    // that no longer holds by the time the real write happens.
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('addresses the area it was asked for', () => {
    const local = installMemoryStorage('localStorage');
    const session = installMemoryStorage('sessionStorage');

    getStorage('sessionStorage')?.setItem('k', 'v');

    expect(session.getItem('k')).toBe('v');
    expect(local.getItem('k')).toBeNull();
  });

  it('returns null for a storage object with no methods', () => {
    installStorage({ value: {} });
    expect(getStorage('localStorage')).toBeNull();
  });

  it('returns null when there is no storage object', () => {
    installStorage({ value: undefined });
    expect(getStorage('localStorage')).toBeNull();
  });

  it('returns null when reading the property throws', () => {
    installStorage({
      get() {
        throw new DOMException('denied', 'SecurityError');
      }
    });
    expect(getStorage('localStorage')).toBeNull();
  });

  it('answers false instead of throwing when the write is refused', () => {
    installStorage({
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError');
        },
        removeItem: () => {}
      }
    });

    expect(getStorage('localStorage')?.setItem('k', 'v')).toBe(false);
  });

  it('reads null and reports a refused removal when those throw', () => {
    installStorage({
      value: {
        getItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
        setItem: () => {},
        removeItem: () => {
          throw new DOMException('denied', 'SecurityError');
        }
      }
    });

    const handle = getStorage('localStorage');
    expect(handle).not.toBeNull();
    expect(handle?.getItem('k')).toBeNull();
    // The entry is still there, so a caller keeping a mirror of storage must
    // not retire it — same contract as a refused write, other direction.
    expect(handle?.removeItem('k')).toBe(false);
  });
});
