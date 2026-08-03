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
    expect(typeof styles.icon).toBe('function');
  });

  it('scales the per-item icon with the trail', () => {
    expect(breadcrumbVariants({ size: 'sm' }).icon()).toContain('size-3.5');
    expect(breadcrumbVariants({ size: 'md' }).icon()).toContain('size-4');
    expect(breadcrumbVariants({ size: 'lg' }).icon()).toContain('size-5');
  });

  it('keeps the icon an inline box so link/currentPage truncation survives', () => {
    // The icon sits INSIDE `link` / `currentPage`, both of which carry
    // `truncate`. Turning those into flex containers would strip the ellipsis
    // (text-overflow never reaches an anonymous flex item), so the icon has to
    // align inline instead.
    const icon = breadcrumbVariants().icon();
    expect(icon).toContain('align-middle');
    expect(icon).toContain('shrink-0');
    expect(breadcrumbVariants().link()).toContain('truncate');
    expect(breadcrumbVariants().currentPage()).toContain('truncate');
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

  it('wraps onto multiple lines by default', () => {
    const styles = breadcrumbVariants();
    expect(styles.list()).toContain('flex-wrap');
    expect(styles.list()).not.toContain('flex-nowrap');
  });

  it('stays single-line and truncates the current page when wrap is false', () => {
    const styles = breadcrumbVariants({ wrap: false });
    // single line, shrinkable container
    expect(styles.list()).toContain('flex-nowrap');
    expect(styles.list()).toContain('min-w-0');
    // ancestors hold their width, the last item (current page) gives way
    expect(styles.list()).toContain('[&>li:not(:last-child)]:shrink-0');
    expect(styles.list()).toContain('[&>li:last-child]:shrink');
    // the current page may use the full available width before truncating
    expect(styles.currentPage()).toContain('max-w-none');
    expect(styles.nav()).toContain('min-w-0');
  });
});
