// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * The WIRING of sticky pinning: which of the four `--blocks-table-*` properties
 * a mounted `<Table>` publishes, under which props, with which values, and
 * which `data-*` its layers produce.
 *
 * Three suites divide this subsystem and none of them replaces another:
 *
 *   - `variants/table.sticky.test.ts` asserts the class strings that CONSUME
 *     the properties, and mounts nothing — every one of its assertions passes
 *     while the numbers behind `calc(var(--blocks-table-sticky-top) + …)` are
 *     wrong or missing.
 *   - `utils/sticky-measure.test.ts` asserts what the three attachments write,
 *     driven directly, with no component around them.
 *   - this file asserts that `<Table>` attaches them to the right elements under
 *     the right props, and that what they write lands on the container the CSS
 *     reads from. Until #277 nothing did.
 *
 * jsdom has no layout, so `getBoundingClientRect` is stubbed per element and the
 * observers are fakes. That makes the rig the thing most likely to be wrong, so
 * two rules hold throughout: every claim about something ABSENT is paired, in
 * the same test, with the configuration where the same reading finds it; and the
 * two boxes an element has (border and content) are modelled apart, so an
 * assertion can say WHICH one travelled. Whether the box actually caps and where
 * the pinned layers land needs a layout engine — `e2e/table-contained.spec.ts`.
 */

const ITEMS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
  dept: i % 2 ? 'Design' : 'Platform'
}));

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'dept', title: 'Department', groupable: true }
];

/**
 * Two boxes per measured element, because the module reads the BORDER box while
 * a `ResizeObserverEntry`'s `contentRect` is the CONTENT box (#272/#304). With
 * one number per element, a reading of the wrong box is indistinguishable from a
 * reading of the right one.
 *
 * Fractional on purpose: a `<thead>` under `border-collapse: collapse` carries
 * half of the collapsed 1px border, so its border box lands on a half pixel
 * (measured 40.5px in chromium at the default 16px root, `size="md"`). The
 * published value has to keep that fraction.
 */
const BOXES: Record<string, { border: number; content: number }> = {
  '[data-table-toolbar]': { border: 56.4, content: 54.4 },
  thead: { border: 40.6, content: 39.6 }
};

/**
 * Where the container starts inside its shell — fractional for the same reason.
 * `--blocks-table-avail-top` is the space RESERVED above the box, the smallest
 * distance to the viewport top it can be brought to. In the plain page flow that
 * is 0 whatever this number says, because the reader scrolls the table up. So
 * the tests that need a non-zero reservation mount inside a clipping pane
 * (`shell: 'clipped'`), where nothing scrolls and this offset is held above the
 * box for good — and a flow mount reading `0px` is told apart from a walk that
 * measured nothing by the same rig reading `120.5px` in the pane.
 */
const CONTAINER_TOP = 120.5;
const CONTAINER_WIDTH = 1000;

let containerTop = CONTAINER_TOP;
let originalRect: typeof Element.prototype.getBoundingClientRect;

function boxOf(el: Element): { border: number; content: number } {
  for (const [selector, box] of Object.entries(BOXES)) {
    if (el.matches?.(selector)) return box;
  }
  const height = el.getBoundingClientRect().height;
  return { border: height, content: height };
}

function stubbedRect(el: Element): { top: number; height: number; width: number } {
  if (el.matches('[data-table-container]')) {
    return { top: containerTop, height: 0, width: CONTAINER_WIDTH };
  }
  for (const [selector, box] of Object.entries(BOXES)) {
    // `getBoundingClientRect()` IS the border box, which is why the border half
    // of the pair is what the stub reports here.
    if (el.matches(selector)) return { top: 0, height: box.border, width: CONTAINER_WIDTH };
  }
  return { top: 0, height: 0, width: 0 };
}

/** A `ResizeObserverEntry` carrying both boxes, as a real one does. */
function entryFor(el: Element, size = boxOf(el)): ResizeObserverEntry {
  const width = el.getBoundingClientRect().width;
  return {
    target: el,
    contentRect: { height: size.content, width },
    borderBoxSize: [{ blockSize: size.border, inlineSize: width }],
    contentBoxSize: [{ blockSize: size.content, inlineSize: width }]
  } as unknown as ResizeObserverEntry;
}

