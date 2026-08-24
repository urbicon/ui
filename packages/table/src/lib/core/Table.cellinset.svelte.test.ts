// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  actionCellVariants,
  copyButtonVariants,
  customCellVariants,
  dateCellVariants,
  linkCellVariants,
  numberCellVariants,
  progressCellVariants,
  statusCellVariants,
  summaryRowVariants,
  textCellVariants,
  userCellVariants
} from '$lib/variants';
import CellInsetHarness from './__fixtures__/CellInsetHarness.svelte';

/**
 * One inset per cell (#256).
 *
 * A body cell can be filled three ways — the default renderer, a
 * `column.component`, or a `column.cell` snippet — and each used to bring its
 * own inner padding: 12px, 8px and 4px from the `<td>` edge at `md`, measured
 * in the shipped docs demos, adjacent columns of one table disagreeing. The
 * summary row carried a fourth, hand-matched copy.
 *
 * The measurement here is class arithmetic over the real mounted DOM rather
 * than an assertion per variant config: the snippet path has no variant at all
 * (it renders straight into the cell), so the only place the three paths can be
 * compared is the tree. jsdom computes no layout, but Tailwind's spacing scale
 * is arithmetic — 0.25rem per step, 4px at the default root size, the same
 * assumption `TABLE_DIMENSIONS`' `heightClassToPx` already runs on.
 *
 * The numbers below are the pre-#256 DEFAULT path, to the pixel: that path and
 * the summary row must not move, the other two must come to it.
 */

const SIZES = ['sm', 'md', 'lg'] as const;

/** What a data cell's content is offset from the `<td>` edge, per size. */
const DATA_CELL_INSET_PX: Record<(typeof SIZES)[number], number> = { sm: 6, md: 12, lg: 20 };

/**
 * What a structural cell (selection checkbox here) keeps — the narrower control
 * step, deliberately NOT the reading inset: widening those columns is a
 * different defect (`w-12` / `w-10` against the colgroup's `3rem` / `2.5rem`)
 * and a different wave. Asserted so this stays a decision rather than a
 * side effect.
 */
const CONTROL_CELL_INSET_PX: Record<(typeof SIZES)[number], number> = { sm: 2, md: 4, lg: 8 };

const SPACING_STEP_PX = 4;

/**
 * The horizontal padding one element declares, in px.
 *
 * Throws on a padding class it cannot convert. A silent 0 is the failure mode
 * that matters: every assertion below is a sum, so an unreadable class would
 * quietly lower both sides and keep the suite green while measuring nothing.
 */
function ownPaddingLeftPx(el: Element): number {
  let total = 0;
  for (const cls of el.classList) {
    const match = /^(?:p|px|pl)-(.+)$/.exec(cls);
    if (!match) continue;
    const step = Number(match[1]);
    if (!Number.isFinite(step)) {
      throw new Error(
        `Cannot read "${cls}" as a Tailwind spacing step — this test measures the inset by ` +
          'class arithmetic and must not treat an arbitrary value as zero.'
      );
    }
    total += step * SPACING_STEP_PX;
  }
  return total;
}

/**
 * Everything between the cell's outer edge and its text: the `<td>` plus every
 * wrapper on the way down to the content. Walks the first-element-child chain,
 * which is the content chain for all four paths — `<td>` → container → content
 * → text for a default cell, `<td>` → container → number for a typed one,
 * `<td>` → the snippet's own element, `<td>` → content → label for the summary.
 */
function contentInsetPx(td: Element): number {
  let total = 0;
  let node: Element | null = td;
  while (node) {
    total += ownPaddingLeftPx(node);
    node = node.firstElementChild;
  }
  return total;
}

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(props: Record<string, unknown> = {}): HTMLElement {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(CellInsetHarness, { target, props }) as Record<string, unknown>;
  flushSync();
  return target;
}

function cellAt(root: HTMLElement, testId: string): Element {
  const cell = root.querySelector(`[data-testid="${testId}"]`);
  if (!cell) throw new Error(`No cell "${testId}" rendered — the harness changed shape.`);
  return cell;
}

beforeEach(() => {
  // Node ≥ 25's broken global localStorage stub shadows jsdom's Storage under
  // vitest; the store touches storage on mount. Same shape as Table.render.
  const map = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
      key: (index: number) => [...map.keys()][index] ?? null,
      removeItem: (key: string) => void map.delete(key),
      setItem: (key: string, value: string) => void map.set(key, String(value))
    } satisfies Storage
  });
});

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
});

