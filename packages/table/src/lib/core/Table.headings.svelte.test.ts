// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Column } from '#lib/types/tableTypes.js';
import { createTableView } from '#lib/view/view.svelte.js';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * The headings a table renders itself follow one `headingLevel`: the titles of
 * the built-in desktop states, and in the card list each group's header, a
 * group's summary one rank below it, and the total summary at the table's own
 * rank — so an embedding page can keep its outline without a skip.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100, dept: 'Platform' },
  { id: 2, name: 'Grace', amount: 200, dept: 'Design' }
];

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' },
  { accessor: 'dept', title: 'Department', groupable: true }
] as Column[];

const SUMMARY = { defaults: { summaries: [{ column: 'amount', type: 'sum' as const }] } };

let mounted: Array<{ comp: Record<string, unknown>; target: HTMLElement }> = [];

afterEach(() => {
  for (const { comp, target } of mounted.splice(0)) {
    unmount(comp);
    target.remove();
  }
});

function mountTable(props: Record<string, unknown>): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  // Typed wide, like the sister suites: the harness pins its own Row shape.
  const merged: Record<string, unknown> = { items: ROWS, columns: COLUMNS, ...props };
  const comp = mount(TableHarness, { target, props: merged }) as Record<string, unknown>;
  flushSync();
  mounted.push({ comp, target });
  return target;
}

const rankOf = (el: Element | null | undefined) => el?.tagName.toLowerCase();

function headingIn(root: Element, testId: string): Element | null {
  return (
    root.querySelector(`[data-testid="${testId}"]`)?.querySelector('h1,h2,h3,h4,h5,h6') ?? null
  );
}

function mobileHeadings(root: HTMLElement): string[] {
  const list = root.querySelector('[data-testid="mobile-table"]');
  return [...(list?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? [])].map(
    (h) => `${rankOf(h)} ${h.textContent?.replace(/\s+/g, ' ').trim()}`
  );
}

describe('the desktop states take the table rank', () => {
  const source = { processing: 'client' as const, items: ROWS };

  it('render h3 by default', () => {
    expect(rankOf(headingIn(mountTable({ items: [] }), 'empty-state'))).toBe('h3');
    expect(
      rankOf(
        headingIn(
          mountTable({ source: { ...source, loading: true, error: null } }),
          'loading-state'
        )
      )
    ).toBe('h3');
    expect(
      rankOf(
        headingIn(
          mountTable({ source: { ...source, loading: false, error: 'nope' } }),
          'error-state'
        )
      )
    ).toBe('h3');
  });

  it('render the requested rank', () => {
    const headingLevel = 2;
    expect(rankOf(headingIn(mountTable({ items: [], headingLevel }), 'empty-state'))).toBe('h2');
    expect(
      rankOf(
        headingIn(
          mountTable({ source: { ...source, loading: true, error: null }, headingLevel }),
          'loading-state'
        )
      )
    ).toBe('h2');
    expect(
      rankOf(
        headingIn(
          mountTable({ source: { ...source, loading: false, error: 'nope' }, headingLevel }),
          'error-state'
        )
      )
    ).toBe('h2');
  });
});

describe('the card list derives its ranks from the table rank', () => {
  it('a group header takes the rank, its summary one below', () => {
    const root = mountTable({
      prefs: SUMMARY,
      view: createTableView({ defaults: { groupBy: 'dept' } }),
      headingLevel: 2
    });
    const ranks = mobileHeadings(root).map((h) => h.split(' ')[0]);

    expect(ranks).toEqual(['h2', 'h3', 'h2', 'h3']);
  });

  it('the total summary of an ungrouped list takes the rank itself', () => {
    // Nothing above it in the list carries a heading, so one rank below the
    // table's would skip a level in the embedding page's outline.
    const root = mountTable({ prefs: SUMMARY, headingLevel: 2 });

    expect(mobileHeadings(root).map((h) => h.split(' ')[0])).toEqual(['h2']);
  });

  it('defaults to h3, as the state titles do', () => {
    const grouped = mountTable({
      prefs: SUMMARY,
      view: createTableView({ defaults: { groupBy: 'dept' } })
    });
    expect(mobileHeadings(grouped).map((h) => h.split(' ')[0])).toEqual(['h3', 'h4', 'h3', 'h4']);

    const flat = mountTable({ prefs: SUMMARY });
    expect(mobileHeadings(flat).map((h) => h.split(' ')[0])).toEqual(['h3']);
  });
});
