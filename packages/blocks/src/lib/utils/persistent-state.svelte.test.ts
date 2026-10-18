// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorage,
  installMemoryStorage,
  installStorage,
  restoreStorage
} from '../../../../../scripts/vitest-storage';
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
 * jsdom, because the helper is a no-op without a `window`; each test installs
 * its own storage through `scripts/vitest-storage`. `$effect`s need an
 * `$effect.root`; the auto-save is debounced, hence the fake timers.
 */

/** Runs `fn` inside an effect root and returns both the result and the teardown. */
function withRoot<T>(fn: () => T): { result: T; cleanup: () => void } {
  let result!: T;
  const cleanup = $effect.root(() => {
    result = fn();
  });
  return { result, cleanup };
}

beforeEach(() => {
  installMemoryStorage();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  restoreStorage();
  // The `console.warn` spies: an unrestored one carries its call history into
  // the next test, because `vi.spyOn` reuses the existing mock.
  vi.restoreAllMocks();
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

describe('clearing an axis that has no entry yet', () => {
  /**
   * The case the first version of the dedup got wrong: it seeded its "what
   * storage holds" baseline with the *default*, although storage held nothing.
   * Writing the default back — clearing — then looked like a no-op forever, so
   * the absent → stored-empty transition (the whole point of `hasStoredValue`)
   * could never happen on a key that did not exist yet. Reachable after
   * `reset()` / `clearAllPersistentData()`, or simply on a first visit.
   */
  it('writes the cleared value even though it equals the default', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_fresh_clear', defaultValue: [] as string[] })
    );

    expect(window.localStorage.getItem('urbicon_ps_fresh_clear_v1')).toBe(null);

    // The user clears an axis that was never persisted (its value is already
    // the default) — a deliberate write, not an untouched instance.
    result.value = [];
    flushSync();
    vi.advanceTimersByTime(1000);

    expect(window.localStorage.getItem('urbicon_ps_fresh_clear_v1')).toBe('[]');
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });

  it('re-clearing after reset() writes again', () => {
    window.localStorage.setItem('urbicon_ps_reclear_v1', '["a"]');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_reclear', defaultValue: [] as string[] })
    );

    result.reset();
    flushSync();
    vi.advanceTimersByTime(1000);
    expect(window.localStorage.getItem('urbicon_ps_reclear_v1')).toBe(null);
    expect(result.hasStoredValue).toBe(false);

    // Same instance, user clears again — must be persistable, not swallowed.
    result.value = [];
    flushSync();
    vi.advanceTimersByTime(1000);
    expect(window.localStorage.getItem('urbicon_ps_reclear_v1')).toBe('[]');
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });

  it('forceSave() after an explicit clear writes, unlike on an untouched default', () => {
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_force_clear', defaultValue: [] as string[] })
    );

    // Untouched: a blanket flush must not create entries, or every unused axis
    // would read as "the user cleared this" and retire its seed forever.
    result.forceSave();
    expect(window.localStorage.getItem('urbicon_ps_force_clear_v1')).toBe(null);

    // The same flush after a deliberate clear does write.
    result.value = [];
    flushSync();
    result.forceSave();
    expect(window.localStorage.getItem('urbicon_ps_force_clear_v1')).toBe('[]');
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });
});

/**
 * Storage the environment refuses. `getStorage` hands back a handle whose
 * operations swallow their own failures, so this module carries no try/catch of
 * its own around them — these cases are what makes that safe, and what keeps
 * `hasStoredValue` a mirror of storage rather than of intent.
 */