/**
 * Whether `observe()` delivers its initial observation. Real observers do, and
 * the default models that: it is the ONLY source of the measured heights — there
 * is no attach-time reading any more, so with delivery off nothing is written,
 * and a test can show the values come from the observation and from nowhere
 * else.
 */
let deliverInitialObservation = true;

/** The ancestor the table mounts under: the page flow, or a pane that clips. */
type Shell = 'flow' | 'clipped';

/** Observers the component created, so a test can drive them. */
class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  targets = new Set<Element>();
  constructor(readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
    // A real `observe()` delivers an initial observation, inside the frame the
    // element mounts in. A fake that skips it lets a suite pin a state the
    // browser holds for under a frame — which is how #272 was mis-measured.
    if (deliverInitialObservation) this.deliver(el);
  }
  deliver(el: Element, size?: { border: number; content: number }) {
    this.callback([entryFor(el, size)], this as unknown as ResizeObserver);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
}

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];
  targets = new Set<Element>();
  constructor(readonly callback: IntersectionObserverCallback) {
    TestIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
}

/**
 * Fire a resize for every observer watching `el`. Without `size`, the element's
 * current stubbed geometry is delivered — which is what a reflow ABOVE the table
 * looks like, where the observed element itself did not change size.
 */
function resizeTo(el: Element, size?: { border: number; content: number }) {
  for (const observer of TestResizeObserver.instances) {
    if (!observer.targets.has(el)) continue;
    observer.deliver(el, size);
  }
  flushSync();
}

/** Fire an intersection change for every observer watching `el`. */
function setIntersecting(el: Element, isIntersecting: boolean) {
  for (const observer of TestIntersectionObserver.instances) {
    if (!observer.targets.has(el)) continue;
    observer.callback(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver
    );
  }
  flushSync();
}

const mounted: Array<{ comp: Record<string, unknown>; target: HTMLElement }> = [];

function mountTable(props: Record<string, unknown> = {}, shell: Shell = 'flow'): HTMLElement {
  const target = document.createElement('div');
  // A clipping pane holds whatever sits above the box in place — the walk in
  // `minReachableTop` adds the container's offset inside it to the reservation.
  if (shell === 'clipped') target.style.setProperty('overflow-y', 'hidden');
  document.body.appendChild(target);
  // Typed wide, like the mobile-decisions helper next door: the harness pins
  // its own Row shape and these deliberately minimal fixtures are not it.
  const merged: Record<string, unknown> = { items: ITEMS, columns: COLUMNS, ...props };
  const comp = mount(TableHarness, { target, props: merged }) as Record<string, unknown>;
  flushSync();
  mounted.push({ comp, target });
  return target.querySelector('[data-table-container]') as HTMLElement;
}

/** What the container publishes to the CSS below it. */
function properties(container: HTMLElement) {
  return {
    stickyTop: container.style.getPropertyValue('--blocks-table-sticky-top'),
    toolbarH: container.style.getPropertyValue('--blocks-table-toolbar-h'),
    theadH: container.style.getPropertyValue('--blocks-table-thead-h'),
    availTop: container.style.getPropertyValue('--blocks-table-avail-top')
  };
}

beforeEach(() => {
  containerTop = CONTAINER_TOP;
  deliverInitialObservation = true;
  originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function boundingRect(this: Element) {
    const { top, height, width } = stubbedRect(this);
    return {
      top,
      height,
      width,
      bottom: top + height,
      left: 0,
      right: width,
      x: 0,
      y: top,
      toJSON: () => ({})
    } as DOMRect;
  };
  TestResizeObserver.instances = [];
  TestIntersectionObserver.instances = [];
  window.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  window.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  for (const { comp, target } of mounted.splice(0)) {
    unmount(comp);
    target.remove();
  }
  Element.prototype.getBoundingClientRect = originalRect;
});

