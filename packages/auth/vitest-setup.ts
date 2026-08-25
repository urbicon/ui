// jsdom polyfills for the component tests in this package.
//
// Guarded on `window`, so the node files — the bulk of this suite — load this
// and skip all of it. Every entry is here because a mounted auth component
// crashed without it, not on suspicion.
if (typeof window !== 'undefined') {
  // `Button`'s mint micro-interactions probe `prefers-reduced-motion`, so every
  // component in this package reaches matchMedia through its first button.
  // jsdom ships none. "No match" is the right default: the assertions describe
  // the ordinary, motion-enabled branch.
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

  // `ConfirmDialog` (AccountSettings' danger zone) enters the top layer with
  // `showModal()` and leaves it with `close()`. jsdom ships neither, and the
  // throw happens outside the assertion path: the test list stays green while
  // the run reports an unhandled error. Reflecting the `open` attribute is
  // enough — there is no real top layer here, and these tests assert what the
  // dialog does, not that it is modal.
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

  // Svelte drives the dialog's enter/exit transition through the Web Animations
  // API, which jsdom does not implement. The stub never fires `onfinish`, so the
  // outro's own teardown never runs — `unmount()` aborts it instead. Fine while
  // no assertion here describes the exit animation or what happens after it.
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