describe('hostile storage', () => {
  it('does not record a write storage refused', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installStorage({
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError');
        },
        removeItem: () => {}
      }
    });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_quota', defaultValue: [] as string[] })
    );
    result.value = ['a'];
    flushSync();
    vi.advanceTimersByTime(1000);

    // The value is live in memory; storage holds nothing, and the flag says so.
    expect(result.value).toEqual(['a']);
    expect(result.hasStoredValue).toBe(false);
    expect(warn).toHaveBeenCalled();
    cleanup();
  });

  it('warns once per instance, not once per refused save', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installStorage({
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError');
        },
        removeItem: () => {}
      }
    });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_warn_once', defaultValue: [] as string[] })
    );
    for (const next of [['a'], ['b'], ['c']]) {
      result.value = next;
      flushSync();
      vi.advanceTimersByTime(1000);
    }

    // A storage that refuses one write refuses all of them; a line per save
    // would be a line per change for the lifetime of the page.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(result.hasStoredValue).toBe(false);
    cleanup();
  });

  it('keeps the mirror truthful when reset() cannot remove the entry', () => {
    const KEY = 'urbicon_ps_hostile_reset_v1';
    const storage = createMemoryStorage({ [KEY]: '["a"]' });
    storage.removeItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    installStorage({ value: storage });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_hostile_reset', defaultValue: [] as string[] })
    );
    expect(result.hasStoredValue).toBe(true);

    expect(() => result.reset()).not.toThrow();
    expect(result.value).toEqual([]);
    // The removal was refused, so the entry is still there — saying "nothing
    // stored" here is a claim the next reload() would contradict.
    expect(result.hasStoredValue).toBe(true);
    expect(storage.getItem(KEY)).toBe('["a"]');

    // The auto-save the reset triggered then overwrites it with the default,
    // so the cleared value does reach storage even without a removal.
    flushSync();
    vi.advanceTimersByTime(1000);
    expect(storage.getItem(KEY)).toBe('[]');

    result.reload();
    expect(result.value).toEqual([]);
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });

  it('loses the clear against a storage that refuses writes too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const KEY = 'urbicon_ps_sealed_v1';
    const storage = createMemoryStorage({ [KEY]: '["a"]' });
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    storage.removeItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    installStorage({ value: storage });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_sealed', defaultValue: [] as string[] })
    );
    result.reset();
    flushSync();
    vi.advanceTimersByTime(1000);

    // Private mode refuses both, so neither the removal nor the auto-save that
    // would have overwritten the entry reaches storage. The old value is still
    // what is stored, this instance says so, and a reload brings it back —
    // alternativeless under the circumstances, but not silent to a caller.
    expect(result.value).toEqual([]);
    expect(result.hasStoredValue).toBe(true);
    expect(storage.getItem(KEY)).toBe('["a"]');

    result.reload();
    expect(result.value).toEqual(['a']);
    expect(result.hasStoredValue).toBe(true);
    cleanup();
  });

  it('runs on no storage at all', () => {
    installStorage({ value: undefined });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_none', defaultValue: [] as string[] })
    );
    result.value = ['a'];
    flushSync();
    vi.advanceTimersByTime(1000);

    expect(result.value).toEqual(['a']);
    expect(result.hasStoredValue).toBe(false);
    expect(() => result.reset()).not.toThrow();
    cleanup();
  });
});

