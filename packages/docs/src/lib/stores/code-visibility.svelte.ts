import { createOptionalContext } from '@urbicon-ui/blocks';

const STORAGE_KEY = 'urbicon-docs-code-visibility';
const MOBILE_QUERY = '(max-width: 639px)';

export type CodeVisibilityMode = 'auto' | 'visible' | 'hidden';

export class CodeVisibilityStore {
  mode = $state<CodeVisibilityMode>('auto');
  #isMobile = $state(false);
  #mediaQuery: MediaQueryList | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.#hydrate();
      this.#mediaQuery = window.matchMedia(MOBILE_QUERY);
      this.#isMobile = this.#mediaQuery.matches;
      this.#mediaQuery.addEventListener('change', this.#onMediaChange);
    }
  }

  get expanded(): boolean {
    if (this.mode === 'visible') return true;
    if (this.mode === 'hidden') return false;
    return !this.#isMobile;
  }

  toggle() {
    if (this.mode === 'auto') {
      this.mode = this.#isMobile ? 'visible' : 'hidden';
    } else if (this.mode === 'visible') {
      this.mode = 'hidden';
    } else {
      this.mode = 'visible';
    }
    this.#persist();
  }

  reset() {
    this.mode = 'auto';
    this.#persist();
  }

  destroy() {
    this.#mediaQuery?.removeEventListener('change', this.#onMediaChange);
  }

  #onMediaChange = (e: MediaQueryListEvent) => {
    this.#isMobile = e.matches;
  };

  #hydrate() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'visible' || stored === 'hidden') {
        this.mode = stored;
      }
    } catch {
      // SSR or storage unavailable
    }
  }

  #persist() {
    try {
      if (this.mode === 'auto') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, this.mode);
      }
    } catch {
      // storage unavailable
    }
  }
}

// Optional — sub-components fall back to local state when no provider sets it.
const [getCodeVisibilityContext, setCodeVisibilityContext] =
  createOptionalContext<CodeVisibilityStore>();

export { getCodeVisibilityContext, setCodeVisibilityContext };
