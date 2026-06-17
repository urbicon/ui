import { describe, expect, it } from 'vitest';
import { themeSwitcherVariants } from './themeSwitcher.variants';

describe('themeSwitcherVariants', () => {
  it('provides all required slot functions', () => {
    const styles = themeSwitcherVariants();
    expect(typeof styles.button).toBe('function');
    expect(typeof styles.icon).toBe('function');
  });

  it('uses semantic design tokens', () => {
    const styles = themeSwitcherVariants();
    expect(styles.button()).toContain('text-text-tertiary');
    expect(styles.button()).toContain('hover:bg-surface-hover');
    expect(styles.button()).toContain('hover:text-text-primary');
  });

  it('uses focus-visible not focus', () => {
    const styles = themeSwitcherVariants();
    expect(styles.button()).toContain('focus-visible:');
    expect(styles.button()).not.toMatch(/\bfocus:/);
  });

  it('applies variant-specific styles', () => {
    const ghost = themeSwitcherVariants({ variant: 'ghost' }).button();
    expect(ghost).toContain('bg-transparent');

    const outlined = themeSwitcherVariants({ variant: 'outlined' }).button();
    expect(outlined).toContain('border');
    expect(outlined).toContain('border-border-subtle');

    const filled = themeSwitcherVariants({ variant: 'filled' }).button();
    expect(filled).toContain('bg-surface-subtle');
  });

  it('applies size-specific dimensions', () => {
    const sm = themeSwitcherVariants({ size: 'sm' });
    expect(sm.button()).toContain('h-7');
    expect(sm.button()).toContain('w-7');
    expect(sm.icon()).toContain('h-3.5');

    const md = themeSwitcherVariants({ size: 'md' });
    expect(md.button()).toContain('h-8');
    expect(md.button()).toContain('w-8');
    expect(md.icon()).toContain('h-4');

    const lg = themeSwitcherVariants({ size: 'lg' });
    expect(lg.button()).toContain('h-10');
    expect(lg.button()).toContain('w-10');
    expect(lg.icon()).toContain('h-5');
  });

  it('defaults to ghost variant and md size', () => {
    const defaultButton = themeSwitcherVariants({}).button();
    const explicitButton = themeSwitcherVariants({ variant: 'ghost', size: 'md' }).button();
    expect(defaultButton).toBe(explicitButton);
  });

  it('applies disabled state', () => {
    const styles = themeSwitcherVariants({ disabled: true });
    expect(styles.button()).toContain('pointer-events-none');
    expect(styles.button()).toContain('opacity-50');
  });

  it('never outputs dark: overrides', () => {
    const variants = ['ghost', 'outlined', 'filled'] as const;
    for (const variant of variants) {
      const styles = themeSwitcherVariants({ variant });
      expect(styles.button()).not.toMatch(/\bdark:/);
      expect(styles.icon()).not.toMatch(/\bdark:/);
    }
  });

  it('each size produces distinct dimensions', () => {
    const sm = themeSwitcherVariants({ size: 'sm' }).button();
    const md = themeSwitcherVariants({ size: 'md' }).button();
    const lg = themeSwitcherVariants({ size: 'lg' }).button();
    expect(sm).not.toBe(md);
    expect(md).not.toBe(lg);
  });
});
