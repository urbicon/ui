// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { registerBlocksLocale } from '#lib/i18n/index.js';
import ChartLocaleHost from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import {
  dataTable,
  expectedCarriers,
  nonFinite,
  num,
  probeCarriers,
  probes,
  titles
} from '#lib/internal/charts/__fixtures__/chart-dom.js';
import { BAR_CHART_SLOTS, type BarChartSlot } from '#lib/internal/charts/slots.js';
import deTranslations from '#lib/translations/de.js';
import BarChart from './BarChart.svelte';
import type { BarChartProps } from './index';

/**
 * Every mount draws into a fixed 200 × 100 plot: `width` is set and the
 * margins are 0, so plot and frame coordinates coincide. Without `width` the
 * frame measures its container, which jsdom never lays out — every coordinate
 * would derive from the 320 px pre-measure fallback instead. With it the frame
 * measures nothing, and a browser derives the same numbers.
 *
 * Expected geometry is written out by hand from the scale definitions (nice
 * ticks, band padding 0.25 between categories and 0.1 between grouped series),
 * not recomputed through the chart's own helpers.
 */
const PLOT = {
  width: 200,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  formatValue: String
} satisfies Partial<BarChartProps>;

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mounts the chart; under `locale`, inside a provider that switches to it. */
function render(props: BarChartProps, locale?: Locale): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const merged = { ...PLOT, ...props };
  const app = locale
    ? mount(ChartLocaleHost, { target, props: { locale, chart: BarChart, props: merged } })
    : mount(BarChart, { target, props: merged });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

/** `[x, y, width, height]` per bar, in document order. */
function bars(target: Element) {
  return [...target.querySelectorAll('rect')].map((rect) =>
    ['x', 'y', 'width', 'height'].map((name) => num(rect, name))
  );
}

/** The value axis: tick label text and its y, bottom tick first. */
function valueTicks(target: Element) {
  return [...target.querySelectorAll('text[text-anchor="end"]')].map((text) => [
    text.textContent?.trim(),
    num(text, 'y')
  ]);
}

/** The category axis: label text and its x. */
function categoryLabels(target: Element) {
  return [...target.querySelectorAll('text[text-anchor="middle"]')].map((text) => [
    text.textContent?.trim(),
    num(text, 'x')
  ]);
}

/** The baseline drawn beside the value ticks. */
function zeroLine(target: Element) {
  const line = target
    .querySelector('text[text-anchor="end"]')
    ?.parentElement?.querySelector(':scope > line');
  if (!line) throw new Error('no line beside the value-axis labels');
  return [num(line, 'y1'), num(line, 'y2')];
}

describe('BarChart — value axis', () => {
  it('rounds the data range out to nice ticks that reach zero, mapped onto the plot height', () => {
    const target = render({
      data: [
        { label: 'a', values: [10] },
        { label: 'b', values: [20] },
        { label: 'c', values: [5] },
        { label: 'd', values: [15] }
      ]
    });

    // [5, 20] widens to [0, 20]; spacing 5 → 5 px per unit on a 100 px plot.
    expect(valueTicks(target)).toEqual([
      ['0', 100],
      ['5', 75],
      ['10', 50],
      ['15', 25],
      ['20', 0]
    ]);
    const gridY = [...target.querySelectorAll('svg g > g > line')]
      .filter((line) => line.parentElement?.querySelector(':scope > text') === null)
      .map((line) => num(line, 'y1'));
    expect(gridY).toEqual([100, 75, 50, 25, 0]);
  });

  it('extends below zero for negative values and draws the baseline at zero', () => {
    const target = render({
      height: 90,
      data: [
        { label: 'gain', values: [20] },
        { label: 'loss', values: [-10] }
      ]
    });

    // [-10, 20], spacing 10 → 3 px per unit; zero sits 60 px down.
    expect(valueTicks(target)).toEqual([
      ['-10', 90],
      ['0', 60],
      ['10', 30],
      ['20', 0]
    ]);
    expect(zeroLine(target)).toEqual([60, 60]);
  });
});

describe('BarChart — bars', () => {
  it('stands each bar on the zero baseline: upward for a positive value, downward for a negative one', () => {
    const target = render({
      height: 90,
      data: [
        { label: 'gain', values: [20] },
        { label: 'loss', values: [-10] }
      ]
    });

    // Two 100 px steps, each band 75 px; the bar 67.5 px, centred in it.
    expect(bars(target)).toEqual([
      [16.25, 0, 67.5, 60],
      [116.25, 60, 67.5, 30]
    ]);
  });

  it('sets grouped series side by side inside their category band', () => {
    const target = render({ data: [{ label: 'Q1', values: [10, 20] }] });

    // The band is [25, 175]; its two series split it with 0.1 padding.
    expect(bars(target)).toEqual([
      [28.75, 50, 67.5, 50],
      [103.75, 0, 67.5, 100]
    ]);
    expect(categoryLabels(target)).toEqual([['Q1', 100]]);
  });

  it('stacks positive values upward and negative values downward from the same baseline', () => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values: [3, 5] },
        { label: 'b', values: [-2, 4] }
      ]
    });

    // Domain [-2, 8]: the largest positive stack and the largest negative one.
    expect(valueTicks(target).map(([label]) => label)).toEqual(['-2', '0', '2', '4', '6', '8']);
    expect(zeroLine(target)).toEqual([80, 80]);
    // In `b` the negative segment comes first, and the positive one still
    // starts at zero rather than on top of it.
    expect(bars(target)).toEqual([
      [12.5, 50, 75, 30],
      [12.5, 0, 75, 50],
      [112.5, 80, 75, 20],
      [112.5, 40, 75, 40]
    ]);
  });
});

