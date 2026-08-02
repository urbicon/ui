import { createOptionalContext } from '@urbicon-ui/blocks';
import { MediaQuery } from 'svelte/reactivity';

const STORAGE_KEY = 'urbicon-docs-code-visibility';
// Without the parentheses: `MediaQuery` wraps the query itself.
const MOBILE_QUERY = 'max-width: 639px';

export type CodeVisibilityMode = 'auto' | 'visible' | 'hidden';

export class CodeVisibilityStore {
  mode = $state<CodeVisibilityMode>('auto');

  // `MediaQuery` from svelte/reactivity instead of a hand-rolled matchMedia
  // listener: it ties its subscription to the owning effect scope, so it goes
  // away with the component. The previous version added a `change` listener in
  // the constructor and exposed a `destroy()` that nothing ever called — every
  // DocsLayout mount leaked one listener for the lifetime of the tab.
  // On the server `.current` is the fallback (false), matching the old
  // `#isMobile = false` during SSR.
  #mobile = new MediaQuery(MOBILE_QUERY);

  constructor() {
    if (typeof window !== 'undefined') {
      this.#hydrate();
    }
  }

  get expanded(): boolean {
    if (this.mode === 'visible') return true;
    if (this.mode === 'hidden') return false;
    return !this.#mobile.current;
  }

  toggle() {
    if (this.mode === 'auto') {
      this.mode = this.#mobile.current ? 'visible' : 'hidden';
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
