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
 * it stacks block-direction sizes into `top`. Engines without it fall back to
 * the rect, so the initial reading and every observed one come from one
 * definition and cannot disagree.
 */
function borderBoxHeight(element: HTMLElement, entry?: ResizeObserverEntry): number {
  return entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
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

    const apply = (height: number) => {
      // Written unrounded, and a fractional px is valid CSS. Under
      // `border-collapse: collapse` the `<thead>` carries half of the collapsed
      // 1px border, so its border box lands on a half pixel at most root font
      // sizes (40.5px at the default 16px root, `size="md"`). Rounding that up
      // put the layer below it 0.5px too low, and a gap between two opaque
      // layers shows the scrolling content through it (a full device pixel at
      // DPR 2) while an overlap of the same size is invisible.
      target.style.setProperty(property, `${height}px`);
    };

    apply(borderBoxHeight(element));

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(borderBoxHeight(entry.target as HTMLElement, entry));
      }
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  };
}

/** `overflow` computed values that make an element a scrollport. */
const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;

/**
 * `{@attach}` factory that measures how much of the viewport sits **above** an
 * element (`getBoundingClientRect().top`) and writes it to a CSS custom property
 * on the closest `[data-table-container]` (the element itself when attached to
 * the container).
 *
 * Used by `fit="viewport"` to size the contained scroll box via
 * `max-height: calc(100dvh - <offset>)`, which is why the value is
 * viewport-relative: measured document-relative (`+ scrollY`) it grew with the
 * page scroll under a `position: sticky` ancestor — whose `rect.top` stays put —
 * until the cap went negative and the box collapsed to zero height (#272).
 *
 * What re-measures, and the case each one carries:
 *
 * - `resize` on the window — the viewport itself changed.
 * - `ResizeObserver` on `document.body` — shells that scroll the document,
 *   whose body box tracks the flow, so content appearing above the table
 *   resizes it.
 * - `ResizeObserver` on the container's parent — a content-height app-shell
 *   pane, where the body box never changes.
 * - `scroll` on every scrollable ancestor **below** the page scroller — a nested
 *   scrollport moves the box through the viewport (a supported configuration,
 *   see STICKY-PINNING §6).
 *
 * The page scroller is deliberately not among them: the property drives the
 * container's own `max-height`, which changes the document height, so
 * re-measuring on page scroll would close that loop. The value therefore goes
 * stale while the page scrolls — bounded, because it can never turn the cap
 * negative (see `apply`), only let the box reach past the viewport bottom.
 *
 * Not covered for the same reason: a banner inserted into a *fixed-height* pane
 * above the table resizes no observed box and scrolls nothing, so the value
 * holds its last reading until the next resize.
 *
 * Offsets *inside* the container (e.g. a growing toolbar / filter chips) do NOT
 * change this value and are absorbed by the flex layout instead.
 *
 * @example
 * ```svelte
 * <div data-table-container {@attach measureViewportOffsetTop('--blocks-table-avail-top')}>
 *   ...
 * </div>
 * ```
 */
export function measureViewportOffsetTop(
  property: string,
  targetSelector = '[data-table-container]'
) {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);

    let written: number | null = null;

    const apply = () => {
      const top = element.getBoundingClientRect().top;

      // A reading taken while the box already starts below the viewport bottom
      // describes no room at all: written, it would make the cap `100dvh - top`
      // zero or negative, which is the collapse to zero height. Hold the last
      // good value instead — too tall a box is a second scrollbar, not a
      // vanished table — and let the next event correct it.
      if (top >= window.innerHeight) return;

      const next = Math.max(0, top);
      if (next === written) return;
      written = next;
      target.style.setProperty(property, `${next}px`);
    };

    apply();

    const scrollAncestors: HTMLElement[] = [];
    for (
      let node = element.parentElement;
      node && node !== document.body;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (SCROLLABLE_OVERFLOW.test(style.overflowY) || SCROLLABLE_OVERFLOW.test(style.overflowX)) {
        scrollAncestors.push(node);
      }
    }

    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
    if (element.parentElement) observer.observe(element.parentElement);

    window.addEventListener('resize', apply);
    for (const ancestor of scrollAncestors) {
      ancestor.addEventListener('scroll', apply, { passive: true });
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      for (const ancestor of scrollAncestors) {
        ancestor.removeEventListener('scroll', apply);
      }
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
