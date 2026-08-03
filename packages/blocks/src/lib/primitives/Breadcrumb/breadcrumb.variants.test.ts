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

  it('scales the icon gap with the trail', () => {
    // The glyph's own size scales in the component (GLYPH_SIZE), so a fixed
    // margin here would read wrong at the ends of the range.
    expect(breadcrumbVariants({ size: 'sm' }).icon()).toContain('mr-1');
    expect(breadcrumbVariants({ size: 'md' }).icon()).toContain('mr-1.5');
    expect(breadcrumbVariants({ size: 'lg' }).icon()).toContain('mr-2');
  });

  it('carries no box size on the icon wrapper — the glyph sizes itself', () => {
    // An <svg> with a viewBox and no width/height has a ratio but no intrinsic
    // size, so sizing it off this wrapper breaks the moment `unstyled` empties
    // the slot: the percentage resolves against the crumb link instead
    // (measured 338×338 for what should be a 16px glyph). The wrapper is
    // layout-only; Breadcrumb.svelte gives the glyph an absolute size.
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(breadcrumbVariants({ size }).icon()).not.toMatch(/(?:^|\s)(?:size|h|w)-\d/);
    }
  });

  it('never turns link/currentPage into flex containers (truncation would die)', () => {
    // The icon sits INSIDE `link` / `currentPage`, both of which carry
    // `truncate`. Making either a flex container strips the ellipsis —
    // `text-overflow` never reaches the anonymous flex item a bare text child
    // becomes. This asserts the ABSENCE of flex, not just the presence of the
    // inline alignment: `link: ['flex items-center', …, 'truncate']` is exactly
    // the refactor that must fail here, and a presence-only check stays green
    // through it.
    const FLEX_DISPLAY = /(?:^|\s)(?:inline-)?flex(?:\s|$)/;
    for (const size of ['sm', 'md', 'lg'] as const) {
      for (const wrap of [true, false]) {
        const styles = breadcrumbVariants({ size, wrap });
        expect(styles.link()).not.toMatch(FLEX_DISPLAY);
        expect(styles.currentPage()).not.toMatch(FLEX_DISPLAY);
        expect(styles.link()).toContain('truncate');
        expect(styles.currentPage()).toContain('truncate');
        // …which is only safe because the icon aligns inline instead.
        expect(styles.icon()).toContain('align-middle');
      }
    }
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
