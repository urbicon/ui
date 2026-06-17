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

/**
 * Create a persistent state that automatically syncs with storage
 * Uses Svelte 5 $state() for reactivity
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
  const initialValue = loadFromStorage();
  const state = $state({ value: initialValue });

  function loadFromStorage(): T {
    if (!storage) return defaultValue;

    try {
      const stored = storage.getItem(storageKey);
      if (stored === null) return defaultValue;

      return deserialize(stored);
    } catch (error) {
      console.warn(`Failed to load persistent state for key "${key}":`, error);
      return defaultValue;
    }
  }

  function saveToStorage(value: T): void {
    if (!storage) return;

    try {
      storage.setItem(storageKey, serialize(value));
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
     * Reset to default value and clear storage
     */
    reset() {
      state.value = defaultValue;
      storage?.removeItem(storageKey);
    },
    /**
     * Force immediate save (bypasses debounce)
     */
    forceSave() {
      saveToStorage(state.value);
    },
    /**
     * Reload from storage
     */
    reload() {
      state.value = loadFromStorage();
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
