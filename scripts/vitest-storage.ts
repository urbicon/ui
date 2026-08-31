/**
 * The Web Storage the DOM suites of blocks, table and docs run against —
 * imported by every test that needs storage semantics, so what a `getItem`
 * answers cannot differ between packages or between files. Not published: it
 * lives in `scripts/`, outside every package root.
 *
 * A test must never use the ambient storage. No runtime guarantees the global
 * is a working Storage — it has been an object with no methods and it has been
 * absent, so the object under test would otherwise differ by machine, and a
 * suite whose subject differs by machine measures nothing. Installing one per
 * test is also the only way to express the hostile shapes at all.
 */
type Area = 'localStorage' | 'sessionStorage';

/** What was on the global before the first install, per area. */
const originals = new Map<Area, PropertyDescriptor | undefined>();

/** An in-memory `Storage`, optionally pre-filled. */
export function createMemoryStorage(seed?: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

/**
 * Puts `descriptor` on the global under `area` — a value, or a getter for the
 * shapes that throw on property access. `globalThis`, not `window`: the two are
 * the same object under jsdom, and the node environment has only the former.
 */
export function installStorage(descriptor: PropertyDescriptor, area: Area = 'localStorage'): void {
  if (!originals.has(area)) originals.set(area, Object.getOwnPropertyDescriptor(globalThis, area));
  Object.defineProperty(globalThis, area, { configurable: true, ...descriptor });
}

/** Installs a fresh in-memory Storage and hands it back for assertions. */
export function installMemoryStorage(area: Area = 'localStorage', seed?: Record<string, string>) {
  const storage = createMemoryStorage(seed);
  installStorage({ value: storage }, area);
  return storage;
}

/** Undoes every install (or just `area`), including one that added the property. */
export function restoreStorage(area?: Area): void {
  for (const key of area ? [area] : [...originals.keys()]) {
    const original = originals.get(key);
    if (original) Object.defineProperty(globalThis, key, original);
    else delete (globalThis as Record<string, unknown>)[key];
    originals.delete(key);
  }
}
