// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ScrollerHarness from './__fixtures__/ScrollerHarness.svelte';

// Interaction layer for Scroller. The contract under test is the one the plan
// calls the row's whole point: a row that FITS is an ordinary row (no tab stop,
// no group, no controls), and only a row that OVERFLOWS takes on the duties of
// a scroll container.
//
// jsdom has no layout, so every size the component measures would be 0 and each
// assertion below would pass vacuously. The stubs installed here model a real
// browser's geometry instead, and they model one distinction on purpose:
// `offsetLeft`/`offsetWidth` report the LAYOUT box, while
// `getBoundingClientRect()` reports the VISUAL one — inflated by any transform.
// The stubs deliberately disagree (the rect is returned 4% wider, as the
// `emphasis` lift makes it in a real browser), so a component that measures with
// the rect computes wrong scroll targets and these tests go red. That is not
// hypothetical: it is the bug this file was extended to catch.
//
// House stack: svelte's own mount/unmount, @testing-library/dom + user-event,
// native vitest matchers.

interface ItemBox {
  contentStart: number;
  width: number;
}

const viewportBoxes = new WeakMap<Element, { clientWidth: number; scrollWidth: number }>();
const itemBoxes = new WeakMap<Element, ItemBox>();
const itemViewports = new WeakMap<Element, Element>();
const scrollOffsets = new WeakMap<Element, number>();
/** Every `scrollTo` options object the component passed, in order. */
let scrollToCalls: ScrollToOptions[] = [];

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return viewportBoxes.get(this)?.clientWidth ?? itemBoxes.get(this)?.width ?? 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return viewportBoxes.get(this)?.scrollWidth ?? 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollOffsets.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      scrollOffsets.set(this, value);
    }
  });

  // The layout box — transform-free, scroll-independent, measured from the
  // offsetParent (the viewport, which the component makes `relative`).
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get(this: HTMLElement) {
      return itemBoxes.get(this)?.contentStart ?? 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return itemBoxes.get(this)?.width ?? 0;
    }
  });

  // The VISUAL box — deliberately inflated by 4%, the way the emphasis lift
  // inflates it in a browser. Nothing in the component may measure from this;
  // if anything does, every scroll target below lands short.
  const VISUAL_INFLATION = 1.04;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const item = itemBoxes.get(this);
    if (item) {
      const viewport = itemViewports.get(this);
      const offset = viewport ? (scrollOffsets.get(viewport) ?? 0) : 0;
      const width = item.width * VISUAL_INFLATION;
      const left = item.contentStart - offset - (width - item.width) / 2;
      return {
        left,
        right: left + width,
        width,
        top: 0,
        bottom: 0,
        height: 0
      } as DOMRect;
    }
    return { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 } as DOMRect;
  };

  // The component scrolls via `scrollTo({ left })`; jsdom ships no scrolling, so
  // reflect the write and fire the event a browser would.
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options === 'object' && options) scrollToCalls.push(options);
    const left = typeof options === 'number' ? options : (options?.left ?? 0);
    const max = Math.max(
      0,
      (viewportBoxes.get(this)?.scrollWidth ?? 0) - (viewportBoxes.get(this)?.clientWidth ?? 0)
    );
    scrollOffsets.set(this, Math.min(max, Math.max(0, left)));
    this.dispatchEvent(new Event('scroll'));
  } as typeof Element.prototype.scrollTo;
});

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  scrollToCalls = [];
  document.body.replaceChildren();
});

interface Geometry {
  viewportWidth: number;
  itemWidth: number;
  gap?: number;
  /** Edge padding — what `align="center"` adds so the first/last item can reach the middle. */
  padding?: number;
}

/**
 * Install a geometry on the currently-rendered row. Called BEFORE `flushSync()`
 * so the component's first measurement already sees it — Svelte builds the DOM
 * synchronously in `mount()` but defers `$effect`s to the flush.
 */
function applyGeometry({ viewportWidth, itemWidth, gap = 20, padding = 0 }: Geometry) {
  const root = document.body.querySelector('[data-align]') as HTMLElement;
  const viewport = root.firstElementChild as HTMLElement;
  const items = Array.from(viewport.children) as HTMLElement[];

  const contentWidth = padding * 2 + items.length * itemWidth + Math.max(0, items.length - 1) * gap;
  viewportBoxes.set(viewport, { clientWidth: viewportWidth, scrollWidth: contentWidth });

  items.forEach((item, index) => {
    itemViewports.set(item, viewport);
    itemBoxes.set(item, { contentStart: padding + index * (itemWidth + gap), width: itemWidth });
  });

  return { root, viewport, items };
}

