// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TableColumns } from '$lib/factories/TableColumns';
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
 * Where a class applies. The bleed is gated on `td &`
 * (`TABLE_DIMENSIONS.bleed.cellX`), because the same components also render
 * into a `MobileCard` grid cell that has no inset to reach back over — so
 * "which classes count" is a question about context, and every reader below
 * takes one.
 */
type CellContext = { inTd: boolean };

const TD_CONTEXT = '[td_&]';

/**
 * The variant prefix of a class, or `''` — `[td_&]:-mx-3` → `[td_&]`. Split at
 * the last top-level `:`, so a colon inside an arbitrary value or selector
 * stays where it belongs.
 */
function variantPrefixOf(cls: string): string {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < cls.length; i += 1) {
    const ch = cls[i];
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    else if (ch === ':' && depth === 0) cut = i;
  }
  return cut === -1 ? '' : cls.slice(0, cut);
}

/**
 * Whether a class contributes to the RESTING layout in this context.
 *
 * Unprefixed always does. `[td_&]:` does inside a cell and nowhere else — that
 * is the whole point of the gate. Any OTHER arbitrary-selector prefix throws:
 * a second structural context would silently change what these sums mean, and
 * a reader that quietly ignored it would report the wrong number rather than
 * fail. Word-shaped prefixes (`hover:`, `focus-visible:`, `active:`) are
 * states, not resting layout, and are skipped — which is exact for the ones in
 * use here and would need revisiting if a cell wrapper ever grew a *responsive*
 * spacing class.
 */
function appliesIn(cls: string, ctx: CellContext): boolean {
  const prefix = variantPrefixOf(cls);
  if (prefix === '') return true;
  if (prefix === TD_CONTEXT) return ctx.inTd;
  if (prefix.startsWith('[')) {
    throw new Error(
      `Unknown structural context "${prefix}" on "${cls}" — this test resolves contexts by hand ` +
        'and must not guess whether a new one applies.'
    );
  }
  return false;
}

/** The utility half of a class: `[td_&]:-mx-3` → `-mx-3`. */
function utilityOf(cls: string): string {
  const prefix = variantPrefixOf(cls);
  return prefix === '' ? cls : cls.slice(prefix.length + 1);
}

/**
 * How far one element moves its content's left edge, in px, in the context it
 * actually renders in.
 *
 * Throws on a spacing class it cannot convert. A silent 0 is the failure mode
 * that matters: every assertion below is a sum, so an unreadable class would
 * quietly lower both sides and keep the suite green while measuring nothing.
 */
function ownOffsetLeftPx(el: Element): number {
  return offsetOfClasses([...el.classList], { inTd: !!el.closest('td') });
}

/** A fixed `w-<step>` in px. Keywords (`w-full`, `w-auto`, …) are not sizes. */
function widthClassPx(classes: string[]): number {
  const found = classes.filter((cls) => /^w-\d/.test(cls));
  if (found.length !== 1) {
    throw new Error(
      `Expected exactly one fixed width class, found ${JSON.stringify(found)} — the budget below ` +
        'is arithmetic over that class and cannot guess which one applies.'
    );
  }
  return Number(found[0].slice(2)) * SPACING_STEP_PX;
}

/** A `gap-<step>` in px. */
function gapClassPx(classes: string[]): number {
  const found = classes.filter((cls) => /^gap-\d/.test(cls));
  if (found.length !== 1) {
    throw new Error(`Expected exactly one gap class, found ${JSON.stringify(found)}.`);
  }
  return Number(found[0].slice(4)) * SPACING_STEP_PX;
}

/** A CSS length as written in a column's `width`, in px. */
function cssLengthPx(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(rem|px)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Cannot read "${value}" as a px or rem length — the actions column's width budget is ` +
        'checked against it and must not treat it as zero.'
    );
  }
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}

/**
 * The width keyword that wins in a context: a context-prefixed class outranks a
 * bare one, because `td .cls` is a class plus an element and a bare `.cls` is
 * only a class. Same rule the browser applies, for the one prefix in use.
 */
