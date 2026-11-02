// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { type ComponentProps, createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartLocaleHost from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import CompositionBar from './CompositionBar.svelte';
import type { CompositionItem } from './index';

// Accessibility contract of the bar root: a named group, not role="img" — img
// flattens the subtree in the accessibility tree and would hide the interactive
// segment <button>s from screen readers. Plus the default percent format, which
// the segment names carry, and what tells items apart: their ids, which may
// repeat or be missing. Repo stack: svelte's own mount/unmount, native
// matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function renderBar(props: ComponentProps<typeof CompositionBar>, locale?: Locale) {
  const instance =
    locale !== undefined
      ? mount(ChartLocaleHost, {
          target: document.body,
          props: { locale, chart: CompositionBar, props: { ...props } }
        })
      : mount(CompositionBar, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const shares = [
  { label: 'Gas', value: 60 },
  { label: 'Power', value: 40 }
];

function segmentLabels() {
  return Array.from(document.querySelectorAll('button[data-composition-segment]'), (b) =>
    b.getAttribute('aria-label')
  );
}

describe('CompositionBar (accessibility contract)', () => {
  it('exposes the bar as a named group with its interactive segments', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60 },
        { label: 'Power', value: 40 }
      ]
    });

    const bar = document.querySelector('[role="group"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-label')).toBeTruthy();
    // The segments stay perceivable as individual buttons inside the group.
    expect(bar?.querySelectorAll('button[data-composition-segment]').length).toBe(2);
  });
});

describe('CompositionBar (label in name)', () => {
  // WCAG 2.5.3, compared the way axe's label-content-name-mismatch does: a
  // parenthetical is dropped, then the words of the visible text have to run
  // on, in order, inside the words of the name.
  const words = (text: string) =>
    text
      .replace(/\([^()]*\)/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .join(' ');

  it.each<[string, Locale | undefined, string]>([
    ['the base locale', undefined, 'Gas 60 · 60.0%'],
    ['German', 'de', 'Gas 60 · 60,0\u00a0%']
  ])('names each legend row with the text it shows, in %s', (_, locale, shown) => {
    renderBar({ items: shares }, locale);
    const rows = Array.from(document.querySelectorAll<HTMLElement>('ul > li > button'));
    expect(rows).toHaveLength(2);
    // Collapses source whitespace only; the locale's no-break space stays.
    expect(rows[0].textContent?.replace(/[\t\n ]+/g, ' ').trim()).toBe(shown);
    for (const row of rows) {
      expect(` ${words(row.getAttribute('aria-label') ?? '')} `).toContain(
        ` ${words(row.textContent ?? '')} `
      );
    }
    // One name per item, whichever of its two controls a speech user addresses.
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(segmentLabels());
  });

  // A tooltip is free to show more than the name. Its text must not count as
  // the segment's visible label, which the value shown inside it is.
  it('keeps the tooltip out of the text each segment shows', () => {
    const tooltip = createRawSnippet((item: () => CompositionItem) => ({
      render: () => `<span>${item().label} · statutory levy</span>`
    }));
    renderBar({ items: shares, showValues: true, tooltip });

    const tips = Array.from(document.querySelectorAll('[aria-hidden="true"]')).filter((el) =>
      el.textContent?.includes('statutory levy')
    );
    expect(tips.map((el) => el.textContent?.trim())).toEqual([
      'Gas · statutory levy',
      'Power · statutory levy'
    ]);
    const segments = Array.from(
      document.querySelectorAll<HTMLElement>('button[data-composition-segment]')
    );
    expect(segments.map((s) => s.textContent?.trim())).toEqual(['60', '40']);
    for (const segment of segments) {
      expect(` ${words(segment.getAttribute('aria-label') ?? '')} `).toContain(
        ` ${words(segment.textContent ?? '')} `
      );
    }
  });
});

describe('CompositionBar (item identity)', () => {
  const segments = () =>
    Array.from(document.querySelectorAll<HTMLElement>('button[data-composition-segment]'));
  const legendRows = () => Array.from(document.querySelectorAll<HTMLElement>('ul > li'));
  const tableRows = () =>
    Array.from(document.querySelectorAll('tbody tr'), (row) =>
      Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())
    );

  it('renders an item whose id is the position of an item without one', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60 },
        { label: 'Power', value: 40, id: 0 }
      ],
      formatValue: (v) => String(v)
    });
    expect(segmentLabels()).toEqual(['Gas: 60, 60.0%', 'Power: 40, 40.0%']);
    expect(legendRows()).toHaveLength(2);
    expect(tableRows()).toEqual([
      ['Gas', '60', '60.0%'],
      ['Power', '40', '40.0%']
    ]);
  });

  it('renders two items that share an id', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60, id: 'energy' },
        { label: 'Power', value: 40, id: 'energy' }
      ]
    });
    expect(segmentLabels()).toEqual(['Gas: 60, 60.0%', 'Power: 40, 40.0%']);
    expect(legendRows()).toHaveLength(2);
    expect(tableRows()).toHaveLength(2);
  });

  it('dims the other of two items that share an id when one is hovered', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60, id: 'energy' },
        { label: 'Power', value: 40, id: 'energy' }
      ]
    });
    segments()[0].dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();
    expect(segments().map((s) => s.classList.contains('opacity-50'))).toEqual([false, true]);
  });

  it.each<[string, string | number, string | number]>([
    ['two ids', 'gas', 'power'],
    ['the ids 1 and "1"', 1, '1']
  ])('keeps the segment and legend row of each item when the items reorder, %s', (_, a, b) => {
    const props = $state({
      items: [
        { label: 'Gas', value: 60, id: a },
        { label: 'Power', value: 40, id: b }
      ]
    });
    const instance = mount(CompositionBar, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    const [gasSegment, powerSegment] = segments();
    const [gasRow, powerRow] = legendRows();

    props.items = [props.items[1], props.items[0]];
    flushSync();

    expect(segmentLabels()).toEqual(['Power: 40, 40.0%', 'Gas: 60, 60.0%']);
    expect(segments()).toEqual([powerSegment, gasSegment]);
    expect(legendRows()).toEqual([powerRow, gasRow]);
  });
});

