// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage, restoreStorage } from '../../../../../scripts/vitest-storage';
import { CodeVisibilityStore } from './code-visibility.svelte';

const STORAGE_KEY = 'urbicon-docs-code-visibility';

/** Drives `MediaQuery`, which reads window.matchMedia at construction. */
function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  });
}

beforeEach(() => {
  installMemoryStorage();
  stubMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreStorage();
});

describe('CodeVisibilityStore', () => {
  it('expands by default on a wide viewport', () => {
    const cleanup = $effect.root(() => {
      const store = new CodeVisibilityStore();
      expect(store.mode).toBe('auto');
      expect(store.expanded).toBe(true);
    });
    cleanup();
  });

  it('collapses by default on a narrow viewport', () => {
    stubMatchMedia(true);
    const cleanup = $effect.root(() => {
      const store = new CodeVisibilityStore();
      expect(store.expanded).toBe(false);
    });
    cleanup();
  });

  it('toggle moves auto → hidden on a wide viewport and persists', () => {
    const cleanup = $effect.root(() => {
      const store = new CodeVisibilityStore();
      store.toggle();
      flushSync();

      expect(store.mode).toBe('hidden');
      expect(store.expanded).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('hidden');
    });
    cleanup();
  });

  it('toggle moves auto → visible on a narrow viewport', () => {
    stubMatchMedia(true);
    const cleanup = $effect.root(() => {
      const store = new CodeVisibilityStore();
      store.toggle();
      flushSync();

      expect(store.mode).toBe('visible');
      expect(store.expanded).toBe(true);
    });
    cleanup();
  });

  it('hydrates a persisted mode and clears storage on reset', () => {
    localStorage.setItem(STORAGE_KEY, 'hidden');
    const cleanup = $effect.root(() => {
      const store = new CodeVisibilityStore();
      expect(store.mode).toBe('hidden');

      store.reset();
      flushSync();
      expect(store.mode).toBe('auto');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    cleanup();
  });

  it('ignores a garbage persisted value', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-mode');
    const cleanup = $effect.root(() => {
      expect(new CodeVisibilityStore().mode).toBe('auto');
    });
    cleanup();
  });
});
