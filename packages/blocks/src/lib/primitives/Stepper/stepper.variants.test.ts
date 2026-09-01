import { describe, expect, it } from 'vitest';
import { stepperVariants } from './stepper.variants';

describe('stepperVariants', () => {
  it('provides all required slot functions', () => {
    const styles = stepperVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.step).toBe('function');
    expect(typeof styles.indicator).toBe('function');
    expect(typeof styles.separator).toBe('function');
  });

  it('keeps the indicator on surface tokens (no surface-raised leftover)', () => {
    // surface-raised is intentionally absent from the token vocabulary; the
    // default-variant indicator sits on surface-subtle.
    const indicator = stepperVariants({ variant: 'default' }).indicator();
    expect(indicator).toContain('bg-surface-subtle');
    expect(indicator).not.toContain('bg-surface-raised');
  });

  it('uses transparent surface for outlined variant', () => {
    const indicator = stepperVariants({ variant: 'outlined' }).indicator();
    expect(indicator).toContain('bg-transparent');
  });

  describe('tier', () => {
    it('defaults to commit (circular indicator + pill separator)', () => {
      const styles = stepperVariants({});
      expect(styles.indicator()).toContain('rounded-commit');
      expect(styles.separator()).toContain('rounded-commit');
    });

    it('switches to modify on tier=modify (soft-rectangle indicator)', () => {
      const styles = stepperVariants({ tier: 'modify' });
      expect(styles.indicator()).toContain('rounded-modify');
      expect(styles.separator()).toContain('rounded-modify');
      expect(styles.indicator()).not.toContain('rounded-commit');
      expect(styles.separator()).not.toContain('rounded-commit');
    });
  });

  it('never outputs dark: overrides', () => {
    const variants = ['default', 'outlined', 'minimal'] as const;
    const stepStates = ['inactive', 'active', 'complete', 'error', 'warning'] as const;
    for (const variant of variants) {
      for (const state of stepStates) {
        const styles = stepperVariants({ variant, state });
        expect(styles.indicator()).not.toMatch(/\bdark:/);
        expect(styles.separator()).not.toMatch(/\bdark:/);
        expect(styles.label()).not.toMatch(/\bdark:/);
      }
    }
  });
});
