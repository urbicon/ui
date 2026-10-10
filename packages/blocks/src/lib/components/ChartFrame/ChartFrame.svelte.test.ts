// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expectedCarriers,
  num,
  probeCarriers,
  probes
} from '#lib/internal/charts/__fixtures__/chart-dom.js';
import { CHART_FRAME_SLOTS, type ChartFrameSlot } from '#lib/internal/charts/slots.js';
import ChartFramePlotProbe from './__fixtures__/ChartFramePlotProbe.svelte';
import type { ChartFrameProps } from './index';

/**
 * Without `width` the frame takes its width from a ResizeObserver on its own
 * `<figure>`. jsdom has no layout and no ResizeObserver, and the setup file's
 * stand-in never calls back, so this file installs {@link FakeResizeObserver}.
 * Like the browser's observer it reports the target's size once on
 * `observe()`, unprompted. A fake without that initial report would leave the
 * frame at its 320 px pre-measure width — on the client a state the browser
 * replaces before the first paint. The server-rendered fallback, which a
 * visitor does see, is pinned in `ChartFrame.ssr.test.ts`.
 */
let containerWidth = 0;

class FakeResizeObserver {
  static constructed = 0;
  static readonly live = new Set<FakeResizeObserver>();
  readonly #callback: ResizeObserverCallback;
  readonly #targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
    FakeResizeObserver.constructed++;
    FakeResizeObserver.live.add(this);
  }

  observe(target: Element) {
    this.#targets.add(target);
    // Asynchronous, as in the browser: after the mount, before anything paints.
    queueMicrotask(() => {
      if (this.#targets.has(target)) this.#report(target);
    });
  }

  unobserve(target: Element) {
    this.#targets.delete(target);
  }

  disconnect() {
    this.#targets.clear();
    FakeResizeObserver.live.delete(this);
  }

  #report(target: Element) {
    const entry = { target, contentRect: { width: containerWidth } };
    this.#callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  /** The container now lays out `width` px wide; every live observer reports it. */
  static resize(width: number) {
    containerWidth = width;
    for (const observer of FakeResizeObserver.live) {
      for (const target of observer.#targets) observer.#report(target);
    }
  }
}

let dispose: (() => void) | undefined;

beforeEach(() => {
  containerWidth = 0;
  FakeResizeObserver.constructed = 0;
  FakeResizeObserver.live.clear();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function render(props: Omit<ChartFrameProps, 'children'> = {}): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(ChartFramePlotProbe, { target, props });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

/** The plot the children snippet was handed, read off the mark that fills it. */
function plot(target: Element) {
  const rect = target.querySelector('rect[data-plot]');
  if (!rect) throw new Error('the children snippet did not render');
  const [top, right, bottom, left] = (rect.getAttribute('data-margin') ?? '')
    .split(' ')
    .map(Number);
  return {
    width: num(rect, 'data-width'),
    height: num(rect, 'data-height'),
    innerWidth: num(rect, 'width'),
    innerHeight: num(rect, 'height'),
    margin: { top, right, bottom, left }
  };
}

/** Where the children's local origin sits inside the svg. */
function origin(target: Element): [number, number] {
  const transform = target.querySelector('svg > g')?.getAttribute('transform') ?? '';
  const m = /^translate\((-?[\d.]+),\s*(-?[\d.]+)\)$/.exec(transform);
  if (!m) throw new Error(`not a translate: "${transform}"`);
  return [Number(m[1]), Number(m[2])];
}

function viewBox(target: Element) {
  return target.querySelector('svg')?.getAttribute('viewBox');
}

describe('ChartFrame — the plot box it hands its children', () => {
  it('is the frame minus the default margins, with the local origin at its top-left corner', () => {
    const target = render({ width: 500 });

    expect(plot(target)).toEqual({
      width: 500,
      height: 240,
      innerWidth: 448,
      innerHeight: 204,
      margin: { top: 8, right: 12, bottom: 28, left: 40 }
    });
    const [x, y] = origin(target);
    expect([x, y]).toEqual([40, 8]);
    // A mark filling [0, innerWidth] × [0, innerHeight] stops at the right and
    // bottom margins.
    const { innerWidth, innerHeight } = plot(target);
    expect([x + innerWidth, y + innerHeight]).toEqual([500 - 12, 240 - 28]);
  });

  it('merges a partial margin over the defaults', () => {
    const target = render({ width: 500, margin: { top: 20, left: 0 } });

    expect(plot(target)).toMatchObject({
      innerWidth: 488,
      innerHeight: 192,
      margin: { top: 20, right: 12, bottom: 28, left: 0 }
    });
    expect(origin(target)).toEqual([0, 20]);
  });

  it('shrinks to zero rather than negative when the margins outgrow the frame', () => {
    const target = render({ width: 40, height: 20 });

    expect(plot(target)).toMatchObject({ innerWidth: 0, innerHeight: 0 });
  });

  it('sits in an svg whose viewBox spans the frame, at a fixed height and fluid width', () => {
    const target = render({ width: 500, height: 180 });
    const svg = target.querySelector('svg');

    expect(viewBox(target)).toBe('0 0 500 180');
    expect(svg?.getAttribute('height')).toBe('180');
    expect(svg?.getAttribute('width')).toBe('100%');
  });
});

describe('ChartFrame — where the width comes from', () => {
  it('draws at the width its container reports', async () => {
    containerWidth = 640;
    const target = render();
    await tick();

    expect(plot(target)).toMatchObject({ width: 640, innerWidth: 588 });
    expect(viewBox(target)).toBe('0 0 640 240');
  });

  it('follows its container when it resizes', async () => {
    containerWidth = 640;
    const target = render();
    await tick();

    FakeResizeObserver.resize(480);
    flushSync();

    expect(plot(target)).toMatchObject({ width: 480, innerWidth: 428 });
  });

  it('keeps the last width while its container reports none', async () => {
    containerWidth = 640;
    const target = render();
    await tick();

    // A hidden container (display: none, a collapsed tab) reports a zero box.
    FakeResizeObserver.resize(0);
    flushSync();

    expect(plot(target)).toMatchObject({ width: 640, innerWidth: 588 });
  });

  it('measures nothing when given a fixed width', async () => {
    containerWidth = 640;
    const target = render({ width: 300 });
    await tick();

    expect(FakeResizeObserver.constructed).toBe(0);
    expect(plot(target)).toMatchObject({ width: 300, innerWidth: 248 });
  });

  it('stops observing when unmounted', async () => {
    containerWidth = 640;
    render();
    await tick();
    expect(FakeResizeObserver.live.size).toBe(1);

    dispose?.();
    dispose = undefined;

    expect(FakeResizeObserver.live.size).toBe(0);
  });
});

describe('ChartFrame — around the plot', () => {
  const legend = createRawSnippet(() => ({ render: () => '<ul data-legend><li>A</li></ul>' }));
  const fallback = createRawSnippet(() => ({ render: () => '<table data-fallback></table>' }));

  it('renders the legend as HTML after the svg, and the fallback visually hidden', () => {
    const target = render({ width: 500, legend, fallback });
    const figure = target.querySelector(':scope > figure');

    expect([...(figure?.children ?? [])].map((el) => el.localName)).toEqual(['svg', 'ul', 'div']);
    const hidden = figure?.querySelector(':scope > div');
    expect(hidden?.classList.contains('sr-only')).toBe(true);
    expect(hidden?.querySelector(':scope > table[data-fallback]')).not.toBeNull();
  });

  it('renders nothing beside the svg without them', () => {
    const target = render({ width: 500 });
    const figure = target.querySelector(':scope > figure');

    expect([...(figure?.children ?? [])].map((el) => el.localName)).toEqual(['svg']);
  });

  it('presents the svg as one image, named by ariaLabel', () => {
    const target = render({ width: 500, ariaLabel: 'Weekly revenue' });
    const svg = target.querySelector(':scope > figure > svg');

    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Weekly revenue');
  });

  /** The naming attributes on the figure and on the svg inside it. */
  function names(target: Element) {
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');
    const read = (el: Element | null | undefined) => ({
      label: el?.getAttribute('aria-label'),
      labelledby: el?.getAttribute('aria-labelledby')
    });
    return { figure: read(figure), svg: read(svg) };
  }

  it('puts a plain aria-label on the image it names, not on the figure', () => {
    const target = render({ width: 500, 'aria-label': 'Weekly revenue' });

    expect(names(target)).toEqual({
      figure: { label: null, labelledby: null },
      svg: { label: 'Weekly revenue', labelledby: null }
    });
  });

  it('lets aria-labelledby point the image at a visible caption', () => {
    const target = render({ width: 500, 'aria-labelledby': 'revenue-caption' });

    expect(names(target)).toEqual({
      figure: { label: null, labelledby: null },
      svg: { label: null, labelledby: 'revenue-caption' }
    });
  });

  it('takes ariaLabel over a plain aria-label', () => {
    const target = render({ width: 500, ariaLabel: 'Weekly revenue', 'aria-label': 'Revenue' });

    expect(names(target).svg.label).toBe('Weekly revenue');
  });

  it('spreads the other attributes onto the figure, and none onto the svg', () => {
    const target = render({ width: 500, id: 'revenue-chart', 'data-x': 'probe' });
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');

    expect([figure?.id, figure?.getAttribute('data-x')]).toEqual(['revenue-chart', 'probe']);
    expect([svg?.hasAttribute('id'), svg?.hasAttribute('data-x')]).toEqual([false, false]);
  });
});

describe('ChartFrame — slot contract', () => {
  it('puts root on the figure, beside the class prop, and svg on the svg', () => {
    const target = render({
      width: 500,
      class: 'consumer-class',
      slotClasses: probes(CHART_FRAME_SLOTS)
    });
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');
    if (!figure || !svg) throw new Error('no <figure> > <svg>');
    const pick: Record<ChartFrameSlot, () => Element[]> = {
      root: () => [figure],
      svg: () => [svg]
    };

    expect(probeCarriers(target, CHART_FRAME_SLOTS)).toEqual(
      expectedCarriers(target, CHART_FRAME_SLOTS, pick)
    );
    expect(figure.classList.contains('consumer-class')).toBe(true);
  });
});
