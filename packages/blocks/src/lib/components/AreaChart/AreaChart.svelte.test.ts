// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ChartLocaleHost, {
  registerMarkedLocale
} from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import { dataTable, nonFinite, vertices } from '#lib/internal/charts/__fixtures__/chart-dom.js';
import AreaChart from './AreaChart.svelte';
import type { AreaChartProps } from './index';

/**
 * One series is two paths — the filled band and its top edge — and each carries
 * `mark` plus a slot of its own. Two finished tv() folds meet on one element,
 * so the call site has to fold them against each other: `stripConflicts` runs
 * *between* sources and never inside one, and a raw join leaves both tokens in
 * the attribute for the stylesheet to arbitrate.
 *
 * Measured on the joined form, in Chromium against a Tailwind build of the
 * shipped stylesheet: the slot a consumer picks made no difference — `fill-red`
 * beat `fill-blue` from either slot (palette order), `opacity-100` beat
 * `opacity-50` from either (scale order), and `{ area: 'duration-1000' }` lost
 * to `mark`'s own `duration-[var(--blocks-duration-fast)]`, which Tailwind
 * emits after it. Both halves are asserted here on the resolved attribute,
 * which is the deterministic thing: the specific slot wins its bucket, and the
 * library default it displaces is gone rather than outvoted.
 */

const DATA = {
  data: [
    { label: 'a', values: [1] },
    { label: 'b', values: [2] }
  ]
};

/** `mark`'s own transition duration — the library class a consumer must be able to beat. */
const LIBRARY_DURATION = 'duration-[var(--blocks-duration-fast)]';

