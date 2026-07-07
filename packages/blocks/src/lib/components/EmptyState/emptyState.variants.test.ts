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

  it('uses semantic identity tokens for the icon circle + text hierarchy', () => {
    const styles = emptyStateVariants();
    expect(styles.iconWrapper()).toContain('bg-primary-subtle');
    expect(styles.iconWrapper()).toContain('text-primary');
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