describe('the four --blocks-table-* properties reach the container', () => {
  it('publishes the consumer offset always, and the three measured ones never by default', () => {
    const plain = properties(mountTable());
    // The pinned configuration is the control: the same three readings find
    // their values there, so the empty strings above are absence and not a
    // broken read path. In the page flow the reservation is 0 — the reader can
    // scroll the table to the top — so the same mount inside a clipping pane is
    // the control that the walk measured, rather than defaulting to zero.
    const pinned = properties(mountTable({ sticky: 'both', fit: 'viewport' }));
    const paned = properties(mountTable({ sticky: 'both', fit: 'viewport' }, 'clipped'));

    expect(plain.stickyTop).toBe('0px');
    expect(plain.toolbarH).toBe('');
    expect(plain.theadH).toBe('');
    expect(plain.availTop).toBe('');

    expect(pinned.theadH).toBe('40.6px');
    expect(pinned.availTop).toBe('0px');
    expect(paned.availTop).toBe('120.5px');
  });

  it('measures the toolbar only where the toolbar pins — which contained mode is not', () => {
    const pinned = properties(mountTable({ sticky: 'toolbar' }));
    // `fit="viewport"` supersedes `sticky` entirely: the toolbar is a static
    // flex sibling outside the scroll box, so its height is never measured,
    // even though the same table pins its thead.
    const contained = properties(mountTable({ sticky: 'both', fit: 'viewport' }));

    expect(pinned.toolbarH).toBe('56.4px');
    expect(contained.toolbarH).toBe('');
    expect(contained.theadH).toBe('40.6px');
  });

  it('measures the thead only where the header layer pins', () => {
    const headerOnly = properties(mountTable({ sticky: 'header' }));
    const toolbarOnly = properties(mountTable({ sticky: 'toolbar' }));

    expect(headerOnly.theadH).toBe('40.6px');
    expect(toolbarOnly.theadH).toBe('');
    expect(toolbarOnly.toolbarH).toBe('56.4px');
  });

  it('publishes the measured heights unrounded', () => {
    const { toolbarH, theadH } = properties(mountTable({ sticky: 'both' }));

    // A fractional px is valid CSS, and rounding the `<thead>`'s half pixel up
    // put the group header 0.5px below the header's bottom edge — a gap between
    // two opaque layers shows the scrolling content through it (a full device
    // pixel at DPR 2), while an overlap of the same size is invisible (#272).
    // 56.4 and 40.6 arrive as measured, not as 56 and 41.
    expect(toolbarH).toBe('56.4px');
    expect(theadH).toBe('40.6px');
  });

  it('publishes the border box on both readings, not the content box', () => {
    // What the `calc()` chains stack is each layer's OUTER height: a consumer
    // `slotClasses.toolbar` with padding pushes the thead down by that padding
    // too. The rig models the two boxes 2px apart, so these numbers name the
    // box — the content box would arrive as 54.4px and 39.6px.
    const container = mountTable({ sticky: 'both' });
    const toolbar = container.querySelector('[data-table-toolbar]') as HTMLElement;

    expect(properties(container).toolbarH).toBe('56.4px');
    expect(properties(container).theadH).toBe('40.6px');

    // And on the observed reading, where the entry carries both boxes and they
    // disagree — the case that had the first frame and every later one writing
    // different numbers.
    resizeTo(toolbar, { border: 92.4, content: 88.4 });
    expect(properties(container).toolbarH).toBe('92.4px');
  });

  it('the measured heights come from the initial observation, and from nowhere else', () => {
    // There is no attach-time reading: `borderBoxHeight` takes the observer
    // entry, so the first value the container carries is the one the initial
    // observation delivers — in the browser inside the mounting frame, before
    // paint. When a second read path existed it read a different box, and a
    // padded toolbar pinned the thead 32px too low for one frame and permanently
    // too high afterwards (#272). With the observation suppressed nothing is
    // written, which is the proof there is no other path.
    deliverInitialObservation = false;
    const unobserved = properties(mountTable({ sticky: 'both' }));

    expect(unobserved.toolbarH).toBe('');
    expect(unobserved.theadH).toBe('');

    // POSITIVE CONTROL: delivered, the same rig carries both heights — so the
    // empty strings above are the absence of a path, not a broken write.
    deliverInitialObservation = true;
    const observed = properties(mountTable({ sticky: 'both' }));

    expect(observed.toolbarH).toBe('56.4px');
    expect(observed.theadH).toBe('40.6px');
  });

  it('carries stickyOffset into sticky-top, and drops it in the contained box', () => {
    const pageRelative = properties(mountTable({ sticky: 'both', stickyOffset: 48 }));
    // The contained thead pins to the top of the BOX, so a page-relative offset
    // would push it out of view inside its own scroll container.
    const contained = properties(mountTable({ fit: 'viewport', stickyOffset: 48 }));

    expect(pageRelative.stickyTop).toBe('48px');
    expect(contained.stickyTop).toBe('0px');
  });

  it('clamps a negative reservation to zero', () => {
    // A container pulled above its clipping pane's top edge (a negative margin,
    // a translate) has a negative offset in it — and `100dvh - (-12px)` is a box
    // taller than the window it is supposed to fit inside.
    const positive = properties(mountTable({ fit: 'viewport' }, 'clipped'));
    containerTop = -12;
    const pulledUp = properties(mountTable({ fit: 'viewport' }, 'clipped'));

    expect(positive.availTop).toBe('120.5px');
    expect(pulledUp.availTop).toBe('0px');
  });

  it('re-measures on resize instead of freezing the mount-time reading', () => {
    const container = mountTable({ sticky: 'both' });
    const toolbar = container.querySelector('[data-table-toolbar]') as HTMLElement;
    const thead = container.querySelector('thead') as HTMLElement;

    expect(properties(container).toolbarH).toBe('56.4px');

    // A filter chip wraps: the toolbar grows and the thead's pin line has to
    // follow it, or the header pins under the toolbar and hides a row.
    resizeTo(toolbar, { border: 92.4, content: 90.4 });
    expect(properties(container).toolbarH).toBe('92.4px');

    resizeTo(thead, { border: 64.2, content: 63.2 });
    expect(properties(container).theadH).toBe('64.2px');
  });

  it('re-measures the reservation when the chrome above the table reflows', () => {
    const container = mountTable({ fit: 'viewport' }, 'clipped');
    expect(properties(container).availTop).toBe('120.5px');

    // `measureViewportOffsetTop` watches the body — a banner growing above the
    // table inside a pane that clips is held there for good, so the reservation
    // grows by the same amount and the cap has to shrink by it.
    containerTop = 180.5;
    resizeTo(document.body);
    expect(properties(container).availTop).toBe('180.5px');
  });

  it('reserves nothing for space that would leave the box no height', () => {
    const container = mountTable({ fit: 'viewport' }, 'clipped');
    expect(properties(container).availTop).toBe('120.5px');

    // Space a whole viewport tall is not chrome the reader keeps in view, it is
    // content they scroll away — and `100dvh - <that>` is a table of zero
    // height, the worse of the two failures (a box reaching past the viewport is
    // a second scrollbar; a box of zero height is no table). So it is clamped to
    // a value, not discarded: the property is always written.
    containerTop = window.innerHeight;
    resizeTo(document.body);
    expect(properties(container).availTop).toBe('0px');

    // POSITIVE CONTROL through the same path: a reservation that leaves the box
    // room is written as measured, so the `0px` above is the clamp and not a
    // notification path that never fired.
    containerTop = 180.5;
    resizeTo(document.body);
    expect(properties(container).availTop).toBe('180.5px');
  });
});

