// Global vitest setup for @urbicon-ui/table.
//
// Mirrors `packages/blocks/vitest-setup.ts` — same reasoning, smaller surface: the table
// mounts blocks primitives (Pagination, Select, Menu, Checkbox) plus its own sticky and
// virtualization machinery, and those call layout/overlay APIs jsdom does not ship. Stub
// only what a mounted table actually touches; everything else belongs in Playwright, which
// has a real layout.
//
// Guarded on `window` so the node-environment tests that share this file — the store, util
// and variant suites, and the SSR ones that render through `svelte/server` — skip it whole.
//
// Assertions use vitest's native matchers, and components mount with svelte's own
// `mount`/`unmount`; neither @testing-library/svelte nor @testing-library/jest-dom is used
// here, for the reasons documented in the blocks setup.
if (typeof window !== 'undefined') {
  // Sticky header/column measurement and the virtualized viewport observe their container.
  if (!('ResizeObserver' in window)) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // `observeStuck` watches a sentinel to toggle the stuck state of a sticky header.
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

  // Header menu / column visibility / filter panels render in the native top layer,
  // which jsdom has no concept of. Content still renders from the component's `open`
  // state, so the items are in the DOM and queryable with `{ hidden: true }`.
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = () => {};
    HTMLElement.prototype.hidePopover = () => {};
  }

  // Keyboard navigation scrolls the active row into view.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // `prefers-reduced-motion` probes in the blocks primitives the table embeds.
  if (!window.matchMedia) {
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
}
