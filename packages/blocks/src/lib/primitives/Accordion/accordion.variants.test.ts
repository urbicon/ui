import { describe, expect, it } from 'vitest';
import { accordionVariants } from './accordion.variants';

describe('accordionVariants', () => {
  it('provides all required slot functions', () => {
    const styles = accordionVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.item).toBe('function');
    expect(typeof styles.trigger).toBe('function');
    expect(typeof styles.chevron).toBe('function');
    expect(typeof styles.content).toBe('function');
    expect(typeof styles.contentInner).toBe('function');
  });

  it('uses design tokens for transitions', () => {
    const styles = accordionVariants();
    expect(styles.trigger()).toContain('duration-[var(--blocks-duration-fast)]');
    // ACC-3: chevron + content animate on the collapse tokens so `transitionDuration` /
    // `transitionEasing` can retune them, with a motion-reduce guard for the inline-override path.
    expect(styles.chevron()).toContain('duration-[var(--blocks-collapse-duration)]');
    expect(styles.chevron()).toContain('ease-[var(--blocks-collapse-easing)]');
    expect(styles.content()).toContain('duration-[var(--blocks-collapse-duration)]');
    expect(styles.content()).toContain('ease-[var(--blocks-collapse-easing)]');
    expect(styles.content()).toContain('motion-reduce:duration-[1ms]');
    expect(styles.chevron()).toContain('motion-reduce:duration-[1ms]');
  });

  it('uses focus-visible for keyboard focus', () => {
    const styles = accordionVariants();
    expect(styles.trigger()).toContain('focus-visible:');
    expect(styles.trigger()).toContain('ring-primary/50');
  });

  it('applies card variant classes (no per-item border)', () => {
    const styles = accordionVariants({ variant: 'card' });
    expect(styles.item()).toContain('rounded-contain');
    expect(styles.item()).toContain('bg-surface-quiet');
    expect(styles.base()).toContain('divide-y-0');
    expect(styles.base()).toContain('space-y-2');
  });

  it('applies ghost variant classes', () => {
    const styles = accordionVariants({ variant: 'ghost' });
    expect(styles.trigger()).toContain('hover:bg-surface-hover');
  });

  it('applies size classes', () => {
    const sm = accordionVariants({ size: 'sm' });
    expect(sm.trigger()).toContain('text-sm');
    expect(sm.chevron()).toContain('w-4');

    const lg = accordionVariants({ size: 'lg' });
    expect(lg.trigger()).toContain('text-lg');
  });

  it('never outputs dark: overrides', () => {
    const variants = ['default', 'card', 'ghost'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const variant of variants) {
      for (const size of sizes) {
        const styles = accordionVariants({ variant, size });
        expect(styles.base()).not.toMatch(/\bdark:/);
        expect(styles.trigger()).not.toMatch(/\bdark:/);
        expect(styles.item()).not.toMatch(/\bdark:/);
        expect(styles.contentInner()).not.toMatch(/\bdark:/);
      }
    }
  });
});
