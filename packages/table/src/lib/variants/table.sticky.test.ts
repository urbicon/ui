import { describe, expect, it } from 'vitest';
import { resolveStickyMode } from '../core/sticky-context.svelte';
import { tableContainerVariants, tableHeaderVariants } from './table.variants';
import { groupHeaderVariants } from './table-features.variants';

describe('resolveStickyMode', () => {
  it('disables all layers by default', () => {
    expect(resolveStickyMode(false)).toEqual({ toolbar: false, header: false });
    expect(resolveStickyMode(undefined)).toEqual({ toolbar: false, header: false });
  });

  it('enables all layers for true / "both"', () => {
    expect(resolveStickyMode(true)).toEqual({ toolbar: true, header: true });
    expect(resolveStickyMode('both')).toEqual({ toolbar: true, header: true });
  });

  it('enables only the toolbar for "toolbar"', () => {
    expect(resolveStickyMode('toolbar')).toEqual({ toolbar: true, header: false });
  });

  it('enables the header layer — thead and group header — for "header"', () => {
    expect(resolveStickyMode('header')).toEqual({ toolbar: false, header: true });
  });

  it('contained (fit="viewport") forces header pinning and drops the toolbar', () => {
    expect(resolveStickyMode(false, true)).toEqual({
      toolbar: false,
      header: true
    });
  });

  it('contained supersedes the sticky prop entirely', () => {
    // even "toolbar"/"both" collapse to the box-relative header pin
    expect(resolveStickyMode('toolbar', true)).toEqual({
      toolbar: false,
      header: true
    });
    expect(resolveStickyMode('both', true)).toEqual({
      toolbar: false,
      header: true
    });
  });
});

