// Global vitest setup for @urbicon-ui/blocks.
//
// jsdom omits several layout/overlay APIs that the primitives call while mounted (there is no real
// layout or top layer). Stub the ones our components touch so a mounted component doesn't crash on
// them; the components drive their open/visible state from reactive `state`, not these APIs, so
// no-ops are enough for interaction tests. Guarded on `window` so the node-environment tests that
// share this setup file skip the block entirely.
//
// Assertions use vitest's own matchers (toBe, toBeNull, document.activeElement, getAttribute, …)
// rather than @testing-library/jest-dom: jest-dom 6's expect augmentation does not compose cleanly
// with vitest 4's `Assertion` type (it breaks every native matcher under svelte-check), so we skip
// it. @testing-library/svelte still auto-registers its own afterEach(cleanup) per importing file.
if (typeof window !== 'undefined') {
  // Active-option scroll (Combobox/Select/Menu keyboard nav) — jsdom has no scrollIntoView.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // Native Popover API (listbox/menu/tooltip render in the browser top layer). jsdom has no top
  // layer; no-op show/hide keeps `useFloatingPanel` from throwing. Content still renders from the
  // component's `open` state, so the listbox/menu options appear in the DOM regardless.
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = () => {};
    HTMLElement.prototype.hidePopover = () => {};
  }

  // Floating UI's autoUpdate observes the reference element for size/visibility changes.
  if (!('ResizeObserver' in window)) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!('IntersectionObserver' in window)) {
    window.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
}
