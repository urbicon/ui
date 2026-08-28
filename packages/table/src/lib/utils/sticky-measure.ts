/**
 * The one box this module measures: the element's **border box**.
 *
 * The `calc()` chains that consume the measured properties stack the pinned
 * layers on top of each other (`top: sticky-top + toolbar-h + thead-h`,
 * `table.variants.ts` / `table-features.variants.ts`), so what each layer has to
 * contribute is its *outer* height — a toolbar carrying `slotClasses.toolbar`
 * with padding pushes the thead down by that padding too, and the `<thead>` has
 * a `border-b` in the library's own styling. `ResizeObserverEntry.contentRect`
 * is the **content** box and drops exactly that (#272).
 *
 * `borderBoxSize[0].blockSize` is the same quantity without a layout read, in
 * horizontal writing modes — which the pinning model assumes throughout, since
 * it stacks block-direction sizes into `top`. It is also the *layout* box, where
 * `getBoundingClientRect()` reports the box after transforms: under a
 * `transform: scale(2)` the two disagree by a factor of two, and the `top`
 * offsets the layers stack are layout offsets. Engines without `borderBoxSize`
 * fall back to the rect.
 */
function borderBoxHeight(element: HTMLElement, entry: ResizeObserverEntry): number {
  return entry.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
}

/**
 * `{@attach}` factory that observes the border-box height of an element with
 * `ResizeObserver` and writes it to a CSS custom property on a target element.
 *
 * The target defaults to the closest ancestor matching `[data-table-container]`,
 * which is the outer container set by `Table.svelte`. This keeps the three
 * sticky-pinning layers (toolbar, thead, group-header) reading from the same
 * coordinate origin.
 *
 * @example
 * ```svelte
 * <div {@attach measureToCssVar('--blocks-table-toolbar-h')}>
 *   ...toolbar...
 * </div>
 * ```
 */
export function measureToCssVar(property: string, targetSelector = '[data-table-container]') {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Written unrounded, and a fractional px is valid CSS. A `<thead>`
        // lands on a half pixel whenever a collapsed 1px border sits on it (a
        // consumer's `slotClasses.thead`, or a `header` snippet) and at most
        // root font sizes anyway, since its height is a `rem` value. Rounding
        // that up put the layer below it 0.5px too low, and a gap between two
        // opaque layers shows the scrolling content through it (a full device
        // pixel at DPR 2) while an overlap of the same size is invisible.
        //
        // Unconditionally, never write-if-changed: the property lives in the same
        // inline `style` the component owns, and anything that rewrites that
        // attribute wipes it. An unconditional write means the next observation
        // puts it back; a guard comparing against the last written number sees no
        // change and leaves the property gone for good.
        target.style.setProperty(
          property,
          `${borderBoxHeight(entry.target as HTMLElement, entry)}px`
        );
      }
    });

    // The only reading. `observe()` delivers an initial observation of the current
    // size before the next paint (ResizeObserver spec, "has active or skipped
    // observations" runs in the update-the-rendering steps after layout), so this
    // is also the first write — there is no separate attach-time reading that
    // could be taken from a different box than the observed ones.
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  };
}

/** `overflow` computed values that make an element a scrollport. */
const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;

/** `overflow` computed values that clip without giving the reader a scrollbar. */
const CLIPPING_OVERFLOW = /^(hidden|clip)$/;

/**
 * The space above the element that the reader cannot scroll away — the distance
 * to the top of the viewport it settles at once every scroller between it and
 * the viewport is scrolled as far up as the element needs.
 *
 * Every term is a declared offset, a scroll position paired with the box it
 * scrolls, or the box of an ancestor that scrolling does not move — and none of
 * them changes when something scrolls. That is the property the cap needs: it
 * is consumed by a static `calc()`, so a number that tracks the current scroll
 * makes the box a different height at every scroll offset and lets any reflow
 * that happens to fire re-write it.
 *
 * The walk carries two numbers outwards: `top`, the viewport top of the box the
 * element currently travels with, and `inset`, the distance from that box's
 * content top down to the element, which no scrolling closes. Each ancestor
 * says what the element can do inside it:
 *
 * - a scrollport (`overflow: auto | scroll | overlay`) — the element's place in
 *   the scrolled content is `top - nodeTop + scrollTop`, the same number at every
 *   scroll position. That is what the box reserves: the content above the
 *   element inside the pane scrolls WITH it, not away from it, so a pane with
 *   a heading above the table is exactly a heading tall plus the table — and
 *   the promise is that the pane then does not scroll at all. The walk goes on
 *   with the pane in the element's place.
 * - `overflow: hidden | clip` — clipped with no scrollbar: the offset inside it
 *   is held for good, so it is added and the walk continues. `html`/`body` are
 *   ordinary ancestors under this rule, which is what makes an `overflow:
 *   hidden` app shell come out right without a case of its own.
 * - `position: fixed` — nothing above it moves it. Done.
 * - `position: sticky` with a `top` — it comes to rest at that `top`. This is
 *   #272: measured against the document alone, the value grew with the page
 *   scroll under an ancestor whose `rect.top` stays put, until `calc(100dvh -
 *   value)` went negative and the box collapsed to zero height. A pinned
 *   ancestor ends the walk at its pin line plus the element's offset inside it.
 *
 * Nothing stopped the walk means the page itself is the outermost scroller, and
 * the element's place in the document is `top + scrollY` — invariant under page
 * scroll, which the viewport-relative reading this replaced was not: any reflow
 * while the page was scrolled rewrote it and left the box that much too tall.
 */
