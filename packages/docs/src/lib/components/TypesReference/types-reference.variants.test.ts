import { describe, expect, it } from 'vitest';
import { typesReferenceVariants } from './types-reference.variants';

describe('typesReferenceVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = typesReferenceVariants({ size: 'md' });
    const expectedSlots = [
      'root',
      'header',
      'title',
      'description',
      'card',
      'toolbar',
      'toolbarText',
      'filterLabel',
      'expandedRow',
      'codeBlock',
      'documentation',
      'literalValues',
      'literalBadge',
      'usedBySection',
      'usedByLink',
      'highlightRing'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }
  });

  it('uses semantic design tokens in base classes', () => {
    const styles = typesReferenceVariants({ size: 'md' });

    expect(styles.title()).toContain('text-text-primary');
    expect(styles.description()).toContain('text-text-secondary');
    expect(styles.toolbarText()).toContain('text-text-secondary');
    expect(styles.filterLabel()).toContain('text-text-primary');
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
        styles.root(),
        styles.title(),
        styles.description(),
        styles.codeBlock(),
        styles.literalBadge(),
        styles.usedBySection(),
        styles.usedByLink(),
        styles.toolbar(),
        styles.toolbarText(),
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

      expect(styles.title()).toContain('text-lg');
      expect(styles.toolbar()).toContain('p-2');
      expect(styles.codeBlock()).toContain('p-2');
      expect(styles.codeBlock()).toContain('text-xs');
      expect(styles.literalBadge()).toContain('text-[10px]');
    });

    it('md has default layout', () => {
      const styles = typesReferenceVariants({ size: 'md' });

      expect(styles.title()).toContain('text-2xl');
      expect(styles.toolbar()).toContain('p-3');
      expect(styles.codeBlock()).toContain('p-3');
      expect(styles.codeBlock()).toContain('text-[13px]');
      expect(styles.literalBadge()).toContain('text-[11px]');
    });

    it('lg has spacious layout', () => {
      const styles = typesReferenceVariants({ size: 'lg' });

      expect(styles.title()).toContain('text-3xl');
      expect(styles.toolbar()).toContain('p-4');
      expect(styles.codeBlock()).toContain('p-4');
      expect(styles.codeBlock()).toContain('text-sm');
      expect(styles.literalBadge()).toContain('text-xs');
    });

    it('produces distinct classes across all sizes', () => {
      const sm = typesReferenceVariants({ size: 'sm' });
      const md = typesReferenceVariants({ size: 'md' });
      const lg = typesReferenceVariants({ size: 'lg' });

      expect(sm.title()).not.toBe(md.title());
      expect(md.title()).not.toBe(lg.title());
      expect(sm.codeBlock()).not.toBe(md.codeBlock());
      expect(md.codeBlock()).not.toBe(lg.codeBlock());
      expect(sm.literalBadge()).not.toBe(md.literalBadge());
    });
  });

  it('defaults to size md', () => {
    const withDefault = typesReferenceVariants({});
    const withExplicit = typesReferenceVariants({ size: 'md' });

    expect(withDefault.title()).toBe(withExplicit.title());
    expect(withDefault.toolbar()).toBe(withExplicit.toolbar());
    expect(withDefault.codeBlock()).toBe(withExplicit.codeBlock());
  });

  it('supports slotClasses via class merging', () => {
    const styles = typesReferenceVariants({ size: 'md' });
    const customized = styles.codeBlock({ class: 'my-custom-class' });

    expect(customized).toContain('my-custom-class');
    expect(customized).toContain('bg-surface-quiet');
  });
});
