import { describe, expect, it } from 'vitest';
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
      'title',
      'subtitle',
      'stickyBar',
      'stickyBarInner',
      'pageToolbar',
      'mobileToc',
      'mobileTocButton',
      'mobileTocNav',
      'mobileTocLink'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }
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
      docsLayoutVariants({}).pageToolbar()
    ].join(' ');

    expect(allClasses).not.toMatch(/\bdark:/);
  });

  it('sticky bar uses correct z-index and positioning tokens', () => {
    const styles = docsLayoutVariants({});
    const stickyBar = styles.stickyBar();

    expect(stickyBar).toContain('sticky');
    expect(stickyBar).toContain('z-(--z-sticky)');
    expect(stickyBar).toContain('top-14');
    expect(stickyBar).toContain('lg:top-0');
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
    it('adds gap and min-width when sidebar is true', () => {
      const styles = docsLayoutVariants({ sidebar: true });
      expect(styles.wrapper()).toContain('gap-8');
      expect(styles.main()).toContain('min-w-0');
    });

    it('has no gap by default', () => {
      const styles = docsLayoutVariants({ sidebar: false });
      expect(styles.wrapper()).not.toContain('gap-8');
    });
  });

  describe('legacy toolbar (backward compat)', () => {
    it('preserves legacy pageToolbar slot', () => {
      const styles = docsLayoutVariants({});
      expect(styles.pageToolbar()).toContain('sticky');
      expect(styles.pageToolbar()).toContain('top-14');
      expect(styles.pageToolbar()).toContain('lg:top-0');
    });

    it('preserves mobile TOC slots', () => {
      const styles = docsLayoutVariants({});
      expect(typeof styles.mobileToc).toBe('function');
      expect(typeof styles.mobileTocButton).toBe('function');
      expect(typeof styles.mobileTocNav).toBe('function');
      expect(typeof styles.mobileTocLink).toBe('function');
    });
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
