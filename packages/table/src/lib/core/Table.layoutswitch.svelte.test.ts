// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { LAYOUT_SWITCH_CLASSES } from '../variants/table.variants';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * The desktop/card switch as one mechanism.
 *
 * Both layout roots are always in the DOM — which of them a reader sees is
 * decided in CSS by three classes that only work as a set: the query container
 * on the table's own box, and one complementary `hidden` on each root. jsdom
 * evaluates no container query, so this file cannot measure what hides; what it
 * can measure is that the set is never partial, and a partial set is exactly
 * the defect: with the container gone neither `@max-…:hidden` nor
 * `@min-…:hidden` matches anything, so the grid and the card list both render —
 * 25 rows plus 25 records, two selection checkboxes per record, a doubled
 * `aria-rowcount` (#271).
 *
 * "All three absent" fails the same way for the same reason, so the only
 * reading that is not the bug is all three present — in every styling mode.
 *
 * The class literals here are the test's own oracle (Tailwind finds class names
 * by scanning source text, so neither side may build them from a variable); the
 * membership check below ties that oracle back to the config it is checking.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 300 },
  { id: 2, name: 'Grace', amount: 100 }
];

const QUERY_CONTAINER = '@container';

const HALVES = {
  '48rem': { desktop: '@max-[48rem]:hidden', mobile: '@min-[48rem]:hidden' },
  '32rem': { desktop: '@max-[32rem]:hidden', mobile: '@min-[32rem]:hidden' }
} as const;

type Step = keyof typeof HALVES;

let target: HTMLElement | null = null;
let comp: Record<string, unknown> | null = null;

function mountTable(props: Record<string, unknown> = {}): HTMLElement {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(TableHarness, { target, props: { items: ROWS, ...props } });
  flushSync();
  return target;
}

function classesOf(root: HTMLElement, selector: string): string[] {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`${selector} did not render`);
  return el.className.split(/\s+/);
}

/** The switch read off the rendered tree, as one shape rather than three facts. */
function readSwitch(root: HTMLElement, step: Step) {
  return {
    queryContainer: classesOf(root, '[data-table-container]').includes(QUERY_CONTAINER),
    desktopHalf: classesOf(root, '[data-table-layout="desktop"]').includes(HALVES[step].desktop),
    mobileHalf: classesOf(root, '[data-table-layout="mobile"]').includes(HALVES[step].mobile)
  };
}

const WHOLE = { queryContainer: true, desktopHalf: true, mobileHalf: true };

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = null;
  target = null;
});

describe('the layout switch survives `unstyled` whole', () => {
  it('is wired with the default styling', () => {
    expect(readSwitch(mountTable(), '48rem')).toEqual(WHOLE);
  });

  it('is wired under `unstyled` — the case that was half-wired', () => {
    expect(readSwitch(mountTable({ unstyled: true }), '48rem')).toEqual(WHOLE);
  });

  it('follows `cardsBelow` under `unstyled` instead of a fixed step', () => {
    const root = mountTable({ unstyled: true, cardsBelow: '32rem' });
    expect(readSwitch(root, '32rem')).toEqual(WHOLE);
    // Positive control for the reader itself: at 32rem the 48rem literals must
    // be absent, so it is matching the step and not any `hidden` it finds.
    expect(readSwitch(root, '48rem')).toEqual({
      queryContainer: true,
      desktopHalf: false,
      mobileHalf: false
    });
  });

  it('positive control: a missing part of the set is reported, not tolerated', () => {
    // The same rig, sabotaged one class at a time — without this the equality
    // above could be green because `readSwitch` never reads anything real.
    const root = mountTable({ unstyled: true });
    const parts = [
      ['[data-table-container]', QUERY_CONTAINER, 'queryContainer'],
      ['[data-table-layout="desktop"]', HALVES['48rem'].desktop, 'desktopHalf'],
      ['[data-table-layout="mobile"]', HALVES['48rem'].mobile, 'mobileHalf']
    ] as const;

    for (const [selector, cls, key] of parts) {
      const el = root.querySelector(selector) as HTMLElement;
      el.classList.remove(cls);
      expect(readSwitch(root, '48rem'), `removing ${cls} went unnoticed`).toEqual({
        ...WHOLE,
        [key]: false
      });
      el.classList.add(cls);
    }

    expect(readSwitch(root, '48rem')).toEqual(WHOLE);
  });

  it('control: `unstyled` still strips the look it is for', () => {
    // The fix must not become "unstyled keeps everything". `framed` is the
    // loudest look the table has, and the container's own flex context goes
    // with it — as does everything in the config that leans on that context.
    const root = mountTable({ unstyled: true, variant: 'framed', fit: 'viewport' });
    const container = classesOf(root, '[data-table-container]');
    for (const look of ['flex', 'flex-col', 'gap-2', 'w-full']) {
      expect(container, `container still carries ${look}`).not.toContain(look);
    }
    for (const look of ['border', 'rounded-contain', 'bg-surface-elevated', 'md:flex-auto']) {
      expect(classesOf(root, '[data-table-layout="desktop"]')).not.toContain(look);
      expect(classesOf(root, '[data-table-layout="mobile"]')).not.toContain(look);
    }
    expect(classesOf(root, '[data-table-toolbar]')).not.toContain('md:shrink-0');
  });

  it('the oracle above is the config’s own switch', () => {
    // Ties the literals in this file to `LAYOUT_SWITCH_CLASSES`: a step renamed
    // in the config fails here instead of leaving these tests asserting a class
    // the table no longer emits.
    for (const cls of [QUERY_CONTAINER, ...Object.values(HALVES).flatMap(Object.values)]) {
      expect(LAYOUT_SWITCH_CLASSES).toContain(cls);
    }
  });
});
