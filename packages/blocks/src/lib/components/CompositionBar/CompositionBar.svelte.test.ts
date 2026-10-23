// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartLocaleHost from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import CompositionBar from './CompositionBar.svelte';

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

  it.each<[string, Locale | undefined]>([
    ['the base locale', undefined],
    ['German', 'de']
  ])('names each legend row with the text it shows, in %s', (_, locale) => {
    renderBar({ items: shares }, locale);
    const rows = Array.from(document.querySelectorAll<HTMLElement>('ul > li > button'));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(` ${words(row.getAttribute('aria-label') ?? '')} `).toContain(
        ` ${words(row.textContent ?? '')} `
      );
    }
    // One name per item, whichever of its two controls a speech user addresses.
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(segmentLabels());
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
