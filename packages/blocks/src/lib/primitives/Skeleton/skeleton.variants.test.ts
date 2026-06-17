import { describe, expect, it } from 'vitest';
import { skeletonVariants } from './skeleton.variants';

describe('skeletonVariants', () => {
  it('produces base pulse animation by default', () => {
    const cls = skeletonVariants().base();
    expect(cls).toContain('animate-pulse');
    expect(cls).toContain('bg-surface-interactive');
  });

  it('applies variant-specific shapes', () => {
    // `text` and `rectangular` track the semantic tier tokens so a
    // brand-tuned `--radius-modify`/`--radius-contain` cascades through.
    // `circular` and `rounded` remain explicit shape statements.
    expect(skeletonVariants({ variant: 'circular' }).base()).toContain('rounded-full');
    expect(skeletonVariants({ variant: 'rectangular' }).base()).toContain('rounded-contain');
    expect(skeletonVariants({ variant: 'text' }).base()).toContain('rounded-modify');
    expect(skeletonVariants({ variant: 'rounded' }).base()).toContain('rounded-xl');
  });

  it('applies correct size dimensions for text variant', () => {
    expect(skeletonVariants({ variant: 'text', size: 'xs' }).base()).toContain('h-3');
    expect(skeletonVariants({ variant: 'text', size: 'md' }).base()).toContain('h-4');
    expect(skeletonVariants({ variant: 'text', size: 'xl' }).base()).toContain('h-6');
  });

  it('applies correct size dimensions for circular variant', () => {
    expect(skeletonVariants({ variant: 'circular', size: 'sm' }).base()).toContain('w-8');
    expect(skeletonVariants({ variant: 'circular', size: 'lg' }).base()).toContain('w-12');
  });

  it('applies correct size dimensions for rounded variant', () => {
    expect(skeletonVariants({ variant: 'rounded', size: 'xs' }).base()).toContain('h-16');
    expect(skeletonVariants({ variant: 'rounded', size: 'xl' }).base()).toContain('h-64');
  });

  it('supports wave animation variant', () => {
    const cls = skeletonVariants({ animation: 'wave' }).base();
    expect(cls).toContain('blocks-shimmer');
    expect(cls).toContain('bg-linear-to-r');
  });

  it('supports none animation', () => {
    const cls = skeletonVariants({ animation: 'none' }).base();
    expect(cls).not.toContain('animate-pulse');
    expect(cls).not.toContain('blocks-shimmer');
  });

  it('provides wrapper slot classes', () => {
    const cls = skeletonVariants().wrapper();
    expect(cls).toContain('flex');
    expect(cls).toContain('flex-col');
  });

  it('never outputs dark: overrides', () => {
    const variants = ['text', 'circular', 'rectangular', 'rounded'] as const;
    for (const variant of variants) {
      expect(skeletonVariants({ variant }).base()).not.toMatch(/\bdark:/);
    }
  });

  it('respects prefers-reduced-motion', () => {
    const pulse = skeletonVariants({ animation: 'pulse' }).base();
    expect(pulse).toContain('motion-reduce:');

    const wave = skeletonVariants({ animation: 'wave' }).base();
    expect(wave).toContain('motion-reduce:');
  });
});
