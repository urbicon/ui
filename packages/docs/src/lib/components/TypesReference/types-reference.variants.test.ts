import { describe, expect, it } from 'vitest';
import { apiReferenceVariants } from '../ApiReference/apireference.variants';
import { typesReferenceVariants } from './types-reference.variants';

describe('typesReferenceVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = typesReferenceVariants({ size: 'md' });
    const expectedSlots = [
      // No `root`/`header`/`title`/`description`: the section, its heading and
      // its description are `<Section>`'s now. What is listed here is what this
      // component still draws itself.
      'stack',
      'expandedPanel',
      'toolbar',
      'filterLabel',
      'codeBlock',
      'documentation',
      'documentationClamped',
      'placeholder',
      'literalValues',
      'literalBadge',
      'moreValues',
      'usedBySection',
      'usedByLink',
      'seeAlsoSection',
      'seeAlsoRef',
      'seeAlsoLink',
      'emptyText',
      'highlightRing'
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
    const styles = typesReferenceVariants({ size: 'md' });

    expect(styles.toolbar()).toContain('text-text-tertiary');
    expect(styles.filterLabel()).toContain('text-text-tertiary');
    expect(styles.codeBlock()).toContain('bg-surface-quiet');
    expect(styles.codeBlock()).toContain('text-text-primary');
    expect(styles.literalBadge()).toContain('bg-surface-quiet');
    expect(styles.literalBadge()).toContain('text-text-secondary');
    expect(styles.usedBySection()).toContain('text-text-secondary');
    expect(styles.usedByLink()).toContain('text-primary');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    for (const size of sizes) {
      const styles = typesReferenceVariants({ size });
      const allClasses = [
        styles.stack(),
        styles.codeBlock(),
        styles.literalBadge(),
        styles.usedBySection(),
        styles.usedByLink(),
        styles.toolbar(),
        styles.filterLabel()
      ].join(' ');

      expect(allClasses).not.toMatch(/\bdark:/);
    }
  });

  it('highlight ring uses primary token', () => {
    const styles = typesReferenceVariants({ size: 'md' });
    expect(styles.highlightRing()).toContain('ring-primary/50');
  });

  describe('size variants', () => {
    it('sm has compact layout', () => {
      const styles = typesReferenceVariants({ size: 'sm' });

      expect(styles.codeBlock()).toContain('p-2');
      expect(styles.codeBlock()).toContain('text-xs');
      expect(styles.literalBadge()).toContain('text-3xs');
    });

    it('md has default layout', () => {
      const styles = typesReferenceVariants({ size: 'md' });

      expect(styles.codeBlock()).toContain('p-3');
      expect(styles.codeBlock()).toContain('text-[13px]');
      expect(styles.literalBadge()).toContain('text-2xs');
    });

    it('lg has spacious layout', () => {
      const styles = typesReferenceVariants({ size: 'lg' });

      expect(styles.codeBlock()).toContain('p-4');
      expect(styles.codeBlock()).toContain('text-sm');
      expect(styles.literalBadge()).toContain('text-xs');
    });

    it('reaches neither the heading nor the toolbar', () => {
      // `size` is the density of the expanded panel only. The heading belongs
      // to `<Section intent="secondary">` — pinned, so the types section reads
      // as a sibling of the API section above it — and the toolbar is pinned to
      // ApiReference's `stats` line, which has no size axis at all. The toolbar
      // used to carry `p-2`/`p-3`/`p-4`, which only made sense inside a card.
      const sm = typesReferenceVariants({ size: 'sm' });
      const lg = typesReferenceVariants({ size: 'lg' });

      expect(sm.toolbar()).toBe(lg.toolbar());
      expect(sm.toolbar()).not.toMatch(/\bp-\d/);
      expect(sm.stack()).toBe(lg.stack());
      // The slots the heading used to live in are gone, not merely unstyled.
      expect(Object.keys(sm)).not.toContain('title');
      expect(Object.keys(sm)).not.toContain('header');
    });

    it('produces distinct classes across all sizes', () => {
      const sm = typesReferenceVariants({ size: 'sm' });
      const md = typesReferenceVariants({ size: 'md' });
      const lg = typesReferenceVariants({ size: 'lg' });

      expect(sm.codeBlock()).not.toBe(md.codeBlock());
      expect(md.codeBlock()).not.toBe(lg.codeBlock());
      expect(sm.literalBadge()).not.toBe(md.literalBadge());
      expect(md.literalBadge()).not.toBe(lg.literalBadge());
    });
  });

  it('defaults to size md', () => {
    const withDefault = typesReferenceVariants({});
    const withExplicit = typesReferenceVariants({ size: 'md' });

    expect(withDefault.codeBlock()).toBe(withExplicit.codeBlock());
    expect(withDefault.literalBadge()).toBe(withExplicit.literalBadge());
  });

  it('reads as flat and frameless, like ApiReference', () => {
    // The section used to wrap its table in `<Card variant="elevated">`, which
    // put a border, a shadow and its own padding around the lower of two
    // reference tables that sit under each other on every component page. The
    // pair is the contract: same line above the table, same gap below it.
    const styles = typesReferenceVariants({ size: 'md' });
    const api = apiReferenceVariants();

    const textToken = (cls: string) =>
      cls
        .split(/\s+/)
        .filter((c) => c.startsWith('text-'))
        .sort();

    expect(textToken(styles.toolbar())).toEqual(textToken(api.stats()));
    expect(styles.stack()).toContain('gap-3');
    expect(api.base()).toContain('gap-3');
    expect(styles.stack()).not.toMatch(/\b(border|shadow|rounded-contain|bg-surface-elevated)/);
  });

  it('clamps its description column exactly like ApiReference', () => {
    // Without the clamp this column takes the full one-line length of the
    // longest documentation string: measured on /table/table, 7472px of column
    // in a 960px reading area, i.e. the table scrolled sideways for thousands
    // of pixels. The clamp is one half of the fix (`width` on the column is the
    // other); this is the half a test can hold.
    const styles = typesReferenceVariants({ size: 'md' });
    const api = apiReferenceVariants();

    expect(styles.documentationClamped()).toBe(api.descriptionClamped());
    // The unclamped slot styles the SAME text in the expanded row — folded
    // together, opening a row would show the two lines it already showed.
    expect(styles.documentation()).not.toContain('line-clamp');
  });

  it('supports slotClasses via class merging', () => {
    const styles = typesReferenceVariants({ size: 'md' });
    const customized = styles.codeBlock({ class: 'my-custom-class' });

    expect(customized).toContain('my-custom-class');
    expect(customized).toContain('bg-surface-quiet');
  });
});