function paths(slotClasses: Record<string, string>) {
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(AreaChart, { target, props: { ...DATA, slotClasses } });
  flushSync();
  const all = [...target.querySelectorAll('path')];
  // The two paths null out each other's paint, which is what tells them apart.
  const pick = (attribute: string) => {
    const found = all.find((p) => p.getAttribute(attribute) === 'none');
    if (!found)
      throw new Error(
        `no <path> with ${attribute}="none" among ${all.length}: ` +
          `${all.map((p) => `fill=${p.getAttribute('fill')} stroke=${p.getAttribute('stroke')}`).join(' | ')}`
      );
    return (found.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  };
  const band = pick('stroke');
  const outline = pick('fill');
  unmount(app);
  document.body.innerHTML = '';
  return { band, outline };
}

describe('AreaChart slot folding', () => {
  it.each([
    ['area', 'fill-blue-500', 'fill-red-500'],
    ['area', 'fill-red-500', 'fill-blue-500'],
    ['area', 'opacity-100', 'opacity-50'],
    ['area', 'opacity-50', 'opacity-100'],
    ['areaOutline', 'opacity-50', 'opacity-100']
  ])('%s beats a same-bucket `mark` entry (%s over %s)', (slot, mine, theirs) => {
    const { band, outline } = paths({ mark: theirs, [slot]: mine });
    const element = slot === 'area' ? band : outline;
    expect(element).toContain(mine);
    expect(element).not.toContain(theirs);
  });

  it.each(['area', 'areaOutline'])(
    'a `%s` entry displaces the library default it collides with',
    (slot) => {
      const { band, outline } = paths({ [slot]: 'duration-1000' });
      const element = slot === 'area' ? band : outline;
      expect(element).toContain('duration-1000');
      expect(element).not.toContain(LIBRARY_DURATION);
    }
  );

  it('leaves the neighbouring path untouched', () => {
    const { band, outline } = paths({ area: 'duration-1000' });
    expect(band).toContain('duration-1000');
    expect(outline).toContain(LIBRARY_DURATION);
    expect(outline).not.toContain('duration-1000');
  });
});

/**
 * Every mount below draws into a fixed 200 × 100 plot: `width` is set and the
 * margins are 0, so plot and frame coordinates coincide. Without `width` the
 * frame measures its container, which jsdom never lays out.
 *
 * Expected geometry is written out by hand from the nice-tick definition, not
 * recomputed through the chart's own helpers.
 */
const PLOT = {
  width: 200,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  formatValue: String
} satisfies Partial<AreaChartProps>;

/** Two series over two categories; each category totals 5. */
const TWO_SERIES = {
  data: [
    { label: 'a', values: [2, 3] },
    { label: 'b', values: [4, 1] }
  ]
} satisfies AreaChartProps;

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mounts the chart; under `locale`, inside a provider that switches to it. */
function render(props: AreaChartProps, locale?: Locale): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const merged = { ...PLOT, ...props };
  const app = locale
    ? mount(ChartLocaleHost, { target, props: { locale, chart: AreaChart, props: merged } })
    : mount(AreaChart, { target, props: merged });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

/** Per series, the filled band (its `stroke` is "none"): a closed polygon. */
function bandPaths(target: Element) {
  return [...target.querySelectorAll('path[stroke="none"]')];
}

function bands(target: Element) {
  return bandPaths(target).map((path) => vertices(path.getAttribute('d') ?? '', true));
}

/** Per series, the band's top edge (its `fill` is "none"): an open polyline. */
function outlines(target: Element) {
  return [...target.querySelectorAll('path[fill="none"]')].map((path) =>
    vertices(path.getAttribute('d') ?? '')
  );
}

describe('AreaChart — overlaid series', () => {
  it('closes the band on the zero line, which sits above the floor once a value is negative', () => {
    const target = render({
      data: [
        { label: 'a', values: [3] },
        { label: 'b', values: [-1] },
        { label: 'c', values: [1] }
      ]
    });

    // Domain [-1, 3], 25 px per unit: zero lies 75 px down.
    expect(outlines(target)).toEqual([
      [
        [0, 0],
        [100, 100],
        [200, 50]
      ]
    ]);
    expect(bands(target)).toEqual([
      [
        [0, 0],
        [100, 100],
        [200, 50],
        [200, 75],
        [0, 75]
      ]
    ]);
  });

  it('draws every series from zero, over the others rather than on top of them', () => {
    // The maximum sits in the second series: the axis has to read every series.
    const target = render({
      data: [
        { label: 'a', values: [2, 3] },
        { label: 'b', values: [1, 4] }
      ]
    });

    // Domain [0, 4], 25 px per unit.
    expect(bands(target)).toEqual([
      [
        [0, 50],
        [200, 75],
        [200, 100],
        [0, 100]
      ],
      [
        [0, 25],
        [200, 0],
        [200, 100],
        [0, 100]
      ]
    ]);
  });
});

describe('AreaChart — stacked series', () => {
  it('lays each band on the running total of the series before it', () => {
    const target = render({ ...TWO_SERIES, stacked: true });

    // Both totals are 5: domain [0, 5], 20 px per unit. Each band runs along
    // its top edge, then back along the one beneath it.
    expect(bands(target)).toEqual([
      [
        [0, 60],
        [200, 20],
        [200, 100],
        [0, 100]
      ],
      [
        [0, 0],
        [200, 0],
        [200, 20],
        [0, 60]
      ]
    ]);
    expect(outlines(target)).toEqual([
      [
        [0, 60],
        [200, 20]
      ],
      [
        [0, 0],
        [200, 0]
      ]
    ]);
  });

  /** Positive band: 5 up from zero. Negative band: 3 down from zero. */
  const UP = [
    [0, 10],
    [200, 10],
    [200, 60],
    [0, 60]
  ];
  const DOWN = [
    [0, 90],
    [200, 90],
    [200, 60],
    [0, 60]
  ];

  it.each([
    ['a negative series on a positive one', [5, -3], [UP, DOWN]],
    ['a positive series on a negative one', [-3, 5], [DOWN, UP]]
  ])('stacks %s away from zero on either side, inside the plot', (_name, values, expected) => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values },
        { label: 'b', values }
      ]
    });

    // Domain [-3, 5] widens to [-4, 6], 10 px per unit: zero lies 60 px down.
    // Each band runs along its outer edge, then back along zero.
    expect(
      bands(target)
        .flat()
        .filter(([, y]) => y < 0 || y > 100)
    ).toEqual([]);
    expect(bands(target)).toEqual(expected);
  });

  it('stacks each category on its own, so a series that changes sign changes side', () => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values: [3, 2] },
        { label: 'b', values: [-2, 1] }
      ]
    });

    // Domain [-2, 5] widens to [-2, 6], 12.5 px per unit: zero lies 75 px down.
    // At `b` the first series is negative, so the second starts at zero again.
    expect(bands(target)).toEqual([
      [
        [0, 37.5],
        [200, 100],
        [200, 75],
        [0, 75]
      ],
      [
        [0, 12.5],
        [200, 62.5],
        [200, 75],
        [0, 37.5]
      ]
    ]);
    expect(outlines(target)).toEqual([
      [
        [0, 37.5],
        [200, 100]
      ],
      [
        [0, 12.5],
        [200, 62.5]
      ]
    ]);
  });

  // The second series has no value at `b`, which counts as zero.
  it.each([
    [
      'a negative stack',
      [-2, -1],
      // Domain [-3, 0], 33.33 px per unit: -2 lies 66.67 px down, -3 on the floor.
      [
        [
          [0, 66.67],
          [100, 66.67],
          [200, 66.67],
          [200, 0],
          [100, 0],
          [0, 0]
        ],
        [
          [0, 100],
          [100, 66.67],
          [200, 100],
          [200, 66.67],
          [100, 66.67],
          [0, 66.67]
        ]
      ]
    ],
    [
      'a positive stack',
      [2, 1],
      // Domain [0, 3], 33.33 px per unit: 2 lies 33.33 px down, 3 at the top.
      [
        [
          [0, 33.33],
          [100, 33.33],
          [200, 33.33],
          [200, 100],
          [100, 100],
          [0, 100]
        ],
        [
          [0, 0],
          [100, 33.33],
          [200, 0],
          [200, 33.33],
          [100, 33.33],
          [0, 33.33]
        ]
      ]
    ]
  ])('notches a gap in %s down to the series beneath it', (_name, values, expected) => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values },
        { label: 'b', values: values.slice(0, 1) },
        { label: 'c', values }
      ]
    });

    expect(bands(target)).toEqual(expected);
  });

  it('notches a negative series that reaches zero to the zero line, below the positive bands', () => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values: [3, -1, 2] },
        { label: 'b', values: [3, 0, 2] },
        { label: 'c', values: [3, -1, 2] }
      ]
    });

    // Domain [-1, 5] widens to [-2, 6], 12.5 px per unit: zero lies 75 px down.
    expect(outlines(target)[1]).toEqual([
      [0, 87.5],
      [100, 75],
      [200, 87.5]
    ]);
  });

  it('keeps a zero inside a series’ negative run on the negative side, though the series has a positive value', () => {
    const target = render({
      stacked: true,
      data: [
        { label: 'a', values: [3, 2] },
        { label: 'b', values: [3, -1] },
        { label: 'c', values: [3, 0] },
        { label: 'd', values: [3, -1] }
      ]
    });

    // Domain [-1, 5] widens to [-2, 6], 12.5 px per unit: zero lies 75 px down.
    // At `c` the second series sits on the zero line, not on top of the first.
    expect(outlines(target)[1]).toEqual([
      [0, 12.5],
      [66.67, 87.5],
      [133.33, 75],
      [200, 87.5]
    ]);
  });
});

