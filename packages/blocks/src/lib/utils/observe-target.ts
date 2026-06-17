/**
 * Watch the DOM for a target element's *resolution* changing — appearing (a lazily
 * rendered `data-guide` element) or disappearing (removed, or swapped out by a route
 * change). `onChange(next)` fires whenever `resolve()` returns a different element than
 * the previous call, coalesced to at most one resolve per animation frame so a burst of
 * unrelated mutations (e.g. a live table re-rendering rows) stays cheap.
 *
 * This complements {@link autoUpdate}, which only tracks the *position and size* of an
 * element that already exists — it cannot notice one that is not in the DOM yet, nor one
 * that has been removed. The Guide surfaces (tour bubble + hint) use this to re-anchor a
 * step whose target renders after the surface, and to fall back gracefully when a target
 * vanishes mid-flight.
 *
 * SSR / no-`MutationObserver` safe: returns a no-op disconnect when there is no DOM.
 *
 * @param resolve Returns the current target element (or `null` when unresolved).
 * @param onChange Called with the new element each time resolution flips.
 * @returns A disconnect function — call it on cleanup.
 */
export function observeTargetResolution(
  resolve: () => HTMLElement | null,
  onChange: (next: HTMLElement | null) => void
): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  let current = resolve();
  let frame = 0;

  const check = () => {
    frame = 0;
    const next = resolve();
    if (next !== current) {
      current = next;
      onChange(next);
    }
  };

  // Coalesce a burst of mutations into a single resolve on the next frame.
  const schedule = () => {
    if (frame || typeof requestAnimationFrame !== 'function') {
      if (!frame) check();
      return;
    }
    frame = requestAnimationFrame(check);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    // The DOM-fallback resolves via `[data-guide="…"]`, so a flipped attribute can change
    // resolution just like an added/removed node — watch it too (and only it, to stay cheap).
    attributeFilter: ['data-guide']
  });

  return () => {
    observer.disconnect();
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    // Reset so a mutation record that slipped through before disconnect (and would call
    // schedule() once more) takes the coalesce early-return instead of queuing a stray frame.
    frame = 0;
  };
}