describe('the padding reader', () => {
  // The positive control for every sum below: a reader that returned 0 for
  // everything would make all four paths "agree" at 0.
  it('converts a Tailwind step to pixels', () => {
    const el = document.createElement('div');
    el.className = 'flex px-3 text-sm';
    expect(ownPaddingLeftPx(el)).toBe(12);
  });

  it('refuses an arbitrary value instead of reading it as zero', () => {
    const el = document.createElement('div');
    el.className = 'px-[13px]';
    expect(() => ownPaddingLeftPx(el)).toThrow(/Tailwind spacing step/);
  });

  it('ignores classes that only look like padding', () => {
    const el = document.createElement('div');
    el.className = 'pointer-events-none py-2 pt-4 hover:px-6';
    expect(ownPaddingLeftPx(el)).toBe(0);
  });
});

describe.each(SIZES)('one cell inset at size=%s', (size) => {
  // Without this, three of the four assertions below could pass on an empty
  // cell: a `<td>` that rendered nothing has exactly the `<td>`'s own padding,
  // which is the number the test is looking for.
  it('really renders all four paths', () => {
    const root = mountTable({ size });

    expect(cellAt(root, 'cell-1-name').textContent).toContain('Ada');
    // The typed cell brings `numberCellVariants`' own container with it.
    expect(cellAt(root, 'cell-1-amount').querySelector('.tabular-nums')).not.toBeNull();
    expect(
      cellAt(root, 'cell-1-note').querySelector('[data-testid="snippet-content"]')
    ).not.toBeNull();
    expect(cellAt(root, 'summary-cell-amount').textContent?.trim()).not.toBe('');
  });

  it('holds every body-cell path and the summary row on the same edge', () => {
    const root = mountTable({ size });
    const expected = DATA_CELL_INSET_PX[size];

    // Default renderer — the reference edge. It must not move.
    expect(contentInsetPx(cellAt(root, 'cell-1-name'))).toBe(expected);
    // `column.component` (NumberCell): was 8px at md, one step short.
    expect(contentInsetPx(cellAt(root, 'cell-1-amount'))).toBe(expected);
    // `column.cell` snippet: rendered straight into the `<td>`, was 4px at md.
    expect(contentInsetPx(cellAt(root, 'cell-1-note'))).toBe(expected);
    // The summary row, which already agreed with the default path and has to
    // keep agreeing — its `content` slot no longer holds a hand-matched copy.
    expect(contentInsetPx(cellAt(root, 'summary-cell-amount'))).toBe(expected);
  });

  it('reads a non-zero inset (the sums above are not all zero)', () => {
    const root = mountTable({ size });
    expect(contentInsetPx(cellAt(root, 'cell-1-name'))).toBeGreaterThan(0);
  });

  it('leaves the structural columns on the control step', () => {
    const root = mountTable({ size, selectionMode: 'multi' });
    const checkboxCell = root.querySelector('tbody tr td:first-child');
    if (!checkboxCell) throw new Error('No selection cell rendered.');

    expect(ownPaddingLeftPx(checkboxCell)).toBe(CONTROL_CELL_INSET_PX[size]);
    // …and the data cells beside it are unaffected by the extra column.
    expect(contentInsetPx(cellAt(root, 'cell-1-note'))).toBe(DATA_CELL_INSET_PX[size]);
  });
});

/**
 * The other half of the fix: with the inset on the `<td>`, no wrapper inside a
 * cell may carry horizontal padding — that is what makes a second, drifting
 * copy unrepresentable rather than merely absent today.
 */
describe('no wrapper inside a data cell carries horizontal padding', () => {
  type SlotVariants = ((props: Record<string, unknown>) => Record<string, () => string>) & {
    config: { variants?: Record<string, Record<string, unknown>> };
  };

  const WRAPPERS: Record<string, unknown> = {
    textCellVariants,
    numberCellVariants,
    dateCellVariants,
    statusCellVariants,
    userCellVariants,
    actionCellVariants,
    linkCellVariants,
    progressCellVariants,
    copyButtonVariants,
    customCellVariants
  };

  it.each(Object.keys(WRAPPERS))('%s.container()', (name) => {
    const variants = WRAPPERS[name] as SlotVariants;
    // Read the sizes from the config: a hand-kept list is the copy most likely
    // to fall behind, and it would go green by checking fewer sizes than exist.
    const sizes = Object.keys(variants.config.variants?.size ?? {});
    expect(sizes.length).toBeGreaterThan(0);

    for (const size of sizes) {
      expect(variants({ size }).container(), `${name} @ size=${size}`).not.toMatch(
        /(?:^|\s)(?:p|px|pl|pr)-/
      );
    }
  });

  it('summaryRowVariants.content()', () => {
    for (const size of SIZES) {
      expect(summaryRowVariants({ size }).content(), `summary @ size=${size}`).not.toMatch(
        /(?:^|\s)(?:p|px|pl|pr)-/
      );
    }
  });
});
