/**
 * Shared scrollspy: tracks which page section (by element id) the reader is
 * currently in. DocsLayout owns ONE instance and hands the active id down to
 * TableOfContents, so the sticky-bar badge and the TOC marker read the same
 * source and can never disagree (they used to run two identical listeners).
 * TableOfContents keeps a private instance only for standalone use, when no
 * layout provides the active section.
 *
 * A section counts as active once its top has crossed 30% of the viewport
 * height; the LAST match wins, so later sections take over as the reader
 * scrolls down. The active id sticks at the last match when scrolling back
 * above the first section — matching the previous behaviour of both copies.
 */
export class ScrollSpy {
  active = $state('');
  readonly #ids: () => string[];

  /** `ids` is read lazily on every recompute, so a reactive source stays live. */
  constructor(ids: () => string[]) {
    this.#ids = ids;
  }

  /** Recompute immediately (called on observe + every animation-frame scroll). */
  update = () => {
    let lastMatch = '';
    for (const id of this.#ids()) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.3) {
        lastMatch = id;
      }
    }
    if (lastMatch && lastMatch !== this.active) this.active = lastMatch;
  };

  /**
   * Start listening and return the teardown, for use inside an `$effect`:
   * `$effect(() => spy.observe());`
   */
  observe(): () => void {
    this.update();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(this.update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }
}
