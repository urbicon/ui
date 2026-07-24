// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersistentState } from './persistent-state.svelte';

/**
 * `hasStoredValue` and the write-dedup that keeps it meaningful.
 *
 * The point of the flag is to tell a *stored empty* value ("the user cleared
 * this") from *nothing stored* ("never set") — consumers let the former win
 * over their own defaults/seeds. That only works if an untouched instance
 * does not quietly create an entry, which is what the dedup in
 * `saveToStorage` guarantees.
 *
 * jsdom, because the helper is a no-op without a `window`. Node ≥22 ships a
 * non-functional global `localStorage` stub that shadows jsdom's, so each test
 * installs a working in-memory Storage on `window` (same trick as
 * `TableStore.seed.persistence.svelte.test.ts`). `$effect`s need an
 * `$effect.root`; the auto-save is debounced, hence the fake timers.
 */

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

/** Runs `fn` inside an effect root and returns both the result and the teardown. */
function withRoot<T>(fn: () => T): { result: T; cleanup: () => void } {
  let result!: T;
  const cleanup = $effect.root(() => {
    result = fn();
  });
  return { result, cleanup };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hasStoredValue', () => {
  it('is false when nothing is stored', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_absent', defaultValue: [] as string[] })
    );

    expect(result.hasStoredValue).toBe(false);
    expect(result.value).toEqual([]);
    cleanup();
  });

  it('is true for a stored *empty* value — the distinction consumers need', () => {
    window.localStorage.setItem('urbicon_ps_empty_v1', '[]');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_empty', defaultValue: ['seed'] as string[] })
    );

    expect(result.hasStoredValue).toBe(true);
    expect(result.value).toEqual([]);
    cleanup();
  });

  it('is false for a corrupt entry, so junk can never win over a default', () => {
    window.localStorage.setItem('urbicon_ps_junk_v1', '{not json');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_junk', defaultValue: ['seed'] as string[] })
    );

    expect(result.hasStoredValue).toBe(false);
    expect(result.value).toEqual(['seed']);
    cleanup();
  });

  it('flips to true once a value actually reaches storage', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_write', defaultValue: '' })
    );

    result.value = 'x';
    result.forceSave();

    expect(result.hasStoredValue).toBe(true);
    expect(window.localStorage.getItem('urbicon_ps_write_v1')).toBe('"x"');
    cleanup();
  });

  it('goes back to false after reset(), and the auto-save does not undo it', () => {
    window.localStorage.setItem('urbicon_ps_reset_v1', '"kept"');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_reset', defaultValue: '' })
    );
    expect(result.hasStoredValue).toBe(true);

    result.reset();
    flushSync();
    vi.advanceTimersByTime(1000);

    expect(result.hasStoredValue).toBe(false);
    expect(window.localStorage.getItem('urbicon_ps_reset_v1')).toBe(null);
    cleanup();
  });

  it('reload() re-reads presence from storage', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_reload', defaultValue: '' })
    );
    expect(result.hasStoredValue).toBe(false);

    window.localStorage.setItem('urbicon_ps_reload_v1', '""');
    result.reload();

    expect(result.hasStoredValue).toBe(true);
    expect(result.value).toBe('');
    cleanup();
  });
});

describe('write dedup', () => {
  it('an untouched instance never creates an entry', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_untouched', defaultValue: [] as string[] })
    );

    flushSync();
    vi.advanceTimersByTime(1000);
    result.forceSave();

    expect(window.localStorage.getItem('urbicon_ps_untouched_v1')).toBe(null);
    expect(result.hasStoredValue).toBe(false);
    cleanup();
  });

  it('a changed value is written by the debounced auto-save', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_auto', defaultValue: '' })
    );

    result.value = 'typed';
    flushSync();
    expect(window.localStorage.getItem('urbicon_ps_auto_v1')).toBe(null);

    vi.advanceTimersByTime(1000);
    expect(window.localStorage.getItem('urbicon_ps_auto_v1')).toBe('"typed"');
    cleanup();
  });

  it('clearing back to the default is written when storage held something else', () => {
    window.localStorage.setItem('urbicon_ps_clear_v1', '["a"]');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_clear', defaultValue: [] as string[] })
    );

    result.value = [];
    result.forceSave();

    expect(window.localStorage.getItem('urbicon_ps_clear_v1')).toBe('[]');
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });
});
