import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';

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
 * above the first section.
 *
 * **Reading `active` is what starts the listener.** `createSubscriber` attaches
 * the scroll handler when the first effect or template reads the getter, and
 * detaches it when the last one goes away — so a consumer that never reads it
 * (TableOfContents while a layout controls it via `activeSection`) costs
 * nothing, without the call site having to gate an `$effect` by hand. It used
 * to take `$effect(() => spy.observe())` at five call sites, two of which also
 * had to `void` the id list to keep the effect subscribed to it.
 *
 * @see https://svelte.dev/docs/svelte/svelte-reactivity#createSubscriber
 */
export class ScrollSpy {
  readonly #ids: () => string[];
  readonly #subscribe: () => void;

  /**
   * Latch for the sticky behaviour above the first section. Deliberately a
   * plain field, not `$state`: the getter only ever memoizes into it, so it
   * never invalidates anything and cannot mutate state during a render.
   */
  #last = '';

  /** `ids` is read lazily on every recompute, so a reactive source stays live. */
  constructor(ids: () => string[]) {
    this.#ids = ids;

    this.#subscribe = createSubscriber((update) => {
      let raf = 0;
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(update);
      };
      const off = on(window, 'scroll', onScroll, { passive: true });

      return () => {
        cancelAnimationFrame(raf);
        off();
      };
    });
  }

  /**
   * The id of the section the reader is currently in, or `''` before the first
   * one crosses the trigger line. Reactive when read in an effect or template.
   */
  get active(): string {
    // Subscribes this read to the scroll listener (and starts it, if this is
    // the first reader). Called before the DOM guard so an SSR read still
    // registers the dependency for the client.
    this.#subscribe();

    // No DOM during SSR — the ids the server would measure have no geometry.
    if (typeof document === 'undefined') return this.#last;

    let lastMatch = '';
    // Read through the getter so a reactive id source (a `$derived` list)
    // becomes a dependency of whoever read `active` — the call sites used to
    // do this by hand with a bare `void navIds;` inside their effect.
    for (const id of this.#ids()) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.3) {
        lastMatch = id;
      }
    }

    if (lastMatch) this.#last = lastMatch;
    return this.#last;
  }
}
