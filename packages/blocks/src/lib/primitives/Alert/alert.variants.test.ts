import { describe, expect, it } from 'vitest';
import { alertVariants } from './alert.variants';

describe('alertVariants', () => {
  it('produces base classes with design tokens', () => {
    const styles = alertVariants({ intent: 'primary', variant: 'soft' });
    const base = styles.base();
    expect(base).toContain('rounded-contain');
    expect(base).toContain('duration-[var(--blocks-duration-fast)]');
  });

  it('applies correct soft intent classes', () => {
    const primary = alertVariants({ intent: 'primary', variant: 'soft' });
    expect(primary.base()).toContain('bg-primary-subtle');
    expect(primary.base()).toContain('text-primary-emphasis');

    const danger = alertVariants({ intent: 'danger', variant: 'soft' });
    expect(danger.base()).toContain('bg-danger-subtle');
    expect(danger.base()).toContain('text-danger-emphasis');
  });

  it('applies correct filled intent classes', () => {
    const success = alertVariants({ intent: 'success', variant: 'filled' });
    expect(success.base()).toContain('bg-success');
    // Non-primary solid fills pair with the shared `--color-text-on-fill`; only
    // primary keeps `text-on-primary`, so a primary retheme cannot repaint this.
    expect(success.base()).toContain('text-text-on-fill');
    const primary = alertVariants({ intent: 'primary', variant: 'filled' });
    expect(primary.base()).toContain('text-text-on-primary');
  });

  it('applies correct inline intent classes (left accent border)', () => {
    const warning = alertVariants({ intent: 'warning', variant: 'inline' });
    expect(warning.base()).toContain('border-l-warning');
    expect(warning.base()).toContain('border-l-2');
  });

  it('provides all required slot functions', () => {
    const styles = alertVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.icon).toBe('function');
    expect(typeof styles.content).toBe('function');
    expect(typeof styles.title).toBe('function');
    expect(typeof styles.description).toBe('function');
    expect(typeof styles.actions).toBe('function');
    expect(typeof styles.dismissButton).toBe('function');
  });

  it('applies size classes', () => {
    const sm = alertVariants({ size: 'sm' });
    expect(sm.base()).toContain('p-3');
    expect(sm.icon()).toContain('w-4');

    const lg = alertVariants({ size: 'lg' });
    expect(lg.base()).toContain('p-5');
    expect(lg.icon()).toContain('w-6');
  });

  it('applies info intent with semantic info tokens distinct from primary', () => {
    const soft = alertVariants({ intent: 'info', variant: 'soft' });
    expect(soft.base()).toContain('bg-info-subtle');
    expect(soft.base()).toContain('text-info-emphasis');

    const filled = alertVariants({ intent: 'info', variant: 'filled' });
    expect(filled.base()).toContain('bg-info');

    const inline = alertVariants({ intent: 'info', variant: 'inline' });
    expect(inline.base()).toContain('border-l-info');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'] as const;
    const variants = ['filled', 'soft', 'inline'] as const;
    for (const intent of intents) {
      for (const variant of variants) {
        const styles = alertVariants({ intent, variant });
        expect(styles.base()).not.toMatch(/\bdark:/);
        expect(styles.icon()).not.toMatch(/\bdark:/);
      }
    }
  });
});