function winningWidthIn(classes: string[], ctx: CellContext): string | undefined {
  const applying = classes.filter((cls) => appliesIn(cls, ctx) && /^w-/.test(utilityOf(cls)));
  const prefixed = applying.filter((cls) => variantPrefixOf(cls) !== '');
  const winner = (prefixed.length > 0 ? prefixed : applying).at(-1);
  return winner === undefined ? undefined : utilityOf(winner);
}

/**
 * Two things a bleed has to get right, neither of which a net-offset sum can
 * see — a `-mx-3 px-3` pair is symmetric wherever it lands.
 *
 * **Where.** A bleed is only correct over an inset that exists. In a `<td>` it
 * reaches back over `padding.cellX`; in a `MobileCard` grid cell there is
 * nothing to reach over and the margins are pure overflow — 12px each side into
 * the card's `gap-x-4`, or past its edge. So no negative horizontal margin may
 * apply outside a cell.
 *
 * **How wide.** With `box-sizing: border-box`, `-mx-3` on a `w-full` box
 * over-constrains the width equation, and CSS 2.1 §10.3.3 resolves that by
 * discarding the specified `margin-right` (ltr): the box reaches the cell's
 * left edge and stops two insets short of the right one, painting a ground
 * clipped down one side. So wherever a bleed does apply, the width that applies
 * with it must be `auto`.
 */
function assertBleedIsWellFormed(classes: string[], label: string): void {
  const bleedsIn = (ctx: CellContext) =>
    classes.filter((cls) => appliesIn(cls, ctx) && /^-m[xl]-/.test(utilityOf(cls)));

  expect(
    bleedsIn({ inTd: false }),
    `${label}: bleeds outside a cell, where there is no inset to reach back over`
  ).toEqual([]);

  if (bleedsIn({ inTd: true }).length > 0) {
    expect(
      winningWidthIn(classes, { inTd: true }),
      `${label}: bleeds in a cell, so its width there must be auto`
    ).toBe('w-auto');
  }
}

/**
 * How far a class list moves its content's left edge, in px: padding pushes it
 * in, margin moves the whole box — and a negative margin is how a wrapper that
 * has to paint the cell reaches back out to its edge
 * (`TABLE_DIMENSIONS.bleed.cellX`). Both count, because the invariant is not
 * "no wrapper has padding" but "no wrapper displaces its content": a
 * bleed/padding pair sums to zero and a lone `px-2` does not.
 */
function offsetOfClasses(classes: string[], ctx: CellContext): number {
  let total = 0;
  for (const cls of classes) {
    if (!appliesIn(cls, ctx)) continue;
    const match = /^(-?)(p|px|pl|m|mx|ml)-(.+)$/.exec(utilityOf(cls));
    if (!match) continue;
    const [, sign, , raw] = match;
    const step = Number(raw);
    if (!Number.isFinite(step)) {
      throw new Error(
        `Cannot read "${cls}" as a Tailwind spacing step — this test measures the inset by ` +
          'class arithmetic and must not treat an unreadable class as zero.'
      );
    }
    total += (sign === '-' ? -1 : 1) * step * SPACING_STEP_PX;
  }
  return total;
}

/**
 * Where the content's own box begins — the point the walk below stops at.
 *
 * A wrapper is transparent: it positions its child and paints nothing, so the
 * reader sees through it to the text and its padding is part of the inset. A
 * control (`<button>`, link, field, image) or an element that paints its own
 * background (a Badge chip) is a box in its own right: its padding is internal
 * chrome, and the edge a reader lines up on is the box, not the glyphs in it.
 *
 * The background test only counts a bare utility. `hover:bg-…` on an
 * interactive wrapper is a rest state of nothing, so those keep being walked.
 */
const CONTENT_BOX_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'SVG']);

function isContentBox(el: Element): boolean {
  if (CONTENT_BOX_TAGS.has(el.tagName.toUpperCase())) return true;
  for (const cls of el.classList) if (cls.startsWith('bg-')) return true;
  return false;
}

