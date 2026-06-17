import { describe, expect, it } from 'vitest';
import { breadcrumbVariants } from './breadcrumb.variants';

describe('breadcrumbVariants', () => {
  it('provides all required slot functions', () => {
    const styles = breadcrumbVariants();
    expect(typeof styles.nav).toBe('function');
    expect(typeof styles.list).toBe('function');
    expect(typeof styles.item).toBe('function');
    expect(typeof styles.link).toBe('function');
    expect(typeof styles.currentPage).toBe('function');
    expect(typeof styles.separator).toBe('function');
  });

  it('uses design tokens for transitions', () => {
    const styles = breadcrumbVariants();
    expect(styles.link()).toContain('duration-[var(--blocks-duration-fast)]');
  });

  it('uses focus-visible for keyboard focus', () => {
    const styles = breadcrumbVariants();
    expect(styles.link()).toContain('focus-visible:');
    expect(styles.link()).toContain('ring-primary/50');
  });

  it('applies correct size classes', () => {
    const sm = breadcrumbVariants({ size: 'sm' });
    expect(sm.list()).toContain('text-xs');

    const lg = breadcrumbVariants({ size: 'lg' });
    expect(lg.list()).toContain('text-base');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const styles = breadcrumbVariants({ size });
      expect(styles.nav()).not.toMatch(/\bdark:/);
      expect(styles.link()).not.toMatch(/\bdark:/);
      expect(styles.currentPage()).not.toMatch(/\bdark:/);
      expect(styles.separator()).not.toMatch(/\bdark:/);
    }
  });
});