describe('AreaChart — fill opacity', () => {
  it.each([
    ['an overlay at 0.2 by default', { stacked: false }, '0.2'],
    ['a stack at 0.85 by default', { stacked: true }, '0.85'],
    ['an overlay at an explicit fillOpacity', { stacked: false, fillOpacity: 0.5 }, '0.5'],
    ['a stack at an explicit fillOpacity', { stacked: true, fillOpacity: 0.5 }, '0.5']
  ])('fills %s', (_name, props, opacity) => {
    const target = render({ ...TWO_SERIES, ...props });

    expect(bandPaths(target).map((path) => path.getAttribute('fill-opacity'))).toEqual([
      opacity,
      opacity
    ]);
  });
});

describe('AreaChart — degenerate data', () => {
  it('draws empty paths for empty data, with no non-finite coordinate', () => {
    const target = render({ data: [] });

    expect(bands(target)).toEqual([[]]);
    expect(outlines(target)).toEqual([[]]);
    expect(nonFinite(target)).toEqual([]);
  });

  it('centres a single point horizontally, its band a zero-width drop to zero', () => {
    const target = render({ data: [{ label: 'Only', values: [5] }] });
    const [band] = bands(target);
    const ys = band.map(([, y]) => y);

    // Domain [0, 5]: the value at the top, zero on the floor beneath it.
    expect(outlines(target)).toEqual([[[100, 0]]]);
    expect(new Set(band.map(([x]) => x))).toEqual(new Set([100]));
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 100]);
    expect(nonFinite(target)).toEqual([]);
  });

  it('lays an all-zero series flat inside the plot, without dividing by a zero range', () => {
    const target = render({
      data: [
        { label: 'a', values: [0] },
        { label: 'b', values: [0] }
      ]
    });
    const [outline] = outlines(target);
    const [band] = bands(target);
    // The line and the band's closing edge both lie on the zero line.
    const ys = new Set([...outline, ...band].map(([, y]) => y));

    expect(outline.map(([x]) => x)).toEqual([0, 200]);
    expect(ys.size).toBe(1);
    const [zeroY] = ys;
    expect(zeroY).toBeGreaterThanOrEqual(0);
    expect(zeroY).toBeLessThanOrEqual(100);
    expect(nonFinite(target)).toEqual([]);
  });
});

