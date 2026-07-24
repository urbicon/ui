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
 * being re-applied on every load. Two rules keep that signal meaningful: a save
 * that would not change the stored bytes is skipped, and an instance nobody
 * wrote to never creates an entry for its own default (so `reset()` is not
 * undone by the auto-save, and untouched state stays out of storage). Writing
 * the default *back* — clearing — is a real write and does create the entry.
 *
 * Values must round-trip through the configured `serialize`/`deserialize`;
 * `Set`/`Map` do not under the `JSON.stringify` default (they serialize to
 * `{}`), so pass converting functions or store plain arrays/objects.
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
  // A faithful mirror of what storage holds: the exact stored string, or `null`
  // when the key is absent (or unparseable). It must never claim the default is
  // stored when it is not — that would make the absent → stored-empty
  // transition unwritable, which is exactly the state this module exists to
  // preserve (the user cleared the axis).
  let lastWritten: string | null = initial.raw;
  // Whether the consumer ever wrote through this instance. Only used to keep an
  // *untouched* instance from creating an entry for its own default.
  let touched = false;
  const defaultSerialized = trySerialize(defaultValue);

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
      // forever. The junk itself is left in place until something is actually
      // written (the first real write overwrites it); an untouched instance
      // does not clean it up, and does not need to — it reads as absent.
      return { value: defaultValue, stored: false, raw: null };
    }
  }

  function saveToStorage(value: T): void {
    if (!storage) return;

    try {
      const next = serialize(value);
      // Storage already holds exactly this — nothing to do.
      if (next === lastWritten) return;

      // Never *create* an entry for a value nobody touched. Without this the
      // auto-save effect below would write every key with its own default on
      // mount, making `hasStoredValue` useless (an untouched default would be
      // indistinguishable from a deliberately cleared one) and re-creating the
      // entry `reset()` just removed. Once the consumer has written — including
      // writing the default back, i.e. clearing — the write goes through, even
      // if the key does not exist yet. `forceSave()` obeys the same rule on
      // purpose: a blanket flush (the table exposes one) must not create an
      // entry for every untouched axis, which would retire all their seeds.
      if (!touched && lastWritten === null && next === defaultSerialized) return;

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
      // Mark the instance as written-to *before* the state change, so the
      // auto-save effect it triggers knows this is a deliberate value — that is
      // what lets clearing back to the default create an entry.
      touched = true;
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
      try {
        storage?.removeItem(storageKey);
      } catch (error) {
        console.warn(`Failed to clear persistent state for key "${key}":`, error);
      }
      state.hasStored = false;
      // Back to "nothing stored", and untouched again — so the auto-save
      // triggered by the assignment above does not immediately re-create the
      // key we just removed. A later write (including clearing) still lands.
      lastWritten = null;
      touched = false;
    },
    /**
     * Force immediate save (bypasses debounce). A no-op when storage already
     * holds exactly this value, and — like the auto-save — when the instance
     * was never written to and still holds its default.
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
      lastWritten = next.raw;
      // The value now mirrors storage again; nothing here came from the
      // consumer, so an absent key stays absent until the next real write.
      touched = false;
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
