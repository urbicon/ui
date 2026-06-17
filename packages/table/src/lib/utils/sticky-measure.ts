/**
 * `{@attach}` factory that observes the height of an element with `ResizeObserver`
 * and writes it to a CSS custom property on a target element.
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
      target.style.setProperty(property, `${Math.round(height)}px`);
    };

    apply(element.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(entry.contentRect.height);
      }
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  };
}

/**
 * `{@attach}` factory that measures an element's distance from the top of the
 * document (`getBoundingClientRect().top + scrollY`) and writes it to a CSS
 * custom property on the closest `[data-table-container]` (the element itself
 * when attached to the container).
 *
 * Used by `fit="viewport"` to size the contained scroll box via
 * `max-height: calc(100dvh - <offset>)`. The offset is measured
 * document-relative — i.e. invariant under page scroll — so re-measuring can
 * never feed back into the page's own scroll position. It re-measures on
 * viewport resize and when content *above* the table reflows (observed via the
 * document body, whose height tracks the document flow).
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

    const apply = () => {
      const offset = element.getBoundingClientRect().top + window.scrollY;
      target.style.setProperty(property, `${Math.max(0, Math.round(offset))}px`);
    };

    apply();

    // `resize` covers viewport changes; observing the body covers reflow of
    // content above the table (tabs, banners) that shifts the container down.
    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
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