/**
 * Everything between the cell's outer edge and its content: the `<td>` plus
 * every wrapper on the way down. Walks the first-element-child chain, which is
 * the content chain for all of them — `<td>` → container → content → text for a
 * default cell, `<td>` → container → number for a typed one, `<td>` → the
 * snippet's own element, `<td>` → content → label for the summary, and
 * `<td>` → wrapper → row → `<button>` for the action buttons.
 *
 * Wrappers are what this sums, so `probe` (a snippet that wraps its content in
 * `px-2`) must read one step higher than everything else — see the fixture.
 */
function contentInsetPx(td: Element): number {
  let total = ownOffsetLeftPx(td);
  let node = td.firstElementChild;
  while (node && !isContentBox(node)) {
    total += ownOffsetLeftPx(node);
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

describe('the offset reader', () => {
  // The positive control for every sum below: a reader that returned 0 for
  // everything would make every path "agree" at 0.
  it('converts a Tailwind step to pixels', () => {
    const el = document.createElement('div');
    el.className = 'flex px-3 text-sm';
    expect(ownOffsetLeftPx(el)).toBe(12);
  });

  // The bleed/padding pair the painting wrappers use: out and back in.
  it('cancels a negative margin against an equal padding', () => {
    const el = document.createElement('div');
    el.className = 'rounded-modify -mx-3 px-3';
    expect(ownOffsetLeftPx(el)).toBe(0);
  });

  it('counts a bleed that is not paid back', () => {
    const el = document.createElement('div');
    el.className = '-mx-3';
    expect(ownOffsetLeftPx(el)).toBe(-12);
  });

  it('refuses an arbitrary value instead of reading it as zero', () => {
    const el = document.createElement('div');
    el.className = 'px-[13px]';
    expect(() => ownOffsetLeftPx(el)).toThrow(/Tailwind spacing step/);
  });

  it('ignores classes that only look like spacing', () => {
    const el = document.createElement('div');
    el.className = 'pointer-events-none min-h-10 max-w-32 -mt-2 py-2 pt-4 hover:px-6';
    expect(ownOffsetLeftPx(el)).toBe(0);
  });
});

describe('the context reader', () => {
  const BLEED = ['[td_&]:-mx-3', '[td_&]:px-3', '[td_&]:w-auto', 'w-full'];

  it('splits a prefix at the top-level colon only', () => {
    expect(variantPrefixOf('-mx-3')).toBe('');
    expect(variantPrefixOf('[td_&]:-mx-3')).toBe('[td_&]');
    expect(utilityOf('[td_&]:-mx-3')).toBe('-mx-3');
    // A colon inside the value belongs to the value.
    expect(variantPrefixOf('bg-[url(a:b)]')).toBe('');
  });

  it('counts the gated pair inside a cell and nothing outside one', () => {
    expect(offsetOfClasses(BLEED, { inTd: true })).toBe(0);
    expect(offsetOfClasses(BLEED, { inTd: false })).toBe(0);
    // …and each half on its own is visible in the context it applies to, so a
    // gate that dropped only one of them cannot pass as "net zero".
    expect(offsetOfClasses(['[td_&]:-mx-3'], { inTd: true })).toBe(-12);
    expect(offsetOfClasses(['[td_&]:-mx-3'], { inTd: false })).toBe(0);
    expect(offsetOfClasses(['[td_&]:px-3'], { inTd: true })).toBe(12);
  });

  it('resolves the width the same way the cascade does', () => {
    // `td .cls` outranks `.cls`, so inside a cell the gated width wins.
    expect(winningWidthIn(BLEED, { inTd: true })).toBe('w-auto');
    expect(winningWidthIn(BLEED, { inTd: false })).toBe('w-full');
  });

  it('refuses a structural context it has not been taught', () => {
    expect(() => offsetOfClasses(['[tr_&]:px-3'], { inTd: true })).toThrow(/Unknown structural/);
  });

  // The invariant itself, in every direction — a check that never fires would
  // pass every fold below.
  it('accepts only a bleed that is gated and wide enough', () => {
    // Gated, auto width: the shape in use.
    expect(() => assertBleedIsWellFormed(BLEED, 'gated')).not.toThrow();
    // No bleed at all: nothing to require, and the wrapper keeps `w-full`.
    expect(() => assertBleedIsWellFormed(['w-full'], 'plain')).not.toThrow();

    // Ungated — this is N4: correct in a cell, pure overflow in a card.
    expect(() => assertBleedIsWellFormed(['-mx-3', 'px-3', 'w-auto'], 'ungated')).toThrow(
      /outside a cell/
    );
    // Ungated AND on a full width: both defects at once.
    expect(() => assertBleedIsWellFormed(['-mx-3', 'px-3', 'w-full'], 'ungated+full')).toThrow();
    // Gated but on a full width: the margin-right CSS discards.
    expect(() =>
      assertBleedIsWellFormed(['[td_&]:-mx-3', '[td_&]:px-3', 'w-full'], 'gated, w-full')
    ).toThrow(/width there must be auto/);
  });
});

describe('the size readers', () => {
  // Same reason as the offset reader's controls: the width budget is a
  // comparison, and a reader that answered 0 would let anything through.
  it('reads a fixed width class', () => {
    expect(widthClassPx(['inline-flex', 'w-8', 'h-8'])).toBe(32);
    expect(widthClassPx(['w-3.5'])).toBe(14);
  });

  it('does not mistake a width keyword for a size', () => {
    expect(() => widthClassPx(['w-full', 'w-auto'])).toThrow(/exactly one fixed width/);
  });

  it('refuses an ambiguous pair of widths', () => {
    expect(() => widthClassPx(['w-7', 'w-8'])).toThrow(/exactly one fixed width/);
  });

  it('reads a gap class', () => {
    expect(gapClassPx(['flex', 'gap-1'])).toBe(4);
    expect(() => gapClassPx(['flex'])).toThrow(/exactly one gap/);
  });

  it('reads a CSS length', () => {
    expect(cssLengthPx('9rem')).toBe(144);
    expect(cssLengthPx('120px')).toBe(120);
    expect(() => cssLengthPx('auto')).toThrow(/px or rem/);
  });
});

describe.each(SIZES)('one cell inset at size=%s', (size) => {
  // Without this, most of the assertions below could pass on an empty cell: a
  // `<td>` that rendered nothing has exactly the `<td>`'s own padding, which is
  // the number the test is looking for.
  it('really renders every path', () => {
    const root = mountTable({ size });

    expect(cellAt(root, 'cell-1-name').textContent).toContain('Ada');
    // The typed cell brings `numberCellVariants`' own container with it.
    expect(cellAt(root, 'cell-1-amount').querySelector('.tabular-nums')).not.toBeNull();
    expect(
      cellAt(root, 'cell-1-note').querySelector('[data-testid="snippet-content"]')
    ).not.toBeNull();
    expect(cellAt(root, 'cell-1-custom').textContent).toContain('custom');
    // Three buttons from the factory's own trio — the width budget in the last
    // describe of this file counts them and fails if a fourth appears.
    expect(cellAt(root, 'cell-1-actions').querySelectorAll('button')).toHaveLength(3);
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
    // `CustomCell` as a column component — the default renderer's own wrapper,
    // reached through the public component rather than through `TableCell`.
    expect(contentInsetPx(cellAt(root, 'cell-1-custom'))).toBe(expected);
    // The summary row, which already agreed with the default path and has to
    // keep agreeing — its `content` slot no longer holds a hand-matched copy.
    expect(contentInsetPx(cellAt(root, 'summary-cell-amount'))).toBe(expected);
  });

  // Split out because it is the one path whose wrapper lives in **markup**
  // rather than in a variant config: `ActionButtons` writes its own container
  // `<div>`, so the config-level assertion further down cannot see it and the
  // first pass at #256 left the actions column a step out.
  it('holds the factory actions column on the same edge', () => {
    const root = mountTable({ size });
    expect(contentInsetPx(cellAt(root, 'cell-1-actions'))).toBe(DATA_CELL_INSET_PX[size]);
  });

  // The rest of the typed roster. Same property, one cell per component —
  // mounted rather than read off the variant config, because that is the only
  // way markup between the `<td>` and the content shows up at all.
  it.each(['user', 'userPainted', 'customPainted', 'status', 'code', 'created', 'url'])(
    'holds the %s column on the same edge',
    (columnId) => {
      const root = mountTable({ size });
      const cell = cellAt(root, `cell-1-${columnId}`);
      // An empty cell would report the `<td>`'s padding — i.e. exactly the
      // number being asserted — so the cell has to have rendered something.
      expect(cell.firstElementChild, `${columnId} rendered nothing`).not.toBeNull();
      expect(contentInsetPx(cell)).toBe(DATA_CELL_INSET_PX[size]);
    }
  );

  // The positive control for the walk itself. Everything above is a sum over
  // the `<td>` and its wrappers; if the walk stopped at the `<td>`, every one
  // of those sums would still come out right and only this one would not.
  it('does descend into wrappers (a deliberate px-2 reads one step higher)', () => {
    const root = mountTable({ size });
    expect(contentInsetPx(cellAt(root, 'cell-1-probe'))).toBe(DATA_CELL_INSET_PX[size] + 8);
  });

  // The painting wrappers, in the cell: the bleed applies here, and the pair
  // cancels — so the ground reaches the cell's edges while the text does not
  // move. Both halves are one gated token, so this is also what proves the
  // gate lets them BOTH through where it should.
  it('lets a painting wrapper bleed inside the cell without moving its content', () => {
    const root = mountTable({ size });
    const painted = cellAt(root, 'cell-1-customPainted').firstElementChild;
    if (!painted) throw new Error('The painted cell rendered nothing.');

    const classes = [...painted.classList];
    expect(
      classes.some((cls) => cls.startsWith(`[td_&]:-mx-`)),
      'no bleed on the wrapper'
    ).toBe(true);
    expect(ownOffsetLeftPx(painted)).toBe(0);
  });

  it('reads a non-zero inset (the sums above are not all zero)', () => {
    const root = mountTable({ size });
    expect(contentInsetPx(cellAt(root, 'cell-1-name'))).toBeGreaterThan(0);
  });

  // Not a fix — the header is out of scope for #256 — but the number the
  // align-revert note now quotes, so it is checked rather than asserted in
  // prose. Before the unification the gap depended on how the column was
  // filled (8px for a default cell, 4px for a typed one, 0 for a snippet);
  // now it is one number per size, which is what makes the header half a
  // value change instead of a hunt.
  it('leaves the header title exactly one step inside its column', () => {
    const root = mountTable({ size });
    const th = root.querySelector('thead th');
    if (!th) throw new Error('No header cell rendered.');

    expect(DATA_CELL_INSET_PX[size] - ownOffsetLeftPx(th)).toBe(
      { sm: 4, md: 8, lg: 12 }[size as 'sm' | 'md' | 'lg']
    );
  });

  it('leaves the structural columns on the control step', () => {
    const root = mountTable({ size, selectionMode: 'multi' });
    const checkboxCell = root.querySelector('tbody tr td:first-child');
    if (!checkboxCell) throw new Error('No selection cell rendered.');

    expect(ownOffsetLeftPx(checkboxCell)).toBe(CONTROL_CELL_INSET_PX[size]);
    // …and the data cells beside it are unaffected by the extra column.
    expect(contentInsetPx(cellAt(root, 'cell-1-note'))).toBe(DATA_CELL_INSET_PX[size]);
  });
});

/**
 * The other side of the gate: the same components, in a `MobileCard`.
 *
 * Both layouts are in the tree at once — CSS decides which is shown — so the
 * card's copy of a cell is reachable from the same mount, and the bleed's
 * context gate can be measured rather than argued. A card's grid cell carries
 * no inset (the padding is on the card's `content`, and the columns are
 * separated by `gap-x-4`), so an ungated bleed was pure overflow: 12px each
 * side into the gap, or past the card's edge.
 *
 * jsdom computes no layout, so what is checked is the same class arithmetic as
 * everywhere else — evaluated in the card's context instead of the cell's.
 */
describe('the painting wrappers in a mobile card', () => {
  function cardCopyOf(root: HTMLElement, testId: string): Element {
    const list = root.querySelector('[data-testid="mobile-table"]');
    if (!list) throw new Error('No mobile list rendered — the layout switch changed.');
    const el = list.querySelector(`[data-testid="${testId}"]`);
    if (!el) throw new Error(`The card renders no "${testId}".`);
    return el;
  }

  it('renders the painted cell in the card too', () => {
    const root = mountTable({});
    expect(cardCopyOf(root, 'painted-cell').closest('td')).toBeNull();
  });

  it('does not bleed there', () => {
    const root = mountTable({});
    const painted = cardCopyOf(root, 'painted-cell');

    // The classes are the same ones the cell copy carries…
    expect([...painted.classList].some((cls) => cls.startsWith('[td_&]:-mx-'))).toBe(true);
    // …and none of them applies here, so the wrapper sits exactly where it did
    // before the bleed existed: no overflow into the grid gap, no inset either.
    expect(ownOffsetLeftPx(painted)).toBe(0);
    expect(winningWidthIn([...painted.classList], { inTd: false })).toBe('w-full');
  });
});

/**
 * The other half of the fix, at the config level: a wrapper inside a cell may
 * not displace its content horizontally. Net zero, not "no padding" — the
 * wrappers that paint (interactive / clickable) take the inset back as a
 * `bleed.cellX` + `padding.cellX` pair so the hover ground covers the cell
 * again, and that pair cancels. A lone `px-2` does not, which is the drift #256
 * removed.
 *
 * This reads the configs, so it can only see what a variant declares. Markup
 * between the `<td>` and the content is invisible here — `ActionButtons` wrote
 * its own `px-2` container and passed this check while sitting a step out. The
 * mounted assertions above are the ones that catch that; these hold the line
 * for every axis combination, which no fixture could mount.
 */
describe('no wrapper inside a data cell displaces its content', () => {
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

  /**
   * Every fold of one wrapper's container: each size, and every boolean axis in
   * both positions, so the painting compounds (`interactive`, `clickable`) are
   * actually reached — they are exactly the ones carrying the bleed pair, and a
   * size-only sweep would never see them. The axes are read from the config: a
   * hand-kept list is the copy most likely to fall behind, and it would go
   * green by checking fewer cases than exist.
   */
  function eachContainerFold(name: string, check: (classes: string[], label: string) => void) {
    const variants = WRAPPERS[name] as SlotVariants;
    const sizes = Object.keys(variants.config.variants?.size ?? {});
    expect(sizes.length).toBeGreaterThan(0);

    const booleanAxes = Object.entries(variants.config.variants ?? {})
      .filter(([, values]) => 'true' in values && 'false' in values)
      .map(([axis]) => axis);

    for (const size of sizes) {
      for (const axis of ['', ...booleanAxes]) {
        for (const value of axis ? [true, false] : [undefined]) {
          const props = axis ? { size, [axis]: value } : { size };
          const label = `${name} @ size=${size}${axis ? `, ${axis}=${value}` : ''}`;
          check(variants(props).container().split(/\s+/).filter(Boolean), label);
        }
      }
    }
  }

  // In BOTH contexts. Gating the bleed on `td &` split this into two questions:
  // inside a cell the pair has to cancel, and outside one — the MobileCard grid
  // cell, where there is no inset to reach back over — nothing may apply at
  // all. Half the pair surviving the gate would displace the card's content by
  // an inset, which is the #256 defect one level down.
  it.each(Object.keys(WRAPPERS))('%s.container() displaces nothing', (name) => {
    eachContainerFold(name, (classes, label) => {
      expect(offsetOfClasses(classes, { inTd: true }), `${label} (in a cell)`).toBe(0);
      expect(offsetOfClasses(classes, { inTd: false }), `${label} (outside a cell)`).toBe(0);
    });
  });

  // The root cause of the one-sided ground, as a class invariant. Symmetric
  // class sums cannot see it: the defect is in how CSS resolves an
  // over-constrained width equation, not in which classes are present.
  it.each(Object.keys(WRAPPERS))(
    '%s.container() bleeds only in a cell, on an auto width',
    (name) => {
      eachContainerFold(name, assertBleedIsWellFormed);
    }
  );

  it('summaryRowVariants.content()', () => {
    for (const size of SIZES) {
      const classes = summaryRowVariants({ size }).content().split(/\s+/).filter(Boolean);
      expect(offsetOfClasses(classes, { inTd: true }), `summary @ size=${size}`).toBe(0);
      expect(offsetOfClasses(classes, { inTd: false }), `summary @ size=${size}`).toBe(0);
      assertBleedIsWellFormed(classes, `summary @ size=${size}`);
    }
  });
});

/**
 * The actions column's width budget, as arithmetic over what the components
 * actually render.
 *
 * Under `table-layout: auto` a declared width is a floor, not a promise: when
 * the cell's min-content exceeds it the column silently grows and everything
 * after it shifts. `TableColumns.actions` therefore declares a width computed
 * from the button trio, and this is the check that the computation still holds
 * — a bigger button, a wider gap, a fourth built-in action or a larger cell
 * inset must fail here rather than in someone's layout.
 *
 * Read from the mounted tree rather than recomputed: the button size a cell
 * component gets is `TableCell`'s to decide (it hands a `lg` table the `md`
 * size), and repeating that rule here would be the second copy this whole PR
 * is about.
 *
 * One known simplification, and the failure mode it leaves open. The blocks
 * `Button` also carries `min-w-min`, so a button whose own min-content is wider
 * than its `w-<step>` uses that instead — at `sm` that is 32px against `w-7`'s
 * 28, i.e. 116px rather than 104px. The formula below reads the declared width
 * class, which is the number the factory's comment is derived from, so what it
 * cannot see is the min-content growing *underneath* an unchanged `w-8`: a
 * wider icon or more button padding in blocks would lift the real minimum past
 * `9rem` while every assertion here stayed green.
 *
 * That matters most at `lg`, where the budget is exactly full — 144px of 144px,
 * zero reserve. A `w-*` change fails here; a blocks-side change to the button's
 * internals does not, and shows up as a column that quietly grows past its
 * declaration. Measuring the used width instead would mean emulating min-content
 * in jsdom, which is the kind of second oracle this repo has learned not to
 * write; the honest place to catch it is a browser measurement.
 */
describe.each(SIZES)('the actions column at size=%s', (size) => {
  const declaredWidthPx = cssLengthPx(String(TableColumns.actions('Actions').width));

  it('fits inside the width its factory declares', () => {
    const root = mountTable({ size });
    const cell = cellAt(root, 'cell-1-actions');
    const buttons = [...cell.querySelectorAll('button')];
    expect(buttons.length).toBe(3);

    const buttonWidths = buttons.map((button) => widthClassPx([...button.classList]));
    expect(new Set(buttonWidths).size, 'the trio should share one width').toBe(1);

    const row = buttons[0].parentElement;
    if (!row) throw new Error('The buttons have no row to sit in.');
    const gap = gapClassPx([...row.classList]);

    const minContent =
      buttons.length * buttonWidths[0] + (buttons.length - 1) * gap + 2 * DATA_CELL_INSET_PX[size];

    expect(
      minContent,
      `${buttons.length} × ${buttonWidths[0]}px + ${buttons.length - 1} × ${gap}px + 2 × ` +
        `${DATA_CELL_INSET_PX[size]}px = ${minContent}px, declared ${declaredWidthPx}px`
    ).toBeLessThanOrEqual(declaredWidthPx);
  });
});
