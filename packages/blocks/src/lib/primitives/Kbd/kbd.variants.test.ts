import { describe, expect, it } from 'vitest';
import { kbdVariants } from './kbd.variants';

const SIZES = ['sm', 'md', 'lg'] as const;

describe('kbdVariants', () => {
  it('produces the keycap look on the base slot by default', () => {
    const base = kbdVariants().base();
    expect(base).toContain('font-mono');
    expect(base).toContain('border-border-subtle');
    expect(base).toContain('bg-surface-elevated');
    expect(base).toContain('text-text-secondary');
    // md default height
    expect(base).toContain('h-5');
  });

  it('size controls the cap dimensions and type scale', () => {
    expect(kbdVariants({ size: 'sm' }).base()).toContain('h-4');
    expect(kbdVariants({ size: 'sm' }).base()).toContain('text-3xs');
    expect(kbdVariants({ size: 'md' }).base()).toContain('h-5');
    expect(kbdVariants({ size: 'md' }).base()).toContain('text-2xs');
    expect(kbdVariants({ size: 'lg' }).base()).toContain('h-6');
    expect(kbdVariants({ size: 'lg' }).base()).toContain('text-xs');
  });

  it('mutes the separator relative to the keys', () => {
    expect(kbdVariants().separator()).toContain('text-text-tertiary');
  });

  it('never outputs dark: overrides', () => {
    for (const size of SIZES) {
      const styles = kbdVariants({ size });
      expect(styles.base()).not.toMatch(/\bdark:/);
      expect(styles.separator()).not.toMatch(/\bdark:/);
    }
  });
});