describe('CompositionBar (default percent format)', () => {
  it('writes the percent sign the way the active locale does', () => {
    renderBar({ items: shares });
    expect(segmentLabels()).toEqual(['Gas: 60, 60.0%', 'Power: 40, 40.0%']);
    expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Composition: 100 (2 shares) — Gas 60.0%, Power 40.0%'
    );
  });

  it('follows a non-base locale', () => {
    renderBar({ items: shares }, 'de');
    expect(segmentLabels()).toEqual(['Gas: 60, 60,0\u00a0%', 'Power: 40, 40,0\u00a0%']);
  });

  // A provider does not validate its locale; `Intl` throws on these two.
  it.each(['de_DE', ''])('renders in English under the provider locale %j', (locale) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderBar({ items: shares }, locale as Locale);
    expect(segmentLabels()).toEqual(['Gas: 60, 60.0%', 'Power: 40, 40.0%']);
  });
});

// Each part's share of the bar is the inline size the component writes on it,
// read in bar order: a segment by its label, the dashed rest as `rest`. The
// expected values are the rule worked by hand: a non-zero segment below the
// minimum takes the minimum, and every other part, the rest included, gives
// up that space by one common factor.
describe('CompositionBar (shares of the bar)', () => {
  function renderedShares() {
    const bar = document.querySelector('[role="group"]');
    return Array.from(bar?.children ?? [], (part) => {
      const segment = part.querySelector('[data-composition-segment]');
      const label = segment ? (segment.getAttribute('aria-label') ?? '').split(':')[0] : 'rest';
      const width = /width:\s*([\d.e+-]+)%/.exec(part.getAttribute('style') ?? '')?.[1];
      return { label, share: Number(width) };
    });
  }

  function expectShares(expected: Array<[label: string, share: number]>) {
    const actual = renderedShares();
    expect(actual.map((part) => part.label)).toEqual(expected.map(([label]) => label));
    actual.forEach((part, i) => {
      expect(part.share, part.label).toBeCloseTo(expected[i][1], 6);
    });
  }

  const items = (...values: number[]): CompositionItem[] =>
    values.map((value, i) => ({ label: String.fromCharCode(65 + i), value }));

  it('takes the space for a lifted segment from the rest too', () => {
    renderBar({ items: items(50, 30, 1), total: 125 });
    // Raw: 40, 24, 0.8, rest 35.2.
    const f = (100 - 1.5) / (40 + 24 + 35.2);
    expectShares([
      ['A', 40 * f],
      ['B', 24 * f],
      ['C', 1.5],
      ['rest', 35.2 * f]
    ]);
  });

  it('keeps a large rest when every segment is lifted', () => {
    renderBar({ items: items(1, 1), total: 1000 });
    // Raw: 0.1, 0.1, rest 99.8.
    expectShares([
      ['A', 1.5],
      ['B', 1.5],
      ['rest', 97]
    ]);
  });

  it('leaves a bar without rest as before', () => {
    renderBar({ items: items(950, 8, 3, 5) });
    // The three small ones take 1.5 each; the large one keeps what is left.
    expectShares([
      ['A', 95.5],
      ['B', 1.5],
      ['C', 1.5],
      ['D', 1.5]
    ]);
  });

  it('stops a part the lift would push below the minimum at the minimum', () => {
    renderBar({ items: items(1, 1.5, 97.5) });
    expectShares([
      ['A', 1.5],
      ['B', 1.5],
      ['C', 97]
    ]);
  });

  it('leaves a rest below the minimum its own share', () => {
    renderBar({ items: items(600, 385, 10), total: 1000 });
    // Raw: 60, 38.5, 1, rest 0.5.
    const f = (100 - 1.5 - 0.5) / (60 + 38.5);
    expectShares([
      ['A', 60 * f],
      ['B', 38.5 * f],
      ['C', 1.5],
      ['rest', 0.5]
    ]);
  });

  it('shows the raw shares when the minima alone would fill the bar', () => {
    renderBar({ items: items(1, 1, 1, 1, 1), total: 100, minSegmentPercent: 20 });
    expectShares([
      ['A', 1],
      ['B', 1],
      ['C', 1],
      ['D', 1],
      ['E', 1],
      ['rest', 95]
    ]);
  });

  it('shows the raw shares when every segment is below the minimum and there is no rest', () => {
    renderBar({ items: items(12, 18, 15, 10, 19, 13, 13), minSegmentPercent: 20 });
    expectShares([
      ['A', 12],
      ['B', 18],
      ['C', 15],
      ['D', 10],
      ['E', 19],
      ['F', 13],
      ['G', 13]
    ]);
  });

  // The lift is a matter of layout; the names, the summary and the table keep
  // the data's own percent.
  it('names and tabulates a lifted segment and the rest by their raw share', () => {
    renderBar({ items: items(50, 30, 1), total: 125 });
    expect(segmentLabels()).toEqual(['A: 50, 40.0%', 'B: 30, 24.0%', 'C: 1, 0.8%']);
    expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Composition: 125 (3 shares) — A 40.0%, B 24.0%, C 0.8%'
    );
    const rows = Array.from(document.querySelectorAll('tbody tr'), (row) =>
      Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())
    );
    expect(rows).toEqual([
      ['A', '50', '40.0%'],
      ['B', '30', '24.0%'],
      ['C', '1', '0.8%'],
      ['Total (remaining)', '44', '35.2%']
    ]);
  });
});
