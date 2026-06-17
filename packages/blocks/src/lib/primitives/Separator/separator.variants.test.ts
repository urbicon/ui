import { describe, expect, it } from 'vitest';
import { separatorVariants } from './separator.variants';

describe('separatorVariants', () => {
  it('produces horizontal classes by default', () => {
    const cls = separatorVariants();
    expect(cls).toContain('h-px');
    expect(cls).toContain('w-full');
    expect(cls).toContain('bg-border-subtle');
  });

  it('produces vertical classes', () => {
    const cls = separatorVariants({ orientation: 'vertical' });
    expect(cls).toContain('w-px');
    expect(cls).toContain('h-full');
  });

  it('size controls horizontal thickness', () => {
    expect(separatorVariants({ size: 'sm' })).toContain('h-px');
    expect(separatorVariants({ size: 'md' })).toContain('h-px');
    expect(separatorVariants({ size: 'lg' })).toContain('h-0.5');
  });

  it('size controls vertical thickness', () => {
    expect(separatorVariants({ orientation: 'vertical', size: 'sm' })).toContain('w-px');
    expect(separatorVariants({ orientation: 'vertical', size: 'md' })).toContain('w-px');
    expect(separatorVariants({ orientation: 'vertical', size: 'lg' })).toContain('w-0.5');
  });

  it('never bakes in vertical/horizontal margins (SEP-1)', () => {
    // Spacing is the surrounding layout's responsibility (flex/grid gap,
    // `space-y-*`). Pre-v1.0 we ripped out built-in margins so consumers no
    // longer need `!my-0` overrides.
    const orientations = ['horizontal', 'vertical'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const orientation of orientations) {
      for (const size of sizes) {
        const cls = separatorVariants({ orientation, size });
        expect(cls).not.toMatch(/\bm[xy]?-\d/);
      }
    }
  });

  it('never outputs dark: overrides', () => {
    const orientations = ['horizontal', 'vertical'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const orientation of orientations) {
      for (const size of sizes) {
        expect(separatorVariants({ orientation, size })).not.toMatch(/\bdark:/);
      }
    }
  });
});
