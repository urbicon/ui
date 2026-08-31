/**
 * @internal Not part of the package's public API — `utils/index.ts` does not
 * re-export it. Two callers share it: `utils/persistent-state.svelte.ts` and
 * `components/ThemeSwitcher`.
 */

/**
 * The three methods either caller uses. Narrower than the DOM `Storage`, and
 * both mutators differ from it: they report whether the change reached storage,
 * because `createPersistentState` keeps a mirror of what is stored and may not
 * advance it over an operation storage refused — in either direction. A refused
 * removal leaves the old entry in place, which the next `reload()` would read
 * back, so it has to be as visible to a caller as a refused write. `getItem`
 * answers `null` for "no entry" and for "unreadable" alike — one case for
 * every caller here.
 */
export interface StorageInterface {
  getItem(key: string): string | null;

  /** `true` when the value reached storage. */
  setItem(key: string, value: string): boolean;

  /** `true` when the entry is gone. */
  removeItem(key: string): boolean;
}

/**
 * Web Storage for `type`, wrapped so that no operation throws, or `null` when
 * there is none to use.
 *
 * No runtime guarantees that the ambient storage object is a working Storage:
 * reading the property can throw (a hardened profile, an embedded webview with
 * storage switched off), the object it yields can be missing the methods, and
 * one that has them can still throw on the write that matters — a quota is hit
 * by the real value, not by a four-byte probe. So the interface is checked, every
 * operation is guarded on its own, and a caller degrades to no persistence
 * instead of crashing.
 *
 * Nothing here writes in order to answer. A probe write would put a key of ours
 * into every consumer's storage, and deliver a `storage` event naming it to
 * every other tab on the origin, for a verdict that no longer holds by the time
 * the real write happens.
 *
 * Refused off the browser even where the global works: `--localstorage-file`
 * gives Node a real, file-backed `localStorage` with `window` still undefined
 * (measured on 25.2.1), and that store is process-global — one user's state
 * would be every user's. That is what the `window` guard is for, and why the
 * read below goes through `globalThis` (the same object as `window` wherever
 * both exist): spelled `window.localStorage`, a server would be refused by an
 * incidental `ReferenceError` in the `catch` instead, and the guard could be
 * deleted with every test still green.
 */
export function getStorage(type: 'localStorage' | 'sessionStorage'): StorageInterface | null {
  if (typeof window === 'undefined') return null;

  let ambient: Storage | undefined;
  try {
    ambient = type === 'localStorage' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }

  if (
    !ambient ||
    typeof ambient.getItem !== 'function' ||
    typeof ambient.setItem !== 'function' ||
    typeof ambient.removeItem !== 'function'
  ) {
    return null;
  }

  const storage = ambient;
  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    }
  };
}
