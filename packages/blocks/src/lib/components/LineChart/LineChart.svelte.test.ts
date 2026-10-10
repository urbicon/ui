// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ChartLocaleHost, {
  registerMarkedLocale
} from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import {
  dataTable,
  expectedCarriers,
  nonFinite,
  num,
  probeCarriers,
  probes,
  titles,
  vertices
} from '#lib/internal/charts/__fixtures__/chart-dom.js';
import { LINE_CHART_SLOTS, type LineChartSlot } from '#lib/internal/charts/slots.js';
import type { LineChartProps } from './index';
import LineChart from './LineChart.svelte';

/**
 * Every mount draws into a fixed 200 × 100 plot: `width` is set and the
 * margins are 0, so plot and frame coordinates coincide. Without `width` the
 * frame measures its container, which jsdom never lays out — every coordinate
 * would derive from the 320 px pre-measure fallback instead. With it the frame
 * measures nothing, and a browser derives the same numbers.
 *
 * Expected geometry is written out by hand from the nice-tick definition, not
 * recomputed through the chart's own helpers.
 */
const PLOT = {
  width: 200,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  formatValue: String
} satisfies Partial<LineChartProps>;

const WEEK = [
  { label: 'Mon', values: [20] },
  { label: 'Tue', values: [40] },
  { label: 'Wed', values: [30] }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mounts the chart; under `locale`, inside a provider that switches to it. */
function render(props: LineChartProps, locale?: Locale): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const merged = { ...PLOT, ...props };
  const app = locale
    ? mount(ChartLocaleHost, { target, props: { locale, chart: LineChart, props: merged } })
    : mount(LineChart, { target, props: merged });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

/** `[cx, cy]` per point marker, in document order. */
function points(target: Element) {
  return [...target.querySelectorAll('circle')].map((c) => [num(c, 'cx'), num(c, 'cy')]);
}

/** The vertices `[x, y]` of each series line, an open polyline. */
function lines(target: Element) {
  return [...target.querySelectorAll('path')].map((path) => vertices(path.getAttribute('d') ?? ''));
}

/**
 * Vertices rounded to the 2 decimals a path's `d` carries. Exact rather than
 * `closeTo`: a half-cent (8.375 → "8.38") sits exactly 0.005 away, which
 * `closeTo(value, 2)` rejects.
 */
function near(coordinates: number[][]) {
  return coordinates.map((vertex) => vertex.map((value) => Number(value.toFixed(2))));
}

/** Value-axis tick labels, bottom tick first. */
function tickLabels(target: Element) {
  return [...target.querySelectorAll('text[text-anchor="end"]')].map((t) => t.textContent?.trim());
}

describe('LineChart — value axis', () => {
  it('frames the data range rather than reaching zero by default', () => {
    const target = render({ data: WEEK });

    expect(tickLabels(target)).toEqual(['20', '25', '30', '35', '40']);
  });

  it('reaches zero under includeZero, and the points move with the axis', () => {
    const target = render({ data: WEEK, includeZero: true });

    expect(tickLabels(target)).toEqual(['0', '10', '20', '30', '40']);
    // 2.5 px per unit now, against 5 when the axis framed [20, 40].
    expect(points(target)).toEqual([
      [0, 50],
      [100, 0],
      [200, 25]
    ]);
  });
});

describe('LineChart — series geometry', () => {
  it('spreads the points across the full plot width, first on the left edge and last on the right', () => {
    const target = render({ data: WEEK });

    expect(points(target)).toEqual([
      [0, 100],
      [100, 0],
      [200, 50]
    ]);
    const categoryX = [...target.querySelectorAll('text[text-anchor="middle"]')].map((t) =>
      num(t, 'x')
    );
    expect(categoryX).toEqual([0, 100, 200]);
  });

  it('draws the line through its points', () => {
    const target = render({ data: WEEK });

    expect(points(target)).toHaveLength(3);
    expect(lines(target)).toEqual([near(points(target))]);
  });

  it('draws one point per series and datum, and a missing value as zero', () => {
    const target = render({
      series: [{ label: 'A' }, { label: 'B' }],
      data: [
        { label: 'a', values: [2, 4] },
        { label: 'b', values: [4] }
      ]
    });

    // B has no value at `b`, so the domain is [0, 4] and B ends on the floor.
    expect(lines(target)).toEqual([
      [
        [0, 50],
        [200, 0]
      ],
      [
        [0, 0],
        [200, 100]
      ]
    ]);
    expect(points(target)).toEqual([
      [0, 50],
      [200, 0],
      [0, 0],
      [200, 100]
    ]);
  });
});

describe('LineChart — degenerate data', () => {
  it('centres a single point horizontally and keeps it inside the plot', () => {
    const target = render({ data: [{ label: 'Only', values: [7] }] });

    const [[cx, cy]] = points(target);
    expect(cx).toBe(100);
    expect(cy).toBeGreaterThanOrEqual(0);
    expect(cy).toBeLessThanOrEqual(100);
    // A lone move-to on the point: nothing to connect, nothing drawn off it.
    expect(lines(target)).toEqual([near([[cx, cy]])]);
    expect(nonFinite(target)).toEqual([]);
  });

  it('draws an empty line and no points for empty data, with no non-finite coordinate', () => {
    const target = render({ data: [] });

    expect(points(target)).toEqual([]);
    expect(lines(target)).toEqual([[]]);
    expect(tickLabels(target).length).toBeGreaterThan(1);
    expect(nonFinite(target)).toEqual([]);
    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Line chart, points: 0, series: 1'
    );
  });

  it('opens a window around a flat series instead of dividing by a zero range', () => {
    const target = render({
      data: [
        { label: 'a', values: [5] },
        { label: 'b', values: [5] },
        { label: 'c', values: [5] }
      ]
    });

    const ys = points(target).map(([, cy]) => cy);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeGreaterThanOrEqual(0);
    expect(ys[0]).toBeLessThanOrEqual(100);
    expect(nonFinite(target)).toEqual([]);
  });
});