function minReachableTop(element: HTMLElement): number {
  let top = element.getBoundingClientRect().top;
  let inset = 0;

  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const nodeTop = node.getBoundingClientRect().top;

    if (style.position === 'fixed') return top + inset;

    if (style.position === 'sticky') {
      const pinned = Number.parseFloat(style.top);
      if (Number.isFinite(pinned)) return Math.max(0, pinned) + (top - nodeTop) + inset;
    }

    if (SCROLLABLE_OVERFLOW.test(style.overflowY)) {
      inset += top - nodeTop + node.scrollTop;
      top = nodeTop;
    } else if (CLIPPING_OVERFLOW.test(style.overflowY)) {
      inset += top - nodeTop;
      top = nodeTop;
    }
  }

  return top + window.scrollY + inset;
}

/**
 * `{@attach}` factory that measures the viewport space reserved **above** an
 * element and writes it to a CSS custom property on the closest
 * `[data-table-container]` (the element itself when attached to the container).
 *
 * Used by `fit="viewport"` to size the contained scroll box via
 * `max-height: calc(100dvh - <reserved>)`. The reserved space is
 * `minReachableTop`, not the element's current `rect.top`: the cap has to hold
 * while the reader scrolls, and a table two screens down a page has to be capped
 * before anyone has scrolled to it at all.
 *
 * What re-measures:
 *
 * - `resize` on the window — the viewport height the cap subtracts from.
 * - `ResizeObserver` on `document.body` and on the container's parent — the two
 *   boxes that change size when what sits above the table does, in the two
 *   shells that exist: one whose body box tracks the flow, and one whose body
 *   never moves and whose pane is content-height. Neither observes the measured
 *   quantity itself; they are where to look again, which is why the staleness
 *   below is not closed by adding a third.
 *
 * No scroll listener anywhere, on the page scroller or below it: the value the
 * cap consumes cannot change when something scrolls, so there is nothing for one
 * to report. Nor a write-if-changed guard — see the note in `measureToCssVar`.
 *
 * The reading can still go stale in **both** directions, and neither is bounded:
 * chrome inserted above the table inside a fixed-height pane resizes no observed
 * box, and so does chrome removed from one — the box is then too tall by that
 * much (it reaches past the viewport bottom) or too short by it (empty space
 * below). An ancestor that becomes a scrollport after the attach (a
 * media-gated `overflow-y: auto`, a class swap) is stale the same way.
 *
 * Offsets *inside* the container (e.g. a growing toolbar / filter chips) do NOT
 * change this value and are absorbed by the flex layout instead.
 *
 * @param declared px the consumer knows to be reserved above the box and the
 *   walk cannot see (`stickyOffset`) — a floor under the measured figure.
 *
 * @example
 * ```svelte
 * <div data-table-container {@attach measureViewportOffsetTop('--blocks-table-avail-top', 64)}>
 *   ...
 * </div>
 * ```
 */
export function measureViewportOffsetTop(
  property: string,
  declared = 0,
  targetSelector = '[data-table-container]'
) {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);

    const apply = () => {
      // The walk sees ancestors only. Chrome that reserves space without being
      // one — a `position: fixed` bar that is a sibling of the table, a header
      // in a fixed-height pane that no observed box reports — is what the
      // consumer declares, and a declared figure is a floor under the measured
      // one: the measured one already includes it wherever it is an ancestor.
      const reserved = Math.max(minReachableTop(element), declared);
      // The cap is `max-height: calc(100dvh - <written>)`, so a value at or past
      // the viewport height is a table of zero height. Space that large is not
      // chrome the reader keeps in view, it is content they scroll away — reserve
      // nothing for it rather than collapsing the box.
      const next = reserved < window.innerHeight ? Math.max(0, reserved) : 0;
      // Unconditionally — see the note in `measureToCssVar`. Writing the same
      // number again changes no layout, so it resizes nothing and cannot feed
      // back into the observers below.
      target.style.setProperty(property, `${next}px`);
    };

    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
    if (element.parentElement) observer.observe(element.parentElement);

    window.addEventListener('resize', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      target.style.removeProperty(property);
    };
  };
}

/**
 * `{@attach}` factory that toggles `data-stuck` on an element based on whether
 * a sentinel placed just above it is visible.
 *
 * The sentinel is the previous-sibling element with the `data-sticky-sentinel`
 * attribute. When the sentinel scrolls out of view (intersectionRatio = 0),
 * the element is considered "stuck" and the callback fires with `true`.
 *
 * @param onStuck callback receiving the latest stuck-state
 * @param rootMarginTop CSS rootMargin top offset (negative pixel string), used
 *   to fire the stuck transition exactly at the pin line (sticky-top).
 */
export function observeStuck(onStuck: (stuck: boolean) => void, rootMarginTop = '0px') {
  return (element: HTMLElement) => {
    const sentinel = element.previousElementSibling as HTMLElement | null;
    if (!sentinel || sentinel.dataset.stickySentinel === undefined) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        onStuck(!entry.isIntersecting);
      },
      {
        threshold: [0, 1],
        rootMargin: `${rootMarginTop} 0px 0px 0px`
      }
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  };
}
