<script lang="ts">
  import { untrack } from 'svelte';
  import { BlocksProvider } from '@urbicon-ui/blocks';
  import { DEFAULT_LIVERY, LIVERIES, liveryById } from '$lib/livery';
  // Livery-Tokens + Container-Shim reisen mit der Kachel — nur Routen, die eine
  // Livery zeigen, laden das CSS (in chat-demo lag es global in app.css).
  import '$lib/livery/liveries.css';
  import '$lib/livery/livery-shim.gen.css';
  import HotelBooking from './HotelBooking.svelte';

  /**
   * The chat/livery exhibit, as one self-contained tile.
   *
   * Built to drop into a `Scroller` row beside other exhibits, so it obeys the
   * three rules such a row needs:
   *
   * 1. **Self-contained.** The livery hangs off THIS element, not the document
   *    root, so a dusk-dark house can sit inside a light page without
   *    touching it. That works because `light-dark()` resolves against the
   *    nearest `color-scheme` — measured, not assumed. `isolation: isolate`
   *    (in liveries.css) keeps the grain layer's `mix-blend-mode` from
   *    blending with whatever is behind the tile.
   * 2. **Never empty.** It settles straight into the finished surface rather
   *    than starting at a play button. Same pipeline, no waiting.
   * 3. **Deferred.** Nothing mounts until the tile is actually near the
   *    viewport. Five live exhibits in one row would otherwise all boot at
   *    once, and a `Scroller` only ever shows one to three of them.
   *
   * The tile deliberately carries NO composer and no hotel chrome: it is a
   * specimen, and the one gesture it offers is the house switch — which is
   * the thing being proven: four sub-brands, one component library.
   *
   * The one thing above the specimen is the demo notice, and it is not chrome
   * either — it is apparatus, like the switch below. It has to be here because
   * the surface below is not inert: the recorded buttons work, so a visitor can
   * reach a filled-in confirmation without ever leaving the landing page, where
   * nothing else says the hotel is a fiction. Held outside the scrolling stage
   * so it cannot be scrolled away from, and painted in `warning`, which no
   * livery overrides — the notice is the one thing that does not change when
   * the house does.
   */

  let {
    /** Which house to show first. */
    initial = DEFAULT_LIVERY.id,
    /**
     * Skip the visibility gate and mount immediately. For a tile above the
     * fold, where deferring only buys a visible pop-in.
     */
    eager = false,
    /** Root margin for the visibility gate — start early enough to look instant. */
    rootMargin = '400px'
  }: { initial?: string; eager?: boolean; rootMargin?: string } = $props();

  // Both of these read a prop for its STARTING value only, on purpose: once the
  // visitor has picked a house, a re-render of the parent must not yank it back
  // to the default, and a tile that has mounted stays mounted. `untrack` states
  // that intent rather than leaving svelte-check to warn about it.
  let liveryId = $state(untrack(() => initial));
  const livery = $derived(liveryById(liveryId));

  let mounted = $state(untrack(() => eager));

  /**
   * Mount when near the viewport.
   *
   * `IntersectionObserver` rather than a scroll handler, and it disconnects
   * after the first hit — this is a one-way gate, not a visibility tracker.
   */
  function whenVisible(node: HTMLElement) {
    if (mounted) return;
    if (typeof IntersectionObserver === 'undefined') {
      mounted = true; // no observer (old browser, jsdom) → never withhold content
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          mounted = true;
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }
</script>

<!--
  `data-livery` without `data-livery-scope="page"` = tile scope: the ground is
  anchored to this element instead of the viewport.
-->
<div
  data-livery={livery.id}
  class="rounded-contain border-border-default bg-surface-base flex h-full min-h-0 flex-col overflow-hidden border"
  {@attach whenVisible}
>
  <!-- Quieter than the band on /hotel on purpose: that page impersonates a
       hotel, this is one specimen in a row of them on the library's own
       landing. Subtle fill, but the same opening words, so the two read as one
       system rather than two unrelated warnings. -->
  <div
    class="border-warning/25 bg-warning-subtle text-warning-emphasis border-b px-4 py-2 text-center text-xs"
  >
    Demo only — a fictional hotel. Nothing here can be booked.
  </div>

  <!--
    Stage.

    `stage` turns the message list's own scrolling OFF (see the style block)
    and scrolls ITSELF instead. The distinction matters: the list's
    auto-scroll-to-newest drives its own viewport (`el.scrollTo`, never
    `scrollIntoView`), so with the list at natural height there is nothing it
    can scroll — the tile always opens on the first frame, and the visitor can
    still scroll down to the booking form the crop would otherwise cut off.
    (The first attempt kept the LIST scrollable and lost the timing race
    against auto-scroll every time.)

    `pb-16` matches the fade height, so the end of the conversation can scroll
    clear of the fade.
  -->
  <div class="relative min-h-0 flex-1">
    <div class="stage h-full overflow-x-hidden overflow-y-auto pb-16">
      {#if mounted}
        <BlocksProvider defaults={livery.defaults}>
          <HotelBooking instant autoStart composer={false} />
        </BlocksProvider>
      {/if}
    </div>
    <!-- Outside the scroller, so it stays put at the visual bottom edge: the
         faded surface reads as "continues" — and now it actually does. -->
    <div
      class="from-surface-base pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent"
      aria-hidden="true"
    ></div>
  </div>

  <!-- The one gesture. -->
  <div class="border-border-subtle flex flex-wrap items-center gap-2 border-t px-4 py-3">
    <span class="text-3xs text-text-tertiary tracking-[0.2em] uppercase">House</span>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="House">
      {#each LIVERIES as option (option.id)}
        <button
          type="button"
          class={[
            'rounded-modify text-3xs cursor-pointer border px-2.5 py-1 tracking-[0.14em] uppercase',
            option.id === liveryId
              ? 'border-primary bg-primary text-text-on-primary'
              : 'border-border-default text-text-secondary hover:text-text-primary'
          ]}
          aria-pressed={option.id === liveryId}
          onclick={() => (liveryId = option.id)}
        >
          {option.name}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  /*
   * The message list ships as a scroll container (`overflow-y: auto`), which is
   * right in a chat and wrong in a specimen. Unsetting it lets the list run to
   * its natural height so the stage above can crop it from the top — no scroll
   * position to fight over, and the exhibit always opens on the same frame.
   *
   * `:global` because the element belongs to the library, not to this file.
   */
  .stage :global([class*='overflow-y-auto']) {
    overflow: visible;
  }

  .stage {
    scrollbar-width: thin;
  }
</style>
