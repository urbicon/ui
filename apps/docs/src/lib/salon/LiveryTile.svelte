<script lang="ts">
  import { untrack } from 'svelte';
  import { BlocksProvider } from '@urbicon-ui/blocks';
  import { DEFAULT_LIVERY, LIVERIES, liveryById } from '$lib/livery';
  // Livery-Tokens + Container-Shim reisen mit der Kachel — nur Routen, die eine
  // Livery zeigen, laden das CSS (in chat-demo lag es global in app.css).
  import '$lib/livery/liveries.css';
  import '$lib/livery/livery-shim.gen.css';
  import SalonBooking from './SalonBooking.svelte';

  /**
   * The chat/livery exhibit, as one self-contained tile.
   *
   * Built to drop into a `Scroller` row beside other exhibits, so it obeys the
   * three rules such a row needs:
   *
   * 1. **Self-contained.** The livery hangs off THIS element, not the document
   *    root, so a violet dark house can sit inside a light page without
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
   * The tile deliberately carries NO composer and no salon chrome: it is a
   * specimen, and the one gesture it offers is the livery switch — which is
   * the thing being proven.
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
  class="flex h-full min-h-0 flex-col overflow-hidden rounded-contain border border-border-default bg-surface-base"
  {@attach whenVisible}
>
  <!--
    Stage.

    `stage` turns the message list's own scrolling OFF (see the style block):
    a tile is a CROP, not a scrollable chat. The first attempt kept the list
    scrollable and tried to scroll it back to the top after settling — the
    list's auto-scroll-to-newest ran after that and won every time, so the tile
    opened on the last line of the form. Letting the list take its natural
    height and clipping it here removes the race instead of timing against it.
  -->
  <div class="stage relative min-h-0 flex-1 overflow-hidden">
    {#if mounted}
      <BlocksProvider defaults={livery.defaults}>
        <SalonBooking instant autoStart composer={false} />
      </BlocksProvider>
    {/if}
    <!-- The stage fades at the bottom edge so the cropped surface reads as
         "continues" rather than "cut off". -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-base to-transparent"
      aria-hidden="true"
    ></div>
  </div>

  <!-- The one gesture. -->
  <div class="flex flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-3">
    <span class="text-3xs uppercase tracking-[0.2em] text-text-tertiary">Livery</span>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Salon livery">
      {#each LIVERIES as option (option.id)}
        <button
          type="button"
          class={[
            'cursor-pointer rounded-modify border px-2.5 py-1 text-3xs uppercase tracking-[0.14em]',
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
</style>
