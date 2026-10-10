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
  probeCarriers,
  probes,
  titles
} from '#lib/internal/charts/__fixtures__/chart-dom.js';
import { DONUT_CHART_SLOTS, type DonutChartSlot } from '#lib/internal/charts/slots.js';
import DonutChart from './DonutChart.svelte';
import type { DonutChartProps } from './index';

/**
 * The donut sizes itself from `size` alone and measures nothing, so jsdom
 * derives the same arcs a browser does. Each arc is read back from its `d` as
 * angles — degrees clockwise from 12 o'clock — and radii, so an assertion says
 * which part of the turn a slice covers rather than which string drew it.
 */
const SIZE = 200;
const CENTRE = SIZE / 2;

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mounts the chart; under `locale`, inside a provider that switches to it. */
function render(props: DonutChartProps, locale?: Locale): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  // `formatValue` does not reach the share column's percent formatter;
  // `locale` does, and `nonFinite` reads its NaN in English.
  const merged = { size: SIZE, formatValue: String, locale: 'en-US', ...props };
  const app = locale
    ? mount(ChartLocaleHost, { target, props: { locale, chart: DonutChart, props: merged } })
    : mount(DonutChart, { target, props: merged });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

/** Degrees clockwise from 12 o'clock of a point on the ring, in [0, 360). */
function angleOf(x: number, y: number): number {
  const degrees = (Math.atan2(x - CENTRE, CENTRE - y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

const N = String.raw`(-?[\d.]+)`;
/** One ring segment: outer arc forward, a line in, inner arc back. */
const RING = new RegExp(
  `^M${N},${N}A${N},${N} 0 ([01]) 1 ${N},${N}L${N},${N}A${N},${N} 0 [01] 0 ${N},${N}Z$`
);

interface Ring {
  outer: number;
  inner: number;
  from: number;
  to: number;
  largeArc: boolean;
}

/** The ring segments a `d` draws; a full ring is drawn as two halves. */
function rings(d: string): Ring[] {
  return d
    .split('Z')
    .filter(Boolean)
    .map((part) => {
      const m = RING.exec(`${part}Z`);
      if (!m) throw new Error(`not a ring segment: ${part}Z`);
      const [ox0, oy0, outer, , large, ox1, oy1, ix1, iy1, inner, , ix0, iy0] = m
        .slice(1)
        .map(Number);
      const from = angleOf(ox0, oy0);
      // The end of a slice that closes the turn reads back as 0°.
      const to = angleOf(ox1, oy1) || 360;
      // The inner arc must retrace the same angles, or the segment is skewed.
      expect([angleOf(ix0, iy0), angleOf(ix1, iy1) || 360]).toEqual([
        expect.closeTo(from, 1),
        expect.closeTo(to, 1)
      ]);
      return { outer, inner, from, to, largeArc: large === 1 };
    });
}

function arcs(target: Element): string[] {
  return [...target.querySelectorAll('svg path')].map((p) => p.getAttribute('d') ?? '');
}

/** Rings rounded to 1 decimal: the path's coordinates carry 2. */
function roundRings(list: Ring[]) {
  const r = (n: number) => Math.round(n * 10) / 10;
  return list.map((ring) => ({
    ...ring,
    outer: r(ring.outer),
    inner: r(ring.inner),
    from: r(ring.from),
    to: r(ring.to)
  }));
}

function centreTexts(target: Element): (string | undefined)[] {
  return [...target.querySelectorAll('svg text')].map((t) => t.textContent?.trim());
}

describe('DonutChart — slices', () => {
  it("gives each slice its share of the turn, clockwise from 12 o'clock and edge to edge", () => {
    const target = render({
      data: [
        { label: 'A', value: 1 },
        { label: 'B', value: 3 }
      ]
    });

    // A quarter, then the remaining three quarters — which only render as
    // three quarters if the large-arc flag is set.
    expect(roundRings(arcs(target).flatMap(rings))).toEqual([
      { outer: 100, inner: 60, from: 0, to: 90, largeArc: false },
      { outer: 100, inner: 60, from: 90, to: 360, largeArc: true }
    ]);
  });

  it.each([
    ['two slices', [1, 1]],
    ['a zero slice between them, which adds no gap of its own', [1, 0, 1]]
  ])('leaves a padAngle gap between neighbouring slices: %s', (_name, values) => {
    const target = render({
      padAngle: 10,
      data: values.map((value, i) => ({ label: `S${i}`, value }))
    });

    expect(roundRings(arcs(target).flatMap(rings)).map(({ from, to }) => [from, to])).toEqual([
      [5, 175],
      [185, 355]
    ]);
  });

  it('caps the hole at 0.95 of the radius', () => {
    const target = render({ innerRadiusRatio: 2, data: [{ label: 'A', value: 1 }] });

    expect(new Set(roundRings(rings(arcs(target)[0])).map((ring) => ring.inner))).toEqual(
      new Set([95])
    );
  });

  it('draws a pie slice from the centre at innerRadiusRatio 0, and no centre total', () => {
    const target = render({
      innerRadiusRatio: 0,
      showTotal: true,
      data: [
        { label: 'A', value: 1 },
        { label: 'B', value: 3 }
      ]
    });

    const paths = arcs(target);
    expect(paths).toHaveLength(2);
    for (const d of paths) expect(d.startsWith(`M${CENTRE},${CENTRE}L`)).toBe(true);
    expect(centreTexts(target)).toEqual([]);
  });
});

describe('DonutChart — centre total', () => {
  it('sums the positive values and sets the caption under it', () => {
    const target = render({
      showTotal: true,
      totalLabel: 'Total',
      data: [
        { label: 'Refund', value: -5 },
        { label: 'A', value: 10 },
        { label: 'B', value: 5 }
      ]
    });

    expect(centreTexts(target)).toEqual(['15', 'Total']);
  });
});

describe('DonutChart — degenerate data', () => {
  it('draws a lone slice as a full ring rather than collapsing it to a point', () => {
    const target = render({ data: [{ label: 'All', value: 5 }] });

    const paths = arcs(target);
    expect(paths).toHaveLength(1);
    expect(roundRings(rings(paths[0])).map(({ from, to }) => [from, to])).toEqual([
      [0, 180],
      [180, 360]
    ]);
  });

  it.each([
    ['zero', 0],
    ['negative', -3]
  ])(
    'closes the ring around a lone slice under padAngle when its neighbour is %s',
    (_name, other) => {
      /** Every ring segment a mount draws, read back and unmounted again. */
      function drawn(props: DonutChartProps) {
        const target = render(props);
        const read = roundRings(arcs(target).flatMap(rings));
        dispose?.();
        dispose = undefined;
        target.remove();
        return read;
      }

      const lone = drawn({ padAngle: 10, data: [{ label: 'A', value: 5 }] });
      expect(lone.map(({ from, to }) => [from, to])).toEqual([
        [0, 180],
        [180, 360]
      ]);
      // A gap is between two slices; a neighbour with no share is not one.
      expect(
        drawn({
          padAngle: 10,
          data: [
            { label: 'A', value: 5 },
            { label: 'B', value: other }
          ]
        })
      ).toEqual(lone);
    }
  );

  it('leaves the gap of a slice thinner than padAngle instead of closing the ring over it', () => {
    // B's 3.6° share is narrower than the 10° pad, so B draws nothing; it still has a share,
    // so A stops short of the turn rather than claiming B's part of it.
    const target = render({
      padAngle: 10,
      data: [
        { label: 'A', value: 100 },
        { label: 'B', value: 1 }
      ]
    });

    const paths = arcs(target);
    expect(paths).toHaveLength(1);
    expect(roundRings(rings(paths[0])).map(({ from, to }) => [from, to])).toEqual([[5, 351.4]]);
  });

  it('drops a negative slice from the ring and the rest closes the turn', () => {
    const target = render({
      showTotal: true,
      data: [
        { label: 'Refund', value: -5 },
        { label: 'Sale', value: 10 }
      ]
    });

    const paths = arcs(target);
    expect(paths).toHaveLength(1);
    expect(roundRings(rings(paths[0])).map(({ from, to }) => [from, to])).toEqual([
      [0, 180],
      [180, 360]
    ]);
    expect(centreTexts(target)).toEqual(['10']);
  });

  it('draws no arcs and a zero total for empty data, with no non-finite value', () => {
    const target = render({ showTotal: true, data: [] });

    expect(arcs(target)).toEqual([]);
    expect(centreTexts(target)).toEqual(['0']);
    expect(nonFinite(target)).toEqual([]);
    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Donut chart, segments: 0, total: 0'
    );
  });

  it('draws no arcs for an all-zero total, without dividing by it', () => {
    const target = render({
      showTotal: true,
      data: [
        { label: 'A', value: 0 },
        { label: 'B', value: 0 }
      ]
    });

    expect(arcs(target)).toEqual([]);
    expect(nonFinite(target)).toEqual([]);
  });
});

describe('DonutChart — what a screen reader gets', () => {
  const CHANNELS = {
    data: [
      { label: 'Direct', value: 1 },
      { label: 'Referral', value: 3 },
      { label: 'Refund', value: -2 }
    ],
    formatValue: (value: number) => `${value} €`
  } satisfies DonutChartProps;

  it('lets a plain aria-label name the image and caption the table, not the figure', () => {
    const target = render({ ...CHANNELS, 'aria-label': 'Traffic by channel' });
    const figure = target.querySelector(':scope > figure');

    expect(figure?.querySelector(':scope > svg')?.getAttribute('aria-label')).toBe(
      'Traffic by channel'
    );
    expect(dataTable(target).caption).toBe('Traffic by channel');
    expect(figure?.hasAttribute('aria-label')).toBe(false);
  });

  it('lets aria-labelledby point the image at a visible caption, not the figure', () => {
    const target = render({ ...CHANNELS, 'aria-labelledby': 'traffic-caption' });
    const figure = target.querySelector(':scope > figure');

    expect(figure?.querySelector(':scope > svg')?.getAttribute('aria-labelledby')).toBe(
      'traffic-caption'
    );
    expect(figure?.hasAttribute('aria-labelledby')).toBe(false);
  });

  it.each([
    ['a generated summary', undefined, 'Donut chart, segments: 3, total: 4 €'],
    ['ariaLabel', 'Traffic by channel', 'Traffic by channel']
  ])(
    'presents the svg as one image named by %s, which also captions the table',
    (_name, ariaLabel, name) => {
      const target = render({ ...CHANNELS, ariaLabel });
      const svg = target.querySelector(':scope > figure > svg');

      expect(svg?.getAttribute('role')).toBe('img');
      expect(svg?.getAttribute('aria-label')).toBe(name);
      expect(dataTable(target).caption).toBe(name);
    }
  );

  it('tabulates each slice’s formatted value and share in a visually hidden table', () => {
    const target = render(CHANNELS);

    // The ring counts a negative slice as none, and so does the table.
    expect(dataTable(target)).toEqual({
      hidden: true,
      caption: 'Donut chart, segments: 3, total: 4 €',
      rows: [
        ['th[col] Segment', 'th[col] Value', 'th[col] Share'],
        ['th[row] Direct', 'td 1 €', 'td 25%'],
        ['th[row] Referral', 'td 3 €', 'td 75%'],
        ['th[row] Refund', 'td 0 €', 'td 0%']
      ]
    });
  });

  it('formats the share column in the locale it is given', () => {
    // Intl's de-DE percent sets the sign apart with a no-break space, spelled
    // by code point so the expected string shows which space it is.
    const nbsp = String.fromCharCode(0xa0);
    const target = render({ ...CHANNELS, formatValue: undefined, locale: 'de-DE' });
    const shares = dataTable(target).rows.map((row) => row[2]);

    expect(shares.slice(1)).toEqual([`td 25${nbsp}%`, `td 75${nbsp}%`, `td 0${nbsp}%`]);
  });

  it('names the image, captions the table and heads it in the active locale', () => {
    const target = render(CHANNELS, registerMarkedLocale());
    const name = 'fr:Donut chart, segments: 3, total: 4 €';

    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
    expect(dataTable(target).caption).toBe(name);
    expect(dataTable(target).rows[0]).toEqual([
      'th[col] fr:Segment',
      'th[col] fr:Value',
      'th[col] fr:Share'
    ]);
  });

  it('titles each drawn slice with its label, formatted value and share', () => {
    const target = render(CHANNELS);

    expect(titles(target.querySelectorAll('svg path'))).toEqual([
      'Direct: 1 € (25%)',
      'Referral: 3 € (75%)'
    ]);
  });
});

describe('DonutChart — slot contract', () => {
  /** Each slot's element, picked by tag, tree position and text — never by class. */
  function pick(target: Element): Record<DonutChartSlot, () => Element[]> {
    const figure = target.querySelector(':scope > figure');
    const svg = figure?.querySelector(':scope > svg');
    if (!figure || !svg) throw new Error('no <figure> > <svg>');
    const text = (content: string) =>
      [...svg.querySelectorAll(':scope > text')].filter((t) => t.textContent?.trim() === content);
    return {
      root: () => [figure],
      svg: () => [svg],
      arc: () => [...svg.querySelectorAll(':scope > path')],
      centerLabel: () => text('6'),
      centerSubLabel: () => text('Total'),
      legend: () => [...figure.querySelectorAll(':scope > ul')],
      legendItem: () => [...figure.querySelectorAll(':scope > ul > li')],
      legendSwatch: () => [...figure.querySelectorAll(':scope > ul > li > span')]
    };
  }

  it('puts each slot key on the elements it names, and on no other', () => {
    const target = render({
      showTotal: true,
      totalLabel: 'Total',
      data: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
        { label: 'C', value: 3 }
      ],
      slotClasses: probes(DONUT_CHART_SLOTS)
    });

    const expected = expectedCarriers(target, DONUT_CHART_SLOTS, pick(target));
    // A slot with nothing to land on in this state would compare empty to empty.
    expect(DONUT_CHART_SLOTS.filter((slot) => expected[slot].length === 0)).toEqual([]);
    expect(probeCarriers(target, DONUT_CHART_SLOTS)).toEqual(expected);
  });
});