describe('AreaChart — what a screen reader gets', () => {
  const VISITORS = {
    series: [{ label: 'New' }, { label: 'Returning' }],
    data: [
      { label: 'Jan', values: [4, 6] },
      { label: 'Feb', values: [7] }
    ],
    formatValue: (value: number) => `${value}k`
  } satisfies AreaChartProps;

  it('lets a plain aria-label name the image and caption the table, not the figure', () => {
    const target = render({ ...VISITORS, 'aria-label': 'Visitors' });
    const figure = target.querySelector(':scope > figure');

    expect(figure?.querySelector(':scope > svg')?.getAttribute('aria-label')).toBe('Visitors');
    expect(dataTable(target).caption).toBe('Visitors');
    expect(figure?.hasAttribute('aria-label')).toBe(false);
  });

  it.each([
    ['a generated summary', {}, 'Area chart, points: 2, series: 2'],
    [
      'a generated summary that says it stacks',
      { stacked: true },
      'Stacked area chart, points: 2, series: 2'
    ],
    ['ariaLabel', { ariaLabel: 'Visitors' }, 'Visitors'],
    [
      'ariaLabel over a plain aria-label',
      { ariaLabel: 'Visitors', 'aria-label': 'Traffic' },
      'Visitors'
    ]
  ])('names the image and captions the data table with %s', (_name, props, name) => {
    const target = render({ ...VISITORS, ...props });

    expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
    expect(dataTable(target).caption).toBe(name);
  });

  it('tabulates every value, formatted: a column per series, a row header per category', () => {
    const target = render(VISITORS);

    // Feb has no Returning value; its area is drawn at zero, and the table says so.
    expect(dataTable(target)).toEqual({
      hidden: true,
      caption: 'Area chart, points: 2, series: 2',
      rows: [
        ['th[col] Category', 'th[col] New', 'th[col] Returning'],
        ['th[row] Jan', 'td 4k', 'td 6k'],
        ['th[row] Feb', 'td 7k', 'td 0k']
      ]
    });
  });

  it.each([
    ['overlaid', false, 'fr:Area chart, points: 1, series: 2'],
    ['stacked', true, 'fr:Stacked area chart, points: 1, series: 2']
  ])(
    'names the %s image, captions the table and heads it in the active locale',
    (_mode, stacked, name) => {
      const target = render(
        { stacked, data: [{ label: 'Jan', values: [1, 2] }] },
        registerMarkedLocale()
      );

      expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe(name);
      expect(dataTable(target).caption).toBe(name);
      expect(dataTable(target).rows[0]).toEqual([
        'th[col] fr:Category',
        'th[col] fr:Series 1',
        'th[col] fr:Series 2'
      ]);
    }
  );
});
