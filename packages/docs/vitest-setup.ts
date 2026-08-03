/**
 * jsdom polyfills for the component tests in this package.
 *
 * Everything here is guarded on `window`, so the node suite — which is most of
 * the files — loads this and skips all of it.
 *
 * `TypesReference` renders through `Card` → `Table` → `TableProvider`, which
 * builds a `MediaQuery` on mount. jsdom ships no `matchMedia`, so the mount
 * threw *outside* the assertion path: every test still passed and the run
 * exited 1 on two unhandled errors. A green test list next to a red exit code
 * is the worst of both — the file existed and proved nothing.
 */
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    // "no match" is the right default here: the components under test read
    // media queries to pick a layout, and the desktop branch is the one the
    // assertions describe.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      }
    })) as unknown as typeof window.matchMedia;
  }

  if (!('ResizeObserver' in window)) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}
