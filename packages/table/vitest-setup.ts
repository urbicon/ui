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

  // The narrow bar's tools sheet is a `Drawer`, i.e. a native modal `<dialog>`
  // that enters the top layer through `showModal()` — which jsdom does not
  // ship, so opening one rejected asynchronously (an unhandled rejection in the
  // run) while its content rendered fine. Same stub and caveats as
  // `packages/blocks/vitest-setup.ts`: reflect the `open` attribute, no real
  // top layer and no `::backdrop`.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }

  // Keyboard navigation scrolls the active row into view.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // GroupedRow's item rows and the expanded-row content enter through
  // `transition:slide`, which Svelte 5 drives via the Web Animations API —
  // missing in jsdom, so the intro would throw. Same stub and caveats as
  // `packages/blocks/vitest-setup.ts`: `onfinish` never fires, teardown runs
  // through `unmount()`'s abort path, fine for synchronous DOM assertions.
  if (!Element.prototype.animate) {
    Element.prototype.animate = function animate() {
      let onfinish: ((this: unknown, ev: Event) => unknown) | null = null;
      return {
        currentTime: 0,
        startTime: 0,
        playbackRate: 1,
        playState: 'finished',
        pending: false,
        finished: Promise.resolve(),
        get onfinish() {
          return onfinish;
        },
        set onfinish(fn) {
          onfinish = fn;
        },
        oncancel: null,
        play() {},
        pause() {},
        cancel() {},
        finish() {},
        reverse() {},
        persist() {},
        commitStyles() {},
        updatePlaybackRate() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        }
      } as unknown as Animation;
    };
  }
}

// ── matchMedia ──────────────────────────────────────────────────────────────
// One implementation for blocks and table: `scripts/vitest-match-media.ts`. It installs
// itself on import; the setters are re-exported so tests keep importing them from here.
export {
  resetMediaState,
  setMediaViewport,
  setPrefersReducedMotion
} from '../../scripts/vitest-match-media';