describe('LineChart — what a screen reader gets', () => {
  const TEMPERATURES = {
    series: [{ label: 'Low' }, { label: 'High' }],
    data: [
      { label: 'Mon', values: [2, 9] },
      { label: 'Tue', values: [4] }
    ],
    formatValue: (value: number) => `${value}°`
  } satisfies LineChartProps;

  it('lets a plain aria-label name the image and caption the table, not the figure', () => {
    const target = render({ ...TEMPERATURES, 'aria-label': 'Temperatures' });
    const figure = target.querySelector(':scope > figure');

    expect(figure?.querySelector(':scope > svg')?.getAttribute('aria-label')).toBe('Temperatures');
    expect(dataTable(target).caption).toBe('Temperatures');
    expect(figure?.hasAttribute('aria-label')).toBe(false);
  });

  it.each([
    ['a generated summary', {}, 'Line chart, points: 2, series: 2'],
    ['ariaLabel', { ariaLabel: 'Temperatures' }, 'Temperatures'],
    [
      'ariaLabel over a plain aria-label',
      { ariaLabel: 'Temperatures', 'aria-label': 'Readings' },
      'Temperatures'
    ]
  ])('names the image and captions the data table with %s', (_name, props, name) => {
    const target = render({ ...TEMPERATURES, ...props });

    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
    expect(dataTable(target).caption).toBe(name);
  });

  it('tabulates every value, formatted: a column per series, a row header per category', () => {
    const target = render(TEMPERATURES);

    // Tue has no High value; its point is drawn at zero, and the table says so.
    expect(dataTable(target)).toEqual({
      hidden: true,
      caption: 'Line chart, points: 2, series: 2',
      rows: [
        ['th[col] Category', 'th[col] Low', 'th[col] High'],
        ['th[row] Mon', 'td 2°', 'td 9°'],
        ['th[row] Tue', 'td 4°', 'td 0°']
      ]
    });
  });

  it('names the image, captions the table and heads it in the active locale', () => {
    const target = render({ data: [{ label: 'Mon', values: [1, 2] }] }, registerMarkedLocale());

    const name = 'fr:Line chart, points: 1, series: 2';

    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
    expect(dataTable(target).caption).toBe(name);
    expect(dataTable(target).rows[0]).toEqual([
      'th[col] fr:Category',
      'th[col] fr:Series 1',
      'th[col] fr:Series 2'
    ]);
  });

  it('titles each point with its series, its category and the formatted value', () => {
    const target = render(TEMPERATURES);

    expect(titles(target.querySelectorAll('circle'))).toEqual([
      'Low — Mon: 2°',
      'Low — Tue: 4°',
      'High — Mon: 9°',
      'High — Tue: 0°'
    ]);
  });
});

describe('LineChart — slot contract', () => {
  /** Each slot's element, picked by tag and tree position — never by class. */
  function pick(target: Element): Record<LineChartSlot, () => Element[]> {
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');
    if (!figure || !svg) throw new Error('no <figure> > <svg>');
    const groups = [...svg.querySelectorAll(':scope > g > g')];
    const axes = groups.filter((g) => g.querySelector(':scope > text'));
    return {
      root: () => [figure],
      svg: () => [svg],
      grid: () =>
        groups.filter(
          (g) => g.children.length > 0 && [...g.children].every((c) => c.localName === 'line')
        ),
      axis: () => axes,
      axisLabel: () => axes.flatMap((g) => [...g.querySelectorAll(':scope > text')]),
      mark: () => [...svg.querySelectorAll('path')],
      point: () => [...svg.querySelectorAll('circle')],
      legend: () => [...figure.querySelectorAll(':scope > ul')],
      legendItem: () => [...figure.querySelectorAll(':scope > ul > li')],
      legendSwatch: () => [...figure.querySelectorAll(':scope > ul > li > span')]
    };
  }

  it('puts each slot key on the elements it names, and on no other', () => {
    const target = render({
      series: [{ label: 'A' }, { label: 'B' }],
      data: [
        { label: 'Jan', values: [1, 2] },
        { label: 'Feb', values: [3, 4] }
      ],
      slotClasses: probes(LINE_CHART_SLOTS)
    });

    const expected = expectedCarriers(target, LINE_CHART_SLOTS, pick(target));
    // A slot with nothing to land on in this state would compare empty to empty.
    expect(LINE_CHART_SLOTS.filter((slot) => expected[slot].length === 0)).toEqual([]);
    // Two series over two categories: `mark` on 2 paths, `point` on 4 circles.
    expect(expected.mark).toHaveLength(2);
    expect(expected.point).toHaveLength(4);
    expect(probeCarriers(target, LINE_CHART_SLOTS)).toEqual(expected);
  });
});
