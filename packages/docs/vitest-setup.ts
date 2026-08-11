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

  // `DocsLayout` watches its hero with an IntersectionObserver to know when the
  // breadcrumb strip has to take over the title. jsdom ships none, and the
  // section-numbering suite mounts a layout through
  // `Section/__fixtures__/NumberingHarness.svelte` — the only route by which a
  // test reaches this component, which is why a grep for `mount(DocsLayout)`
  // finds nothing and removing this stub still turns the run red.
  //
  // It only started to bite when the strip stopped being gated on `breadcrumbs`:
  // the harness passes none, so it used to take the branch that never reached
  // the observer. Never firing is the correct stub — the callback drives the
  // collapse animation alone, and no assertion here describes it.
  if (!('IntersectionObserver' in window)) {
    window.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }

  // Expanding a table row mounts `transition:slide`, which calls
  // `element.animate()` — the Web Animations API, which jsdom does not
  // implement. Without this every expand-row assertion dies on a TypeError
  // thrown from inside the transition, not from the code under test.
  // The stub finishes immediately: the tests assert what the expanded row
  // CONTAINS, never how it got there.
  if (!Element.prototype.animate) {
    Element.prototype.animate = function animate() {
      return {
        cancel() {},
        finish() {},
        pause() {},
        play() {},
        reverse() {},
        addEventListener() {},
        removeEventListener() {},
        currentTime: 0,
        playState: 'finished',
        startTime: 0,
        effect: null,
        finished: Promise.resolve(),
        onfinish: null
      } as unknown as Animation;
    } as typeof Element.prototype.animate;
  }
}
