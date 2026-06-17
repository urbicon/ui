import { describe, expect, it } from 'vitest';
import { tabVariants } from './tab.variants';

describe('tabVariants', () => {
  it('provides all required slot functions', () => {
    const styles = tabVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.list).toBe('function');
    expect(typeof styles.trigger).toBe('function');
    expect(typeof styles.panel).toBe('function');
    expect(typeof styles.indicator).toBe('function');
  });

  it('applies semantic tokens for the line variant', () => {
    const styles = tabVariants({ variant: 'line' });
    expect(styles.list()).toContain('border-border-subtle');
    expect(styles.trigger()).toContain('text-text-tertiary');
  });

  describe('tier', () => {
    it('defaults to modify for pills (soft-rectangle tap surfaces)', () => {
      const styles = tabVariants({ variant: 'pills' });
      expect(styles.list()).toContain('rounded-modify');
      expect(styles.trigger()).toContain('rounded-modify');
    });

    it('switches pills to full pill on tier=commit', () => {
      const styles = tabVariants({ variant: 'pills', tier: 'commit' });
      expect(styles.list()).toContain('rounded-commit');
      expect(styles.trigger()).toContain('rounded-commit');
    });

    it('switches solid to full pill on tier=commit', () => {
      const styles = tabVariants({ variant: 'solid', tier: 'commit' });
      expect(styles.list()).toContain('rounded-commit');
      expect(styles.trigger()).toContain('rounded-commit');
    });

    it('uses rounded-t-modify for enclosed horizontal modify (default)', () => {
      const styles = tabVariants({ variant: 'enclosed', orientation: 'horizontal' });
      expect(styles.trigger()).toContain('rounded-t-modify');
    });

    it('uses rounded-t-commit for enclosed horizontal commit', () => {
      const styles = tabVariants({
        variant: 'enclosed',
        orientation: 'horizontal',
        tier: 'commit'
      });
      expect(styles.trigger()).toContain('rounded-t-commit');
    });

    it('uses rounded-l-* for enclosed vertical, tier-aware, never leaks rounded-t-{tier}', () => {
      // Regression guard: pre-fix, the `tier × enclosed` compound emitted
      // `rounded-t-{tier}` for every orientation, leaving the trigger with
      // both `rounded-t-{tier}` and `rounded-t-none` (from the
      // `enclosed × vertical` compound). The horizontal-only restriction
      // on the tier×enclosed top-corner pair keeps the vertical output
      // clean.
      const modify = tabVariants({
        variant: 'enclosed',
        orientation: 'vertical',
        tier: 'modify'
      });
      expect(modify.trigger()).toContain('rounded-l-modify');
      expect(modify.trigger()).toContain('rounded-t-none');
      expect(modify.trigger()).not.toContain('rounded-t-modify');

      const commit = tabVariants({
        variant: 'enclosed',
        orientation: 'vertical',
        tier: 'commit'
      });
      expect(commit.trigger()).toContain('rounded-l-commit');
      expect(commit.trigger()).toContain('rounded-t-none');
      expect(commit.trigger()).not.toContain('rounded-t-commit');
    });

    it('focus-ring radius follows the tier (no geometry jump on focus)', () => {
      // Pre-fix, the trigger base carried a hard-coded
      // `focus-visible:rounded-modify`. A commit-tier (pill) trigger
      // would visibly snap to a soft-rectangle outline on keyboard focus.
      // Tier now binds the focus radius so it matches the body.
      const modify = tabVariants({ tier: 'modify' });
      expect(modify.trigger()).toContain('focus-visible:rounded-modify');
      expect(modify.trigger()).not.toContain('focus-visible:rounded-commit');

      const commit = tabVariants({ tier: 'commit' });
      expect(commit.trigger()).toContain('focus-visible:rounded-commit');
      expect(commit.trigger()).not.toContain('focus-visible:rounded-modify');
    });

    it('line variant is radius-agnostic on the body, still carries the tier-aware focus ring', () => {
      const styles = tabVariants({ variant: 'line', tier: 'commit' });
      // line has no body radius — neither list nor trigger picks up a
      // `rounded-*` from the variant, only the focus-ring class binds.
      expect(styles.trigger()).toContain('focus-visible:rounded-commit');
      expect(styles.list()).not.toMatch(/(?<!focus-visible:)rounded-(commit|modify)/);
    });
  });

  it('never outputs dark: overrides', () => {
    const variants = ['line', 'pills', 'enclosed', 'solid'] as const;
    const orientations = ['horizontal', 'vertical'] as const;
    for (const variant of variants) {
      for (const orientation of orientations) {
        const styles = tabVariants({ variant, orientation });
        expect(styles.list()).not.toMatch(/\bdark:/);
        expect(styles.trigger()).not.toMatch(/\bdark:/);
        expect(styles.indicator()).not.toMatch(/\bdark:/);
      }
    }
  });
});
