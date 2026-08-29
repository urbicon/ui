import '../../scripts/vitest-match-media';

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
// it. (@testing-library/svelte is likewise avoided — a second svelte instance breaks svelte-check;
// tests mount with svelte's own `mount`/`unmount`.)
if (typeof window !== 'undefined') {
  // Active-option scroll (Combobox/Select/Menu keyboard nav) — jsdom has no scrollIntoView.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // Coordinate hit-testing (Toast hover-pause re-derives containment from the real
  // cursor when the stack shrinks — a toast removed under the pointer may never fire
  // `pointerout`). jsdom has no layout, so there is no real hit-test: return null,
  // which the Toast un-freeze test relies on for its "no live toast under the cursor
  // → resume" branch. A layout-dependent hit against a *remaining* toast is a
  // Playwright concern.
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }

  // Pointer capture (Dialog draggable header, Slider thumb) — jsdom has no
  // capture model. No-ops are enough: the drag handlers key off `pointerdown`/
  // `pointermove` bookkeeping, capture only reroutes events the test dispatches
  // straight onto the handle anyway.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  }

  // Native Popover API (listbox/menu/tooltip render in the browser top layer). jsdom has no top
  // layer; no-op show/hide keeps `useFloatingPanel` from throwing. Content still renders from the
  // component's `open` state, so the listbox/menu options appear in the DOM regardless.
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = () => {};
    HTMLElement.prototype.hidePopover = () => {};
  }

  // Native modal `<dialog>` (Dialog/Drawer call `showModal()` to enter the top
  // layer). jsdom ships no showModal/show/close, so reflect the `open` attribute
  // instead — enough for `dialog.open` assertions and the `closeDialogModal`
  // `dialog.open` guard. No real top layer or `::backdrop`; the panel is already
  // visible via its own CSS, so tests exercise dismiss logic, not modality paint.
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

  // Svelte 5 drives `transition:` (Dialog/Drawer fade+scale) through the Web
  // Animations API. jsdom has no WAAPI, so `element.animate` is missing and the
  // intro would throw. The stub returns an Animation-like object whose members
  // Svelte's transition engine actually touches (settable `onfinish`, `cancel`,
  // `currentTime`). Note it never *fires* `onfinish`, so the intro/outro
  // `on_finish` cleanup never runs — the panel is torn down by `unmount()`'s
  // abort path instead (which the no-op `cancel()`/`onfinish` cover). Fine here
  // because these tests assert synchronous dismiss logic, not the exit animation
  // or post-close teardown; a future test that needs outro completion (DOM
  // removal, focus-restore-on-close) would have to fire `onfinish` for real. The
  // `finished`/`playState` fields are defensive only — Svelte doesn't read them.
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

  // `matchMedia` is installed by `scripts/vitest-match-media.ts` (imported at the top): one
  // query-aware implementation shared with table. The flat `matches: false` stub it replaced
  // was a WRONG answer to `(min-width: 1px)` and let any media-query-shaped test pass without
  // running its branch; a query the shared stub has no rule for now throws.

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

  // Chat's message list pins itself to the bottom via scrollTo — jsdom has no scrolling.
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }

  // FileUpload mirrors its accepted files back onto the <input> through a
  // DataTransfer, which jsdom does not implement at all. @testing-library's
  // paste reaches for the same global, so the stub has to carry the string
  // half of the interface as well or every paste test loses its clipboard.
  if (!('DataTransfer' in window)) {
    window.DataTransfer = class {
      #files: File[] = [];
      #data = new Map<string, string>();
      readonly items = {
        add: (file: File) => {
          this.#files.push(file);
        }
      };
      get types() {
        return [...this.#data.keys()];
      }
      setData(format: string, data: string) {
        this.#data.set(format, data);
      }
      getData(format: string) {
        return this.#data.get(format) ?? '';
      }
      clearData(format?: string) {
        if (format === undefined) this.#data.clear();
        else this.#data.delete(format);
      }
      get files() {
        // jsdom validates the `HTMLInputElement.files` setter against a real
        // FileList, and a FileList cannot be constructed — an empty <input>
        // is the only source of one. A stub that returned an array here would
        // be silently assigning nothing, so a non-empty transfer throws.
        if (this.#files.length > 0) {
          throw new Error(
            'DataTransfer stub: jsdom cannot build a FileList, so a transfer carrying files ' +
              'cannot be mirrored onto an <input>. Drive the component through its own API instead.'
          );
        }
        return document.createElement('input').files as FileList;
      }
    } as unknown as typeof DataTransfer;
  }
}
