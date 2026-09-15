import { describe, expect, it } from 'vitest';
import { emptyStateVariants } from './emptyState.variants';

const SLOTS = ['base', 'iconWrapper', 'title', 'description', 'children', 'cta'] as const;

describe('emptyStateVariants', () => {
  it('provides all slot functions', () => {
    const styles = emptyStateVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('scales padding + icon circle + title with density', () => {
    const compact = emptyStateVariants({ density: 'compact' });
    expect(compact.base()).toContain('py-8');
    expect(compact.iconWrapper()).toContain('h-12');
    expect(compact.title()).toContain('text-base');

    const def = emptyStateVariants({ density: 'default' });
    expect(def.base()).toContain('py-16');
    expect(def.iconWrapper()).toContain('h-16');
    expect(def.title()).toContain('text-lg');
  });

  it('keeps the icon circle off the accent and the text hierarchy semantic', () => {
    // An empty state is not a call to action — the CTA below it is. The disc
    // therefore rests on the neutral pair; a product that wants the accent
    // there opts in through slotClasses.iconWrapper or provider defaults.
    const styles = emptyStateVariants();
    expect(styles.iconWrapper()).toContain('bg-surface-subtle');
    expect(styles.iconWrapper()).toContain('text-text-tertiary');
    expect(styles.iconWrapper()).not.toContain('bg-primary-subtle');
    expect(styles.iconWrapper()).not.toContain('text-primary-text');
    expect(styles.iconWrapper()).toContain('rounded-commit');
    expect(styles.title()).toContain('text-text-primary');
    expect(styles.description()).toContain('text-text-secondary');
  });

  it('never emits dark: overrides', () => {
    const styles = emptyStateVariants();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