describe('tableContainerVariants — sticky toolbar', () => {
  it('pins the toolbar to var(--blocks-table-sticky-top)', () => {
    const stuck = tableContainerVariants({ stickyToolbar: true }).toolbar();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(/top-\[var\(--blocks-table-sticky-top/);
    expect(stuck).toMatch(/z-30\b/);
  });

  it('reserves data-[stuck=true]:shadow-... for the IntersectionObserver feedback', () => {
    const stuck = tableContainerVariants({ stickyToolbar: true }).toolbar();
    expect(stuck).toMatch(/data-\[stuck=true\]:shadow-/);
  });
});

/**
 * The slots `contained: true` writes to, read off the live config. A rename or
 * a restructure of the variant throws here rather than silently yielding an
 * empty list that would make the prefix guard below vacuously green.
 */
function containedSlots(): (keyof ReturnType<typeof tableContainerVariants>)[] {
  const map = tableContainerVariants.config.variants?.contained?.true;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('tableContainerVariants.config.variants.contained.true is not a slot map');
  }
  return Object.keys(map) as (keyof ReturnType<typeof tableContainerVariants>)[];
}

describe('tableContainerVariants — contained (fit="viewport")', () => {
  // `fit="viewport"` is the consumer asserting that this table owns the page
  // height, not a measurement the library makes — so every class below applies
  // at every width. Until #269 they were `md:`-prefixed, which withheld the
  // horizontal containment the prop exists for from the narrow viewports that
  // need it most. The assertions match on a class boundary rather than a bare
  // substring, because /shrink-0/ matches `md:shrink-0` too and would have
  // stayed green through the defect; the prefix guard further down is the
  // second half of that.
  it('caps the container to the viewport minus the measured top offset', () => {
    const container = tableContainerVariants({ contained: true }).container();
    expect(container).toMatch(/(?:^|\s)max-h-\[calc\(100dvh-var\(--blocks-table-avail-top/);
  });

  it('makes the scrollArea the flex scroll child (flex-auto + min-h-0 + overflow)', () => {
    const scrollArea = tableContainerVariants({ contained: true }).scrollArea();
    expect(scrollArea).toMatch(/(?:^|\s)flex-auto\b/);
    expect(scrollArea).toMatch(/(?:^|\s)min-h-0\b/);
    expect(scrollArea).toMatch(/(?:^|\s)overflow-auto\b/);
    // must NOT use basis-0 `flex-1`, which collapses the box for short tables
    // in an auto-height (max-height-capped) flex container
    expect(scrollArea).not.toMatch(/\bflex-1\b/);
  });

  it('keeps the toolbar fixed outside the scroll area (shrink-0)', () => {
    const toolbar = tableContainerVariants({ contained: true }).toolbar();
    expect(toolbar).toMatch(/(?:^|\s)shrink-0\b/);
  });

  // The live-update banner and the pager wrapper are the other two flex
  // siblings that must not shrink. They read this slot instead of writing
  // `shrink-0` into `Table.svelte` so the three wrappers cannot drift apart —
  // the scan argument that used to stand here is gone with the `@source '..'`
  // in `style/index.css`, which reaches markup and variants alike.
  it('hands the banner + pager wrappers the same shrink-0 through a slot', () => {
    const chrome = tableContainerVariants({ contained: true }).containedChrome();
    expect(chrome).toMatch(/(?:^|\s)shrink-0\b/);
    expect(tableContainerVariants({ contained: false }).containedChrome()).toBe('');
  });

  // The guard on the decision above: whatever `contained` adds must be
  // unconditional. A variant prefix (`md:`, `@3xl:`, `dark:`) reintroduces a
  // width/mode term into a path whose whole point is that it has none.
  //
  // The slot list is read out of the config, not written down beside it: a
  // hand-kept copy waves through a width term on any slot it does not name.
  // Measured with `contained.true.table = ['md:table-fixed']`, which the
  // four-name literal this replaced passed with every assertion green.
  it('adds only unconditional classes — no variant prefix on any contained slot', () => {
    const on = tableContainerVariants({ contained: true });
    const off = tableContainerVariants({ contained: false });
    const slots = containedSlots();

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const before = new Set(off[slot]().split(' '));
      const added = on[slot]()
        .split(' ')
        .filter((cls) => cls && !before.has(cls));

      expect(added.length).toBeGreaterThan(0);
      expect(added.filter((cls) => cls.includes(':'))).toEqual([]);
    }
  });

  it('uses dvh (not vh) so the mobile URL bar does not clip the box', () => {
    const container = tableContainerVariants({ contained: true }).container();
    expect(container).toMatch(/100dvh/);
    expect(container).not.toMatch(/100vh\b/);
  });

  it('adds nothing when contained=false — the default (non-contained) mode is unchanged', () => {
    const container = tableContainerVariants({ contained: false }).container();
    const scrollArea = tableContainerVariants({ contained: false }).scrollArea();
    expect(container).not.toMatch(/max-h-\[calc\(100dvh/);
    expect(scrollArea).not.toMatch(/flex-auto/);
    expect(scrollArea).not.toMatch(/overflow-auto/);
  });
});

describe('tableHeaderVariants — sticky thead', () => {
  it('pins the thead below toolbar (sticky-top + toolbar-h)', () => {
    const stuck = tableHeaderVariants({ sticky: true }).header();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(/calc\(var\(--blocks-table-sticky-top.+var\(--blocks-table-toolbar-h/);
    expect(stuck).toMatch(/z-20\b/);
  });

  it('does NOT add sticky classes when sticky=false', () => {
    const free = tableHeaderVariants({ sticky: false }).header();
    expect(free).not.toMatch(/\bsticky\b/);
  });
});

describe('groupHeaderVariants — sticky group header (L3)', () => {
  it('pins the group header below toolbar + thead', () => {
    const stuck = groupHeaderVariants({ sticky: true }).row();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(
      /calc\(var\(--blocks-table-sticky-top.+var\(--blocks-table-toolbar-h.+var\(--blocks-table-thead-h/
    );
    expect(stuck).toMatch(/z-10\b/);
  });

  it('falls back to non-sticky behavior when sticky=false', () => {
    const free = groupHeaderVariants({ sticky: false }).row();
    expect(free).not.toMatch(/\bsticky\b/);
  });
});
