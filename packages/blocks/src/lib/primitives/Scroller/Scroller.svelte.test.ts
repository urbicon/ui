// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
});

interface Geometry {
  viewportWidth: number;
  itemWidth: number;
  /** Per-item widths for a row of content-sized items; overrides `itemWidth`. */
  itemWidths?: number[];
  gap?: number;
  /** Edge padding — what `align="center"` adds so the first/last item can reach the middle. */
  padding?: number;
  /** Trailing edge padding where it differs from the leading one. */
  paddingEnd?: number;
}

/**
 * Install a geometry on the currently-rendered row. Called BEFORE `flushSync()`
 * so the component's first measurement already sees it — Svelte builds the DOM
 * synchronously in `mount()` but defers `$effect`s to the flush.
 */
function applyGeometry({
  viewportWidth,
  itemWidth,
  itemWidths,
  gap = 20,
  padding = 0,
  paddingEnd = padding
}: Geometry) {
  const root = document.body.querySelector('[data-align]') as HTMLElement;
  const viewport = root.firstElementChild as HTMLElement;
  const items = Array.from(viewport.children) as HTMLElement[];

  let start = padding;
  items.forEach((item, index) => {
    const width = itemWidths?.[index] ?? itemWidth;
    itemViewports.set(item, viewport);
    itemBoxes.set(item, { contentStart: start, width });
    start += width + gap;
  });

  const contentWidth = start - (items.length > 0 ? gap : 0) + paddingEnd;
  viewportBoxes.set(viewport, { clientWidth: viewportWidth, scrollWidth: contentWidth });

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

const dots = () => screen.queryAllByRole('button', { name: /^Items? \d+(–\d+)? of \d+$/ });

describe('Scroller — a row that fits is an ordinary row', () => {
  it('takes no tab stop, no group role and no name when nothing overflows', () => {
    const { viewport } = render({}, FITS);

    // The inverse of the focusable viewport: a tab stop on a row with nothing to scroll costs the
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
  it('renders one labelled dot per RESTING PLACE and marks the current one with aria-current', () => {
    // 1080 of content in a 600 viewport → maxScroll 480. Items 4 and 5 begin
    // beyond it, so they share the end of the scroll range: four places, four
    // dots — the last one owning both items and saying so in its label. A dot
    // per item would put five dots on four destinations, and the dot for item
    // 4 would light up item 5's dot when pressed.
    render({ indicator: 'dots' }, OVERFLOWS);

    const all = dots();
    expect(all).toHaveLength(4);
    expect(all[0]?.getAttribute('aria-label')).toBe('Item 1 of 5');
    expect(all[2]?.getAttribute('aria-label')).toBe('Item 3 of 5');
    expect(all[3]?.getAttribute('aria-label')).toBe('Items 4–5 of 5');

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

  it('lights the dot that was pressed — the collapsed tail is ONE honest dot', async () => {
    // The counterintuitive behaviour this replaces: with a dot per item, dots
    // 4 and 5 shared the destination maxScroll, so pressing dot 4 lit dot 5 —
    // "I click A, B lights up". As one range dot there is nothing to lie about:
    // the press lands at the end and the pressed dot carries the mark.
    const user = userEvent.setup();
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);

    scrollViewport(viewport, 480); // 1080 content − 600 viewport = the far end
    expect(dots()[3]?.getAttribute('aria-current')).toBe('true');

    scrollViewport(viewport, 0);
    await user.click(dots()[3] as HTMLElement);
    flushSync();
    expect(viewport.scrollLeft).toBe(480);
    expect(dots()[3]?.getAttribute('aria-current')).toBe('true');
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

  it('judges the widest item, not the first, when the items differ in width', () => {
    // A narrow first chip says nothing about the 300px item that will sit in
    // the middle of a 400px row with barely a neighbour beside it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseLikeABrowser();
    render(
      { align: 'center', itemBasis: 'auto', count: 3 },
      { viewportWidth: 400, itemWidth: 0, itemWidths: [40, 300, 40], gap: 8 }
    );
    expect(warn.mock.calls.flat().join(' ')).toContain('room for only 1.3');
  });
});

/**
 * jsdom's `CSS.supports` accepts every value — `auto` included — so it cannot
 * answer the one question the component asks it. This stands in for a
 * browser's parser on that question: whether the centring calc() survives the
 * basis being substituted into it. The real parser is exercised in a browser
 * (e2e/scroller-centre.spec.ts).
 */
function parseLikeABrowser() {
  return vi
    .spyOn(CSS, 'supports')
    .mockImplementation(
      (_property: string, value?: string) => !/\b(auto|(min|max|fit)-content)\b/.test(value ?? '')
    );
}

describe('Scroller — centring items of different widths', () => {
  // `itemBasis="auto"`: six chips at their content width in a 600px row. The
  // geometry is spaced the way the browser spaces it once the component has
  // written the measured end widths — (600 − 40) / 2 before the first chip,
  // (600 − 180) / 2 after the last.
  const WIDTHS = [40, 160, 70, 130, 110, 180];
  const CHIPS: Geometry = {
    viewportWidth: 600,
    itemWidth: 0,
    itemWidths: WIDTHS,
    gap: 8,
    padding: 280,
    paddingEnd: 210
  };
  const chipRow = { align: 'center', itemBasis: 'auto', count: WIDTHS.length };

  /** Distance from the viewport's middle to the item's middle at the current scroll. */
  function offCentre(viewport: HTMLElement, item: HTMLElement) {
    const box = itemBoxes.get(item) as ItemBox;
    return box.contentStart + box.width / 2 - (viewport.scrollLeft + 300);
  }

  it('asks the CSS parser about the calc() the basis padding resolves to', () => {
    const supports = parseLikeABrowser();
    render(chipRow, CHIPS);
    expect(supports).toHaveBeenCalledWith('padding-left', 'calc(50% - auto/2)');
  });

  it('asks about the basis as computed, so a var() that resolves to auto is seen', () => {
    // The parser accepts any var() as written. jsdom does not substitute
    // custom properties, so this stands in for the browser's computed value of
    // `itemBasis="var(--chip-basis)"` under `--chip-basis: auto`.
    const supports = parseLikeABrowser();
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => (name === '--blocks-scroller-item' ? 'auto' : '')
        }) as CSSStyleDeclaration
    );
    const { viewport } = render({ ...chipRow, itemBasis: 'var(--chip-basis)' }, CHIPS);

    expect(supports).toHaveBeenCalledWith('padding-left', 'calc(50% - auto/2)');
    expect(viewport.style.getPropertyValue('--blocks-scroller-first-item')).toBe('40px');
    expect(viewport.className).not.toContain('var(--blocks-scroller-item)/2');
  });

  it('spaces each end by half its own end item, from the measured widths', () => {
    parseLikeABrowser();
    const { viewport } = render(chipRow, CHIPS);

    expect(viewport.style.getPropertyValue('--blocks-scroller-first-item')).toBe('40px');
    expect(viewport.style.getPropertyValue('--blocks-scroller-last-item')).toBe('180px');
    // Margins on the end items, never padding on the track: padding would
    // narrow the box an item with a `%` width sizes against.
    expect(viewport.className).toContain(
      '[&>:first-child]:ms-[calc(50%_-_var(--blocks-scroller-first-item,0px)/2)]'
    );
    expect(viewport.className).not.toMatch(/(^|\s)(p[xlrse]|ps|pe)-\[calc/);
    expect(viewport.className).not.toContain('var(--blocks-scroller-item)/2');
    // Still a stage: the snap strictness follows `align`, not the basis.
    expect(viewport.className).toContain('snap-mandatory');
  });

  it('leaves a row with a length basis exactly as it was', () => {
    parseLikeABrowser();
    const { viewport } = render({ align: 'center' }, OVERFLOWS);
    expect(viewport.getAttribute('style')).toBe('--blocks-scroller-item: 16rem;');
    expect(viewport.className).toContain('px-[calc(50%_-_var(--blocks-scroller-item)/2)]');
  });

  it('writes no end widths for a start-aligned row, which has no centring padding', () => {
    parseLikeABrowser();
    const { viewport } = render(
      { itemBasis: 'auto', count: WIDTHS.length },
      { ...CHIPS, padding: 0, paddingEnd: 0 }
    );
    expect(viewport.getAttribute('style')).toBe('--blocks-scroller-item: auto;');
  });

  it('centres the pressed chip and lights its dot, first and last included', async () => {
    const user = userEvent.setup();
    parseLikeABrowser();
    const { viewport, items } = render({ ...chipRow, indicator: 'dots' }, CHIPS);

    expect(dots()).toHaveLength(WIDTHS.length);
    for (const [index, item] of [...items.entries()].reverse()) {
      await user.click(dots()[index] as HTMLElement);
      flushSync();
      expect(offCentre(viewport, item)).toBe(0);
      expect(dots()[index]?.getAttribute('aria-current')).toBe('true');
    }
  });

  it('steps one chip per press and stops on the last', async () => {
    const user = userEvent.setup();
    parseLikeABrowser();
    const { viewport, items } = render({ ...chipRow, controls: 'auto' }, CHIPS);
    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;

    for (const item of items.slice(1)) {
      await user.click(next);
      flushSync();
      expect(offCentre(viewport, item)).toBe(0);
    }
    expect(next.disabled).toBe(true);
  });

  it('has the end widths in place before a consumer onMount can scroll', () => {
    // A consumer's scroll aims at the layout it finds. Without the widths the
    // ends sit at the 50% fallback, and once they land the row has moved by
    // half the first chip under a smooth scroll that is still aiming at the
    // old place (e2e/scroller-centre.spec.ts).
    parseLikeABrowser();
    let seen: string | undefined;
    render(
      {
        ...chipRow,
        onmount: () => {
          const viewport = document.querySelector('[data-align]')?.firstElementChild;
          seen = (viewport as HTMLElement).style.getPropertyValue('--blocks-scroller-first-item');
        }
      },
      CHIPS
    );
    expect(seen).toBe('40px');
  });

  it('never scrolls the row itself, neither when it loads nor when the end widths change', async () => {
    // The position belongs to the user and the consumer. The engine snaps the
    // first chip into the middle from the server render on, so the end widths
    // land with nothing to correct (e2e/scroller-centre.spec.ts); a scroll of
    // the component's own would override a consumer that moved the row first.
    const user = userEvent.setup();
    parseLikeABrowser();
    const { viewport } = render({ ...chipRow, indicator: 'dots' }, CHIPS);
    await tick();
    flushSync();
    expect(scrollToCalls).toEqual([]);

    await user.click(dots()[3] as HTMLElement);
    flushSync();
    const placed = viewport.scrollLeft;
    scrollToCalls = [];
    const chip = document.createElement('span');
    viewport.append(chip);
    itemViewports.set(chip, viewport);
    itemBoxes.set(chip, { contentStart: 1018, width: 96 });
    await Promise.resolve();
    await tick();
    flushSync();
    expect(viewport.style.getPropertyValue('--blocks-scroller-last-item')).toBe('96px');
    expect(scrollToCalls).toEqual([]);
    expect(viewport.scrollLeft).toBe(placed);
  });

  it('re-measures the last chip when one is appended', async () => {
    parseLikeABrowser();
    const { viewport } = render(chipRow, CHIPS);

    const chip = document.createElement('span');
    viewport.append(chip);
    itemViewports.set(chip, viewport);
    itemBoxes.set(chip, { contentStart: 1018, width: 96 });

    // MutationObserver callbacks are delivered on a microtask.
    await Promise.resolve();
    flushSync();
    expect(viewport.style.getPropertyValue('--blocks-scroller-last-item')).toBe('96px');
    expect(viewport.style.getPropertyValue('--blocks-scroller-first-item')).toBe('40px');
  });
});

describe('Scroller — where there is no CSS namespace', () => {
  // jsdom before 30 ships no `CSS`, and a consumer suite on it mounts every
  // Scroller its pages hold — start-aligned ones included.
  const css = globalThis.CSS;
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, 'CSS');
    // Positive control: without it every case below passes vacuously.
    expect(typeof CSS).toBe('undefined');
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'CSS', { value: css, configurable: true, writable: true });
  });

  it('mounts a start-aligned row', () => {
    expect(() => render({}, OVERFLOWS)).not.toThrow();
  });

  it('keeps a centred row with a length basis on its CSS padding', () => {
    const { viewport } = render({ align: 'center' }, OVERFLOWS);
    expect(viewport.className).toContain('px-[calc(50%_-_var(--blocks-scroller-item)/2)]');
  });

  it('still takes a centred `auto` row for what it is', () => {
    const { viewport } = render(
      { align: 'center', itemBasis: 'auto', count: 6 },
      { viewportWidth: 600, itemWidth: 100 }
    );
    expect(viewport.className).toContain('[&>:first-child]:ms-[');
    expect(viewport.style.getPropertyValue('--blocks-scroller-first-item')).toBe('100px');
  });
});

describe('Scroller — re-measuring', () => {
  it('notices items appearing later and re-measures correctly WHILE scrolled', async () => {
    const { viewport } = render({ indicator: 'dots' }, OVERFLOWS);
    scrollViewport(viewport, 440);
    // Four places for five items — the tail (items 4–5) shares one dot.
    expect(dots()).toHaveLength(4);
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

    // 1300 of content in a 600 viewport → maxScroll 700. Items 5 and 6 (at 880
    // and 1100) collapse onto it: five resting places for six items.
    expect(dots()).toHaveLength(5);
    expect(dots()[4]?.getAttribute('aria-label')).toBe('Items 5–6 of 6');
    // The re-measure happened at scrollLeft = 440. `offsetLeft` is measured
    // from the offsetParent and is scroll-independent, so the item positions
    // stay in content coordinates — measure from the visual rect instead
    // (which the stubs shift by the scroll offset) and every item reads 440px
    // too early, putting aria-current on the wrong dot.
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