type HarnessProps = Record<string, unknown>;

function render(props: HarnessProps, geometry: Geometry) {
  const instance = mount(ScrollerHarness, {
    target: document.body,
    props: { label: 'Main features', ...props }
  });
  dispose = () => unmount(instance);
  const nodes = applyGeometry(geometry);
  flushSync();
  return nodes;
}

/** A row that comfortably fits: 5×200 + gaps = 1080 inside 1400. */
const FITS: Geometry = { viewportWidth: 1400, itemWidth: 200 };
/** The same row inside 600 — 1080 of content, so it overflows by 480. */
const OVERFLOWS: Geometry = { viewportWidth: 600, itemWidth: 200 };

function scrollViewport(viewport: HTMLElement, left: number) {
  viewport.scrollLeft = left;
  viewport.dispatchEvent(new Event('scroll'));
  flushSync();
}

const dots = () => screen.queryAllByRole('button', { name: /^Item \d+ of \d+$/ });

describe('Scroller — a row that fits is an ordinary row', () => {
  it('takes no tab stop, no group role and no name when nothing overflows', () => {
    const { viewport } = render({}, FITS);

    // The inverse of §3.3: a tab stop on a row with nothing to scroll costs the
    // keyboard user a press and does nothing.
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect(viewport.getAttribute('role')).toBe(null);
    expect(viewport.getAttribute('aria-label')).toBe(null);
    expect(screen.queryByRole('group')).toBe(null);
  });

  it('renders no controls and no dots when nothing overflows', () => {
    render({ controls: 'auto', indicator: 'dots' }, FITS);

    expect(screen.queryByRole('button', { name: 'Next' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Previous' })).toBe(null);
    expect(dots()).toHaveLength(0);
  });

  it('marks the root `data-overflowing` only once it actually overflows', () => {
    const { root } = render({}, FITS);
    expect(root.hasAttribute('data-overflowing')).toBe(false);
  });
});

describe('Scroller — a row that overflows becomes a scroll region', () => {
  it('takes a tab stop and a named group, so the keyboard can scroll it at all', () => {
    const { viewport, root } = render({}, OVERFLOWS);

    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(root.getAttribute('data-overflowing')).toBe('true');
    // Named — an unnamed group is a nameless box to a screen reader.
    expect(screen.getByRole('group', { name: 'Main features' })).toBe(viewport);
  });

  it('handles no arrow keys itself — the browser scrolls a focused container', async () => {
    const user = userEvent.setup();
    const { viewport } = render({}, OVERFLOWS);

    viewport.focus();
    expect(document.activeElement).toBe(viewport);

    await user.keyboard('{ArrowRight}');
    flushSync();
    // No JS scroll handler ran: the position is untouched, which is the point —
    // native scrolling (with the platform's snapping and inertia) is left alone.
    expect(viewport.scrollLeft).toBe(0);
  });
});

describe('Scroller — jump controls', () => {
  it('disables previous at the leading edge and next at the trailing edge', async () => {
    const user = userEvent.setup();
    const { viewport } = render({ controls: 'auto' }, OVERFLOWS);

    const previous = screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    // 1080 content − 600 viewport = 480 of travel.
    await user.click(next);
    flushSync();
    expect(viewport.scrollLeft).toBe(480);
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
  });

  it('travels one viewport per press with align="start"', async () => {
    const user = userEvent.setup();
    const { viewport } = render({ controls: 'auto' }, { viewportWidth: 400, itemWidth: 200 });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    flushSync();
    expect(viewport.scrollLeft).toBe(400);
  });

  it('travels one ITEM per press with align="center"', async () => {
    const user = userEvent.setup();
    const { viewport } = render(
      { controls: 'auto', align: 'center' },
      { viewportWidth: 600, itemWidth: 200, padding: 200 }
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));
    flushSync();
    // One item + gap, not one viewport — paging would jump straight past the middle.
    expect(viewport.scrollLeft).toBe(220);
  });

  it('leaves the scroll behavior to CSS rather than passing one', async () => {
    // The row sets `scroll-behavior: smooth` and drops it to `auto` under
    // `prefers-reduced-motion`, so `scrollTo` must NOT override it — passing an
    // explicit behavior here would duplicate the motion decision and quietly
    // ignore the reduced-motion preference the stylesheet already honours.
    const user = userEvent.setup();
    render({ controls: 'auto', indicator: 'dots' }, OVERFLOWS);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(dots()[1] as HTMLElement);
    flushSync();

    expect(scrollToCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of scrollToCalls) {
      expect(call.behavior).toBeUndefined();
    }
  });

  it('keeps both controls mounted but disabled with controls="always" on a row that fits', () => {
    render({ controls: 'always' }, FITS);

    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('omits controls entirely with controls="none", even while overflowing', () => {
    render({ controls: 'none' }, OVERFLOWS);

    expect(screen.queryByRole('button', { name: 'Next' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Previous' })).toBe(null);
  });
});

describe('Scroller — dots', () => {
  it('renders one labelled dot per item and marks the current one with aria-current', () => {
    render({ indicator: 'dots' }, OVERFLOWS);

    const all = dots();
    expect(all).toHaveLength(5);
    expect(all[0]?.getAttribute('aria-label')).toBe('Item 1 of 5');
    expect(all[4]?.getAttribute('aria-label')).toBe('Item 5 of 5');

    // Exactly one is current — the state a screen reader reads and the state the
    // CSS styles are the same attribute, so they cannot drift.
    expect(all.filter((dot) => dot.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(all[0]?.getAttribute('aria-current')).toBe('true');
  });

  it('moves aria-current as the row scrolls', () => {
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);

    scrollViewport(viewport, 440);
    expect(dots()[2]?.getAttribute('aria-current')).toBe('true');
    expect(dots()[0]?.getAttribute('aria-current')).toBe(null);
  });

  it('lights the LAST dot at the end of a start-aligned row', async () => {
    // The defect as it was actually seen: scrolled fully right, items 4 and 5
    // on screen, and dot 3 lit. The last items start further right than
    // scrollLeft can ever reach, so judging them by their raw anchor left their
    // dots permanently dark — and clicking dot 5 visibly landed elsewhere.
    const user = userEvent.setup();
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);

    scrollViewport(viewport, 480); // 1080 content − 600 viewport = the far end
    expect(dots()[4]?.getAttribute('aria-current')).toBe('true');

    // And pressing that dot keeps it lit, rather than handing the mark back.
    scrollViewport(viewport, 0);
    await user.click(dots()[4] as HTMLElement);
    flushSync();
    expect(dots()[4]?.getAttribute('aria-current')).toBe('true');
  });

  it('jumps to the item when a dot is pressed', async () => {
    const user = userEvent.setup();
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);

    await user.click(dots()[2] as HTMLElement);
    flushSync();
    // Item 2 starts at 2 × (200 + 20) = 440.
    expect(viewport.scrollLeft).toBe(440);
    expect(dots()[2]?.getAttribute('aria-current')).toBe('true');
  });

  it('centres the pressed item with align="center"', async () => {
    const user = userEvent.setup();
    const { viewport } = render(
      { indicator: 'dots', align: 'center' },
      { viewportWidth: 600, itemWidth: 200, padding: 200 }
    );

    await user.click(dots()[2] as HTMLElement);
    flushSync();
    // Item 2 spans 640–840; its midpoint 740 lands on the viewport midpoint 300.
    expect(viewport.scrollLeft).toBe(440);
  });

  it('lets the FIRST item reach the middle — the edge-padding guarantee', async () => {
    const user = userEvent.setup();
    const { viewport } = render(
      { indicator: 'dots', align: 'center' },
      { viewportWidth: 600, itemWidth: 200, padding: 200 }
    );

    scrollViewport(viewport, 440);
    await user.click(dots()[0] as HTMLElement);
    flushSync();
    // Resolves to exactly 0 rather than a negative target the browser clamps —
    // the difference between a centred first card and one stuck at the edge.
    expect(viewport.scrollLeft).toBe(0);
    expect(dots()[0]?.getAttribute('aria-current')).toBe('true');
  });

  it('omits dots on a single-item row, where a position indicator says nothing', () => {
    render({ indicator: 'dots', count: 1 }, { viewportWidth: 200, itemWidth: 400 });
    expect(dots()).toHaveLength(0);
  });
});

describe('Scroller — defaults that depend on context', () => {
  it('snaps loosely when start-aligned and firmly when centred', () => {
    // A `start` row is a list you sweep across, so `mandatory` would fight every
    // flick and can strand content between snap points. A `center` row is a
    // stage — the middle IS the unit, and `proximity` there engages so rarely
    // that it reads as "snapping is broken".
    const { viewport } = render({}, OVERFLOWS);
    expect(viewport.className).toContain('snap-proximity');
    expect(viewport.className).not.toContain('snap-mandatory');

    dispose?.();
    document.body.replaceChildren();
    const centred = render({ align: 'center' }, OVERFLOWS);
    expect(centred.viewport.className).toContain('snap-mandatory');
  });

  it('lets an explicit snap prop override the contextual default', () => {
    const { viewport } = render({ align: 'center', snap: 'none' }, OVERFLOWS);
    expect(viewport.className).toContain('snap-none');
    expect(viewport.className).not.toContain('snap-mandatory');
  });

  it('keeps the native scrollbar while nothing else promises there is more', () => {
    const { viewport } = render({ controls: 'none', indicator: 'none' }, OVERFLOWS);
    expect(viewport.className).not.toContain('[scrollbar-width:none]');
  });

  it('hides the native scrollbar once controls take over that job', () => {
    // Otherwise the scrollbar sits directly above the control bar and the row
    // shows three indicators for one fact.
    const { viewport } = render({ controls: 'auto' }, OVERFLOWS);
    expect(viewport.className).toContain('[scrollbar-width:none]');
  });
});

describe('Scroller — DEV warnings for combinations that silently do nothing', () => {
  it('warns when emphasis is set without align="center"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ emphasis: 'strong' }, OVERFLOWS);
    expect(warn.mock.calls.flat().join(' ')).toContain('emphasis has no effect');
    warn.mockRestore();
  });

  it('stays quiet for a correctly centred, lifted row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 3 items' worth of viewport — comfortably inside the pattern.
    render({ emphasis: 'strong', align: 'center' }, OVERFLOWS);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when a centred row is too narrow for the pattern to work', () => {
    // The centring padding then takes over the row and it reads as a layout
    // bug — one card adrift in empty space — rather than a stage.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ align: 'center' }, { viewportWidth: 400, itemWidth: 340 });
    expect(warn.mock.calls.flat().join(' ')).toContain('room for only');
    warn.mockRestore();
  });
});

describe('Scroller — re-measuring', () => {
  it('notices items appearing later and re-measures correctly WHILE scrolled', async () => {
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);
    scrollViewport(viewport, 440);
    expect(dots()).toHaveLength(5);
    expect(dots()[2]?.getAttribute('aria-current')).toBe('true');

    // A sixth item arrives — the shape of a data load finishing after first
    // paint. A ResizeObserver on the container alone would never see this.
    const sixth = document.createElement('div');
    viewport.append(sixth);
    itemViewports.set(sixth, viewport);
    itemBoxes.set(sixth, { contentStart: 5 * 220, width: 200 });
    viewportBoxes.set(viewport, { clientWidth: 600, scrollWidth: 1300 });

    // MutationObserver callbacks are delivered on a microtask.
    await Promise.resolve();
    flushSync();

    expect(dots()).toHaveLength(6);
    // The re-measure happened at scrollLeft = 440, so the item positions are
    // only right if the measurement converts viewport-relative rects back into
    // content coordinates. Drop that conversion and every item reads 440px too
    // early, putting aria-current on the wrong dot.
    expect(dots()[2]?.getAttribute('aria-current')).toBe('true');
    expect(dots()[2]?.getAttribute('aria-label')).toBe('Item 3 of 6');
  });
});

describe('Scroller — onActiveChange', () => {
  it('reports the active index on real transitions only', () => {
    const onActiveChange = vi.fn();
    const { viewport } = render({ onActiveChange }, OVERFLOWS);

    onActiveChange.mockClear();

    scrollViewport(viewport, 440);
    expect(onActiveChange).toHaveBeenCalledWith(2);

    onActiveChange.mockClear();
    // A scroll that stays within the same item must not re-report it.
    scrollViewport(viewport, 450);
    expect(onActiveChange).not.toHaveBeenCalled();
  });
});
