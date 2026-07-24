const BROWSER = typeof window !== 'undefined';

/**
 * Configuration for persistent state
 */
export interface PersistentStateConfig<T> {
  key: string;
  defaultValue: T;
  storage?: 'localStorage' | 'sessionStorage';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  debounceMs?: number;
  version?: number; // For schema migrations
}

/**
 * Storage interface for dependency injection
 */
interface StorageInterface {
  getItem(key: string): string | null;

  setItem(key: string, value: string): void;

  removeItem(key: string): void;
}

/**
 * Get storage implementation based on type
 */
function getStorage(type: 'localStorage' | 'sessionStorage'): StorageInterface | null {
  if (!BROWSER) return null;

  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    // Test if storage is available (can fail in private mode)
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Debounce utility for performance
 */
function debounce<T extends (...args: never[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

/** Outcome of one storage read — the value plus whether it came from storage. */
interface LoadResult<T> {
  value: T;
  /** `true` only when a parseable entry existed under the key. */
  stored: boolean;
  /** The exact string storage held, used as the write-dedup baseline. */
  raw: string | null;
}

/**
 * Create a persistent state that automatically syncs with storage
 * Uses Svelte 5 $state() for reactivity
 *
 * Besides `value`, the returned object exposes `hasStoredValue` — whether an
 * entry for this key exists in storage. That is what lets a consumer tell a
 * *stored empty* value (`[]`, `''`, `null` — the user cleared it) from *nothing
 * stored at all*, so a cleared state can win over a default/seed instead of
 * being re-applied on every load. To keep that signal meaningful, saves that
 * would not change what storage holds are skipped — an untouched instance
 * never creates an entry, and `reset()` is not undone by the auto-save.
 */
export function createPersistentState<T>(config: PersistentStateConfig<T>) {
  const {
    key,
    defaultValue,
    storage: storageType = 'localStorage',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    debounceMs = 300,
    version = 1
  } = config;

  const storageKey = `urbicon_${key}_v${version}`;
  const storage = getStorage(storageType);

  // Initialize state with stored value or default
  const initial = loadFromStorage();
  const state = $state({ value: initial.value, hasStored: initial.stored });
  // What storage is known to hold (serialized). `null` means "unknown" and
  // never matches, so the next save always writes.
  let lastWritten: string | null = initial.raw ?? trySerialize(defaultValue);

  function trySerialize(value: T): string | null {
    try {
      return serialize(value);
    } catch {
      return null;
    }
  }

  function loadFromStorage(): LoadResult<T> {
    if (!storage) return { value: defaultValue, stored: false, raw: null };

    try {
      const stored = storage.getItem(storageKey);
      if (stored === null) return { value: defaultValue, stored: false, raw: null };

      return { value: deserialize(stored), stored: true, raw: stored };
    } catch (error) {
      console.warn(`Failed to load persistent state for key "${key}":`, error);
      // A corrupt entry counts as *absent*, never as "stored": consumers use
      // `hasStoredValue` to let a stored value win over their own default or
      // seed, and unparseable junk must not win — it would block that default
      // forever. Keeping the baseline at the default (rather than the junk)
      // also means an untouched instance leaves the junk alone; the first real
      // value written overwrites it.
      return { value: defaultValue, stored: false, raw: null };
    }
  }

  function saveToStorage(value: T): void {
    if (!storage) return;

    try {
      const next = serialize(value);
      // Skip writes that would not change what storage holds. Without this the
      // auto-save effect below creates an entry for every key on mount — even
      // for state nobody touched — which would make `hasStoredValue` useless
      // (an untouched default would be indistinguishable from a deliberately
      // cleared one) and would re-create the entry `reset()` just removed.
      if (next === lastWritten) return;

      storage.setItem(storageKey, next);
      lastWritten = next;
      state.hasStored = true;
    } catch (error) {
      console.warn(`Failed to save persistent state for key "${key}":`, error);
    }
  }

  // Debounced save function for performance
  const debouncedSave = debounce(saveToStorage, debounceMs);

  // Auto-save when state changes
  $effect(() => {
    debouncedSave(state.value);
  });

  return {
    get value() {
      return state.value;
    },
    set value(newValue: T) {
      state.value = newValue;
    },
    /**
     * Whether storage currently holds an entry for this key: `true` when
     * construction (or `reload()`) found a parseable entry, and after a write
     * actually reached storage; `false` when the key was absent or corrupt,
     * after `reset()`, and always without a working storage (SSR, private
     * mode). Use it to distinguish a stored empty value from an absent one.
     */
    get hasStoredValue() {
      return state.hasStored;
    },
    /**
     * Reset to default value and clear storage
     */
    reset() {
      state.value = defaultValue;
      storage?.removeItem(storageKey);
      state.hasStored = false;
      // Re-baseline so the auto-save triggered by the assignment above does
      // not immediately write the default back into the key we just removed.
      lastWritten = trySerialize(defaultValue);
    },
    /**
     * Force immediate save (bypasses debounce). Still a no-op when the value
     * matches what storage already holds.
     */
    forceSave() {
      saveToStorage(state.value);
    },
    /**
     * Reload from storage
     */
    reload() {
      const next = loadFromStorage();
      state.value = next.value;
      state.hasStored = next.stored;
      lastWritten = next.raw ?? trySerialize(defaultValue);
    }
  };
}

/**
 * Specialized hook for filter persistence
 */
export interface FilterPersistenceConfig {
  tableId: string;
  storage?: 'localStorage' | 'sessionStorage';
  debounceMs?: number;
}
