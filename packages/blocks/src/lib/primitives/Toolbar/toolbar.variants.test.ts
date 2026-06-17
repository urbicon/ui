import { describe, expect, it } from 'vitest';
import { toolbarVariants } from './toolbar.variants';

describe('toolbarVariants', () => {
  it('provides the base slot function', () => {
    expect(typeof toolbarVariants().base).toBe('function');
  });

  it('always uses rounded-contain (structure tier — toolbars are containers)', () => {
    const variants = ['quiet', 'elevated', 'outlined', 'ghost'] as const;
    for (const variant of variants) {
      expect(toolbarVariants({ variant }).base()).toContain('rounded-contain');
    }
  });

  describe('variant contract (Lighter consolidation A.2)', () => {
    it('defaults to quiet (surface-quiet tint, no border, no shadow)', () => {
      const base = toolbarVariants({}).base();
      expect(base).toContain('bg-surface-quiet');
      expect(base).not.toContain('border-border');
      expect(base).not.toContain('shadow');
    });

    it('elevated keeps shadow but drops the border (Lighter chrome reduction)', () => {
      const base = toolbarVariants({ variant: 'elevated' }).base();
      expect(base).toContain('bg-surface-elevated');
      expect(base).toContain('shadow-[var(--blocks-shadow-md)]');
      // The pre-v5.5 elevated variant carried `border border-border-subtle`;
      // the consolidation removes the border so elevation is carried by
      // shadow alone (mirrors Card.elevated).
      expect(base).not.toContain('border-border-subtle');
      // No surface-raised regression
      expect(base).not.toContain('surface-raised');
    });

    it('outlined keeps a stronger border and a transparent surface', () => {
      const base = toolbarVariants({ variant: 'outlined' }).base();
      expect(base).toContain('border-border-default');
      expect(base).toContain('bg-transparent');
    });

    it('ghost has no chrome at all', () => {
      const base = toolbarVariants({ variant: 'ghost' }).base();
      expect(base).toContain('bg-transparent');
      expect(base).not.toContain('shadow');
      expect(base).not.toContain('border-border');
    });
  });

  it('never outputs dark: overrides or surface-raised', () => {
    const variants = ['quiet', 'elevated', 'outlined', 'ghost'] as const;
    for (const variant of variants) {
      const base = toolbarVariants({ variant }).base();
      expect(base).not.toMatch(/\bdark:/);
      expect(base).not.toContain('surface-raised');
    }
  });
});