describe('the data-* producers', () => {
  it('data-fit reports the resolved model, not the prop', () => {
    // `virtualized` brings its own bounded scroll box, so `contained` is
    // refused rather than layered on top of it.
    expect(mountTable({ fit: 'viewport' }).dataset.fit).toBe('viewport');
    expect(mountTable({ fit: 'viewport', virtualized: true }).dataset.fit).toBe('content');
    expect(mountTable().dataset.fit).toBe('content');
  });

  it('the contained box refuses to measure its offset when virtualization wins', () => {
    const contained = properties(mountTable({ fit: 'viewport' }, 'clipped'));
    const virtualized = properties(mountTable({ fit: 'viewport', virtualized: true }, 'clipped'));

    expect(contained.availTop).toBe('120.5px');
    expect(virtualized.availTop).toBe('');
  });

  it('both layout roots are in the DOM in every configuration', () => {
    // The premise of the e2e layout assertions, pinned here: which layout
    // renders is a CSS question (`display`), and asking the DOM whether a node
    // exists answers a different one. Both roots are always mounted.
    for (const props of [{}, { fit: 'viewport' }, { cardsBelow: '24rem' }, { sticky: 'both' }]) {
      const container = mountTable(props);
      expect(container.querySelector('[data-table-layout="desktop"]')).toBeTruthy();
      expect(container.querySelector('[data-table-layout="mobile"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="mobile-table"]')).toBeTruthy();
    }
  });

  it('the toolbar is the only layer with a stuck state', () => {
    const container = mountTable({ sticky: 'both', viewDefaults: { groupBy: 'dept' } });
    const toolbar = container.querySelector('[data-table-toolbar]') as HTMLElement;
    const sentinel = container.querySelector('[data-sticky-sentinel]') as HTMLElement;
    const thead = container.querySelector('thead') as HTMLElement;
    const groupRow = container.querySelector('[data-testid^="grouped-row-"]') as HTMLElement;

    // One producer, and a live one: the sentinel leaving the viewport is what
    // "stuck" means here.
    expect(toolbar.getAttribute('data-stuck')).toBe('false');
    setIntersecting(sentinel, false);
    expect(toolbar.getAttribute('data-stuck')).toBe('true');
    setIntersecting(sentinel, true);
    expect(toolbar.getAttribute('data-stuck')).toBe('false');

    // The two layers below it have no stuck state — not an attribute missing
    // behind a `headerStuck` nothing wrote, which is what #309 deleted, but the
    // contract: they pin against the box, which scrolls with them, so there is
    // no edge for a shadow to mark. The toolbar assertions above are the control
    // that proves this rig sees the attribute where it exists, in both states.
    // Giving either layer a stuck state turns these two lines red.
    expect(thead.getAttribute('data-stuck')).toBe(null);
    expect(groupRow?.getAttribute('data-stuck') ?? null).toBe(null);
  });

  it('the stuck sentinel exists only where the toolbar pins', () => {
    const pinned = mountTable({ sticky: 'toolbar' });
    const contained = mountTable({ fit: 'viewport' });
    const plain = mountTable();

    expect(pinned.querySelector('[data-sticky-sentinel]')).toBeTruthy();
    expect(contained.querySelector('[data-sticky-sentinel]')).toBe(null);
    expect(plain.querySelector('[data-sticky-sentinel]')).toBe(null);
  });

  it('data-table-container is on the same element as data-fit and the properties', () => {
    // The measuring attachments resolve their target with
    // `closest('[data-table-container]')`, so the marker and the element that
    // carries the custom properties have to be one and the same node.
    const container = mountTable({ fit: 'viewport' }, 'clipped');

    expect(container.hasAttribute('data-table-container')).toBe(true);
    expect(container.dataset.fit).toBe('viewport');
    expect(container.style.getPropertyValue('--blocks-table-avail-top')).toBe('120.5px');
  });
});

describe('the thead and the group header are one decision', () => {
  // `StickyMode` carries ONE flag for both (#309): the group header is the
  // contextual continuation of the column header, and a mode where one pins
  // without the other has no reading. Asserted on the rendered classes rather
  // than on the resolver, so the wiring from that flag to the two elements is
  // covered too — they are styled by two different variant configs.
  for (const [label, props, pinned] of [
    ['sticky="header"', { sticky: 'header' }, true],
    ['sticky="both"', { sticky: 'both' }, true],
    ['sticky="toolbar"', { sticky: 'toolbar' }, false],
    ['no sticky', {}, false],
    ['fit="viewport"', { fit: 'viewport' }, true]
  ] as const) {
    it(`${label}: thead and group header agree`, () => {
      const container = mountTable({ ...props, viewDefaults: { groupBy: 'dept' } });
      const thead = container.querySelector('thead') as HTMLElement;
      const groupRow = container.querySelector('[data-testid^="grouped-row-"]') as HTMLElement;

      expect(groupRow).toBeTruthy();
      expect(thead.classList.contains('sticky')).toBe(pinned);
      expect(groupRow.classList.contains('sticky')).toBe(pinned);
    });
  }
});
