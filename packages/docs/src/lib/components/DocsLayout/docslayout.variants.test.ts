import { describe, expect, it } from 'vitest';
import { sectionVariants } from '../Section/section.variants';
import { tableOfContentsVariants } from '../TableOfContents/tableofcontents.variants';
import { docsLayoutVariants } from './docslayout.variants';

describe('docsLayoutVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = docsLayoutVariants({});
    const expectedSlots = [
      'container',
      'wrapper',
      'main',
      'content',
      'header',
      'headerInner',
      'title',
      'subtitle',
      'stickyBar',
      'stickyBarHeight',
      'stickyBarInner',
      'stickyToc',
      'stickyTocButton',
      'stickyTocNav',
      'stickyTocLink'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }

    // Both directions: a one-sided check lets a slot that no longer appears in
    // the markup linger in the config forever (this file listed a dead
    // `expandedRow` for exactly that reason). Every slot the config exposes
    // must be an intentional, listed one.
    expect(Object.keys(styles).sort()).toEqual([...expectedSlots].sort());
  });

  it('uses semantic design tokens in base classes', () => {
    const styles = docsLayoutVariants({});

    expect(styles.container()).toContain('bg-surface-base');
    expect(styles.title()).toContain('text-text-primary');
    expect(styles.subtitle()).toContain('text-text-secondary');
  });

  it('never outputs dark: overrides', () => {
    const allClasses = [
      docsLayoutVariants({}).container(),
      docsLayoutVariants({}).header(),
      docsLayoutVariants({}).title(),
      docsLayoutVariants({}).subtitle(),
      docsLayoutVariants({}).stickyBar(),
      docsLayoutVariants({}).stickyTocButton()
    ].join(' ');

    expect(allClasses).not.toMatch(/\bdark:/);
  });

  it('sticky bar uses correct z-index and positioning tokens', () => {
    const styles = docsLayoutVariants({});
    const stickyBar = styles.stickyBar();

    expect(stickyBar).toContain('sticky');
    expect(stickyBar).toContain('z-(--z-sticky)');
    // Offset reads SidebarLayout's published pinned-chrome height instead of
    // hardcoding a copy of its mobile-header h-14.
    expect(stickyBar).toContain('top-[var(--sidebar-layout-header-h,0rem)]');
  });

  it('sticky bar is a full-width band (no negative-margin bleed)', () => {
    // Since the colour-field header rework the strip is a direct child of the
    // page container — full-width by construction, no -mx bleed needed.
    const styles = docsLayoutVariants({});
    expect(styles.stickyBar()).not.toContain('-mx-6');
  });

  it('stickyBarInner re-imposes the content column', () => {
    const styles = docsLayoutVariants({});
    expect(styles.stickyBarInner()).toContain('mx-auto');
    expect(styles.stickyBarInner()).toContain('px-6');
  });

  /**
   * These three cover the NAMES, not the behaviour: that three tv configs in
   * three directories agree on two custom properties, which nothing in the type
   * system relates and a rename breaks in silence.
   *
   * They cannot cover the middle of the chain — the strip's markup turning the
   * declared number into its rendered height. Drop that `min-h-` and all three
   * stay green while every heading lands under the strip again. `e2e/
   * docs-layout.spec.ts` ("Anchor jumps clear the pinned chrome") is what asks
   * the browser; keep the pair, and do not let this file grow assertions that
   * pretend to be it.
   */
  describe('anchor offset', () => {
    it('declares the strip height rather than letting it fall out of padding', () => {
      // The strip renders this as a real `h-`, so the number IS its height.
      // While it was `py-2.5` the height existed only as a rendered consequence
      // and every offset that needed it was a guess — five of them, all
      // different, all wrong by a different amount.
      expect(docsLayoutVariants({}).stickyBarHeight()).toContain('[--docs-sticky-bar-h:2.5rem]');
    });

    it('derives the offset from the pinned chrome instead of restating it', () => {
      const container = docsLayoutVariants({}).container();
      expect(container).toContain('--docs-anchor-offset');
      // Both halves of what is pinned: SidebarLayout's mobile header below lg,
      // this layout's own strip. Read, never copied.
      expect(container).toContain('var(--sidebar-layout-header-h,0rem)');
      expect(container).toContain('var(--docs-sticky-bar-h,0rem)');
    });

    it('is the same custom property every consumer reads', () => {
      // The coupling a rename would otherwise break in silence: three configs in
      // three directories have to name the same two properties, and nothing in
      // the type system relates them — Tailwind class strings are opaque text.
      // A page whose headings land under the strip looks like a styling slip,
      // not like a typo, which is why it stayed unnoticed through five copies.
      // The property NAME is the contract; each consumer picks its own fallback
      // for the case where no strip published one (Section: no offset at all,
      // the rail: the gap it used to hardcode). Asserting a fallback here would
      // freeze a design choice in a test about naming.
      expect(sectionVariants({}).root()).toContain('scroll-mt-[var(--docs-anchor-offset');
      expect(tableOfContentsVariants({}).aside()).toContain('var(--docs-sticky-bar-h');
    });
  });

  it('wrapper owns the top padding so body and TOC share one top edge', () => {
    const styles = docsLayoutVariants({});
    expect(styles.wrapper()).toContain('pt-8');
    expect(styles.main()).not.toContain('pt-8');
  });

  describe('maxWidth variants', () => {
    it.each([
      ['sm', 'max-w-2xl'],
      ['md', 'max-w-3xl'],
      ['lg', 'max-w-4xl'],
      ['xl', 'max-w-5xl'],
      ['2xl', 'max-w-6xl'],
      ['7xl', 'max-w-7xl']
    ] as const)('maxWidth "%s" applies %s to main', (size, expected) => {
      const styles = docsLayoutVariants({ maxWidth: size });
      expect(styles.main()).toContain(expected);
    });
  });

  describe('sidebar variant', () => {
    it('caps main at the exhibit column and moves its padding to the wrapper', () => {
      const styles = docsLayoutVariants({ sidebar: true });
      expect(styles.wrapper()).toContain('gap-(--docs-rail-gap)');
      expect(styles.main()).toContain('min-w-0');
      expect(styles.main()).toContain('max-w-(--docs-column)');
      // `main` used to be `max-w-none` and swallowed everything the TOC did not
      // take. Both halves matter: a cap without dropping `px-6` would double the
      // gutter, since `wrapper` now carries it for both columns.
      expect(styles.main()).not.toContain('max-w-none');
      expect(styles.main()).not.toContain('px-6');
    });

    it('gives wrapper, header and sticky bar the same cap and gutter', () => {
      // The alignment invariant: all three centre their border box in the same
      // parent, so an equal cap plus an equal gutter is what puts the h1, the
      // breadcrumb and the first paragraph on one left edge. Drift here is
      // invisible in a unit test of any single slot and obvious on the page.
      const styles = docsLayoutVariants({ sidebar: true });
      for (const slot of [styles.wrapper(), styles.headerInner(), styles.stickyBarInner()]) {
        expect(slot).toContain('max-w-(--docs-shell)');
        expect(slot).toContain('px-(--docs-gutter)');
      }
    });

    it('has no rail gap by default', () => {
      const styles = docsLayoutVariants({ sidebar: false });
      expect(styles.wrapper()).not.toContain('gap-(--docs-rail-gap)');
    });
  });

  it('has one pinned strip, not two implementations of one', () => {
    // `pageToolbar` + its four `mobileToc*` slots were the second one: a page
    // that passed no breadcrumbs got them instead of the strip, with an inline
    // mobile TOC in place of the strip's popover and no declared height, so
    // anchor jumps landed underneath it. Deleted 2026-08-11. Asserting their
    // absence is what stops a well-meaning restore — the slot roster above
    // catches an addition, this says why this particular one must not come
    // back.
    const styles = docsLayoutVariants({}) as Record<string, unknown>;
    for (const gone of [
      'pageToolbar',
      'mobileToc',
      'mobileTocButton',
      'mobileTocNav',
      'mobileTocLink'
    ]) {
      expect(styles[gone]).toBeUndefined();
    }
  });

  it('supports class merging via slotClasses', () => {
    const styles = docsLayoutVariants({});
    const customized = styles.container({ class: 'my-custom-class' });

    expect(customized).toContain('my-custom-class');
    expect(customized).toContain('bg-surface-base');
  });

  it('defaults to maxWidth lg', () => {
    const defaults = docsLayoutVariants({});
    const explicit = docsLayoutVariants({ maxWidth: 'lg' });
    expect(defaults.main()).toBe(explicit.main());
  });
});
