/**
 * Guarded Web Storage access for the docs app.
 *
 * `@urbicon-ui/blocks` has the same guard in `internal/storage.ts` and
 * deliberately keeps it out of its exports map, so every consumer — this app
 * included — carries its own. The reason it states holds here too: no runtime
 * guarantees the global is a working Storage. Reading the property throws where
 * storage is switched off (a hardened profile, an embedded webview), the object
 * can be missing the methods, and a write can still be refused by a quota. An
 * unguarded access takes the surrounding handler down with it — which in
 * `onMount` means the component never finishes mounting.
 *
 * The head script in `app.html` cannot import this (no bundle runs yet) and
 * carries the same guard inline.
 */
function storage(): Storage | null {
  // Off the browser there is no per-user storage even where the global works:
  // `node --localstorage-file=<path>` gives Node a real, file-backed
  // `localStorage` with `window` still undefined, and that store is
  // process-global. Nothing here runs during prerender today — every caller
  // sits in `onMount` or an event handler — but the guard is what makes that
  // a property of this module rather than of its call sites.
  if (typeof window === 'undefined') return null;

  try {
    const ambient = globalThis.localStorage;
    return typeof ambient?.getItem === 'function' ? ambient : null;
  } catch {
    return null;
  }
}

/** The stored value, or `null` when there is none — or no storage. */
export function readStored(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Stores `value`; silently does nothing where storage refuses it. */
export function writeStored(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Nothing to fall back to: the preference is simply not remembered.
  }
}

/** Drops the entry; silently does nothing where storage refuses it. */
export function clearStored(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // As above — the stale entry stays until storage works again.
  }
}