describe('BarChart — degenerate data', () => {
  it('draws an axis and no bars for empty data, with no non-finite coordinate', () => {
    const target = render({ data: [] });

    expect(bars(target)).toEqual([]);
    expect(categoryLabels(target)).toEqual([]);
    expect(valueTicks(target).map(([label]) => label)).toEqual([
      '0',
      '0.2',
      '0.4',
      '0.6',
      '0.8',
      '1'
    ]);
    expect(nonFinite(target)).toEqual([]);
    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe('Bar chart: 0 categories');
  });

  it('centres a single category in the plot', () => {
    const target = render({ data: [{ label: 'Only', values: [5] }] });

    expect(bars(target)).toEqual([[32.5, 0, 135, 100]]);
    expect(categoryLabels(target)).toEqual([['Only', 100]]);
  });

  it('opens a unit window for all-zero data and draws flat bars on the baseline', () => {
    const target = render({
      data: [
        { label: 'a', values: [0] },
        { label: 'b', values: [0] }
      ]
    });

    expect(valueTicks(target).map(([label]) => label)).toEqual([
      '0',
      '0.2',
      '0.4',
      '0.6',
      '0.8',
      '1'
    ]);
    expect(bars(target)).toEqual([
      [16.25, 100, 67.5, 0],
      [116.25, 100, 67.5, 0]
    ]);
    expect(nonFinite(target)).toEqual([]);
  });
});

describe('BarChart — what a screen reader gets', () => {
  const QUARTERS = {
    series: [{ label: 'Revenue' }, { label: 'Cost' }],
    data: [
      { label: 'Q1', values: [12, 8] },
      { label: 'Q2', values: [19] }
    ],
    formatValue: (value: number) => `${value}k`
  } satisfies BarChartProps;

  it.each([
    ['a generated summary', undefined, 'Bar chart: 2 categories, 2 series'],
    ['ariaLabel', 'Quarterly result', 'Quarterly result']
  ])('names the image and captions the data table with %s', (_name, ariaLabel, name) => {
    const target = render({ ...QUARTERS, ariaLabel });

    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
    expect(dataTable(target).caption).toBe(name);
  });

  it('tabulates every value, formatted: a column per series, a row header per category', () => {
    const target = render(QUARTERS);

    // Q2 has no Cost value; its bar is drawn as zero, and the table says so.
    expect(dataTable(target)).toEqual({
      hidden: true,
      caption: 'Bar chart: 2 categories, 2 series',
      rows: [
        ['th[col] Category', 'th[col] Revenue', 'th[col] Cost'],
        ['th[row] Q1', 'td 12k', 'td 8k'],
        ['th[row] Q2', 'td 19k', 'td 0k']
      ]
    });
  });

  it('heads the table in the active locale, unnamed series included', () => {
    registerBlocksLocale('de', deTranslations);
    const target = render({ data: [{ label: 'Q1', values: [1, 2] }] }, 'de');

    expect(dataTable(target).rows[0]).toEqual([
      'th[col] Kategorie',
      'th[col] Datenreihe 1',
      'th[col] Datenreihe 2'
    ]);
  });

  it('titles each bar with its series, its category and the formatted value', () => {
    const target = render(QUARTERS);

    expect(titles(target.querySelectorAll('rect'))).toEqual([
      'Revenue — Q1: 12k',
      'Cost — Q1: 8k',
      'Revenue — Q2: 19k',
      'Cost — Q2: 0k'
    ]);
  });
});

describe('BarChart — slot contract', () => {
  /** Each slot's element, picked by tag and tree position — never by class. */
  function pick(target: Element): Record<BarChartSlot, () => Element[]> {
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');
    if (!figure || !svg) throw new Error('no <figure> > <svg>');
    const groups = [...svg.querySelectorAll(':scope > g > g')];
    const axes = groups.filter((g) => g.querySelector(':scope > text'));
    const children = (els: Element[], tag: string) =>
      els.flatMap((el) => [...el.querySelectorAll(`:scope > ${tag}`)]);
    return {
      root: () => [figure],
      svg: () => [svg],
      grid: () =>
        groups.filter(
          (g) => g.children.length > 0 && [...g.children].every((c) => c.localName === 'line')
        ),
      axis: () => axes,
      axisLabel: () => children(axes, 'text'),
      axisLine: () => children(axes, 'line'),
      bar: () => [...svg.querySelectorAll('rect')],
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
      slotClasses: probes(BAR_CHART_SLOTS)
    });

    const expected = expectedCarriers(target, BAR_CHART_SLOTS, pick(target));
    // A slot with nothing to land on in this state would compare empty to empty.
    expect(BAR_CHART_SLOTS.filter((slot) => expected[slot].length === 0)).toEqual([]);
    expect(probeCarriers(target, BAR_CHART_SLOTS)).toEqual(expected);
  });
});