describe('older versions', () => {
  it('deletes the entries this key wrote under a lower version, and nothing else', () => {
    const storage = installMemoryStorage('localStorage', {
      urbicon_ps_ver_v1: '"one"',
      urbicon_ps_ver_v2: '"two"',
      urbicon_ps_ver_v3: '"three"',
      urbicon_ps_ver_v4: '"four"',
      // The key `ps_ver_v2` at version 1: this key's prefix, but not one of its versions.
      urbicon_ps_ver_v2_v1: '"other key"',
      urbicon_ps_ver_v1_draft: '"not a version"',
      urbicon_other_v1: '"other key"',
      ps_ver_v1: '"not ours"'
    });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_ver', defaultValue: '', version: 3 })
    );

    expect(storage.getItem('urbicon_ps_ver_v1')).toBe(null);
    expect(storage.getItem('urbicon_ps_ver_v2')).toBe(null);
    // Nothing is read across: the current version's own entry is the value.
    expect(result.value).toBe('three');
    expect(storage.getItem('urbicon_ps_ver_v3')).toBe('"three"');
    expect(storage.getItem('urbicon_ps_ver_v4')).toBe('"four"');
    expect(storage.getItem('urbicon_ps_ver_v2_v1')).toBe('"other key"');
    expect(storage.getItem('urbicon_ps_ver_v1_draft')).toBe('"not a version"');
    expect(storage.getItem('urbicon_other_v1')).toBe('"other key"');
    expect(storage.getItem('ps_ver_v1')).toBe('"not ours"');
    cleanup();
  });

  it('starts from the default when only an older version is stored', () => {
    const storage = installMemoryStorage('localStorage', { urbicon_ps_bump_v1: '"old"' });

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_bump', defaultValue: 'fresh', version: 2 })
    );

    expect(result.value).toBe('fresh');
    expect(result.hasStoredValue).toBe(false);
    expect(storage.getItem('urbicon_ps_bump_v1')).toBe(null);
    cleanup();
  });

  it('removes nothing at version 1', () => {
    const storage = installMemoryStorage('localStorage', { urbicon_ps_one_v1: '"kept"' });
    const removeItem = vi.spyOn(storage, 'removeItem');

    const { cleanup } = withRoot(() => createPersistentState({ key: 'ps_one', defaultValue: '' }));

    expect(removeItem).not.toHaveBeenCalled();
    expect(storage.getItem('urbicon_ps_one_v1')).toBe('"kept"');
    cleanup();
  });

  it('deletes from the configured backend only', () => {
    const local = installMemoryStorage('localStorage', { urbicon_ps_area_v1: '"local"' });
    const session = installMemoryStorage('sessionStorage', { urbicon_ps_area_v1: '"session"' });

    const { cleanup } = withRoot(() =>
      createPersistentState({
        key: 'ps_area',
        defaultValue: '',
        version: 2,
        storage: 'sessionStorage'
      })
    );

    expect(session.getItem('urbicon_ps_area_v1')).toBe(null);
    expect(local.getItem('urbicon_ps_area_v1')).toBe('"local"');
    cleanup();
  });

  it('does not throw out of init when storage refuses the removal', () => {
    const storage = createMemoryStorage({
      urbicon_ps_refused_v1: '"old"',
      urbicon_ps_refused_v2: '"current"'
    });
    storage.removeItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    installStorage({ value: storage });

    let state: { value: string } | undefined;
    let cleanup = () => {};
    expect(() => {
      ({ result: state, cleanup } = withRoot(() =>
        createPersistentState({ key: 'ps_refused', defaultValue: '', version: 2 })
      ));
    }).not.toThrow();

    expect(state?.value).toBe('current');
    expect(storage.getItem('urbicon_ps_refused_v1')).toBe('"old"');
    cleanup();
  });

  it('does not throw out of init when storage cannot list its keys', () => {
    const storage = createMemoryStorage({ urbicon_ps_unlisted_v2: '"current"' });
    Object.defineProperty(storage, 'length', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      }
    });
    installStorage({ value: storage });

    let state: { value: string } | undefined;
    let cleanup = () => {};
    expect(() => {
      ({ result: state, cleanup } = withRoot(() =>
        createPersistentState({ key: 'ps_unlisted', defaultValue: '', version: 2 })
      ));
    }).not.toThrow();

    expect(state?.value).toBe('current');
    cleanup();
  });
});

describe('teardown', () => {
  it('writes a save still pending when its owner is destroyed, and nothing after', () => {
    const storage = installMemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');

    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_teardown', defaultValue: '' })
    );
    result.value = 'typed';
    flushSync();
    expect(storage.getItem('urbicon_ps_teardown_v1')).toBe(null);

    cleanup();
    expect(storage.getItem('urbicon_ps_teardown_v1')).toBe('"typed"');

    vi.advanceTimersByTime(1000);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('does not restore a reset value when the owner is destroyed in the same tick', () => {
    const storage = installMemoryStorage();
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_reset_teardown', defaultValue: '' })
    );
    result.value = 'typed';
    flushSync();

    result.reset();
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(storage.getItem('urbicon_ps_reset_teardown_v1')).toBe(null);
    expect(result.hasStoredValue).toBe(false);
  });

  it('does not write a save from before reload() over what it read', () => {
    const storage = installMemoryStorage();
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_reload_teardown', defaultValue: '' })
    );
    result.value = 'typed';
    flushSync();

    // Another tab wrote meanwhile; this one reloads, then unmounts.
    storage.setItem('urbicon_ps_reload_teardown_v1', '"elsewhere"');
    result.reload();
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(result.value).toBe('elsewhere');
    expect(storage.getItem('urbicon_ps_reload_teardown_v1')).toBe('"elsewhere"');
  });

  it('does not write an older save after forceSave()', () => {
    const storage = installMemoryStorage();
    const { result, cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_force_teardown', defaultValue: '' })
    );
    result.value = 'a';
    flushSync();
    // The auto-save has not re-run for 'b' yet; 'a' is the save still waiting.
    result.value = 'b';
    result.forceSave();
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(storage.getItem('urbicon_ps_force_teardown_v1')).toBe('"b"');
  });

  it('writes nothing on teardown for an untouched instance', () => {
    const storage = installMemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');

    const { cleanup } = withRoot(() =>
      createPersistentState({ key: 'ps_teardown_idle', defaultValue: '' })
    );
    flushSync();
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(setItem).not.toHaveBeenCalled();
  });
});
