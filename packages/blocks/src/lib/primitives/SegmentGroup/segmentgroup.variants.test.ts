import { describe, expect, it } from 'vitest';
import { segmentGroupVariants } from './segmentgroup.variants';

describe('segmentGroupVariants', () => {
  it('provides all required slot functions', () => {
    const styles = segmentGroupVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.indicator).toBe('function');
    expect(typeof styles.item).toBe('function');
  });

  it('uses semantic tokens for the pill-track surface (default variant)', () => {
    const styles = segmentGroupVariants();
    expect(styles.base()).toContain('bg-surface-interactive');
    expect(styles.base()).toContain('rounded-commit');
    expect(styles.indicator()).toContain('bg-surface-base');
  });

  it('uses focus-visible (not focus) on items', () => {
    const item = segmentGroupVariants().item();
    expect(item).toContain('focus-visible:');
    expect(item).not.toMatch(/(?<![a-z-])focus:/);
  });

  it('applies size classes (default variant — pill-track)', () => {
    const sm = segmentGroupVariants({ size: 'sm' });
    expect(sm.item()).toContain('text-sm');
    expect(sm.base()).toContain('p-0.5');

    const lg = segmentGroupVariants({ size: 'lg' });
    expect(lg.item()).toContain('text-lg');
    expect(lg.base()).toContain('p-1.5');
  });

  it('marks active items via data-state (no font-weight transition — would cause reflow)', () => {
    const item = segmentGroupVariants().item();
    expect(item).toContain('data-[state=active]:text-text-primary');
    // Weight intentionally not transitioned — see segmentgroup.variants.ts comment.
    expect(item).not.toContain('font-semibold');
    expect(item).not.toContain('data-[state=active]:font-semibold');
  });

  it('applies fullWidth + flex-1 to items when fullWidth=true', () => {
    const styles = segmentGroupVariants({ fullWidth: true });
    expect(styles.base()).toContain('w-full');
    expect(styles.item()).toContain('flex-1');
  });

  describe('variant="text"', () => {
    it('strips the pill chrome (no bg, no padding, no rounded)', () => {
      const styles = segmentGroupVariants({ variant: 'text' });
      expect(styles.base()).toContain('bg-transparent');
      expect(styles.base()).toContain('rounded-none');
      expect(styles.base()).toContain('p-0');
    });

    it('hides the sliding indicator (active state signalled via border-b)', () => {
      const indicator = segmentGroupVariants({ variant: 'text' }).indicator();
      expect(indicator).toContain('hidden');
    });

    it('uses bottom-border primary as the active-state signal', () => {
      const item = segmentGroupVariants({ variant: 'text' }).item();
      expect(item).toContain('border-b-[1.5px]');
      expect(item).toContain('data-[state=active]:border-b-primary');
    });

    it('opts items out of pill bg/shadow on active (so the underline alone carries the signal)', () => {
      const item = segmentGroupVariants({ variant: 'text' }).item();
      expect(item).toContain('data-[state=active]:bg-transparent');
      expect(item).toContain('data-[state=active]:shadow-none');
    });

    it('renders text at font-normal (matches adjacent Select/Input in editorial knob-strips)', () => {
      const item = segmentGroupVariants({ variant: 'text' }).item();
      expect(item).toContain('font-normal');
    });

    it('applies size-specific padding via compoundVariants', () => {
      // Compounds override the default-variant px-3/py-1 sizes with denser
      // text-variant values appropriate for inline-toolbar use.
      expect(segmentGroupVariants({ variant: 'text', size: 'sm' }).item()).toContain('px-2');
      expect(segmentGroupVariants({ variant: 'text', size: 'sm' }).item()).toContain('text-xs');
      expect(segmentGroupVariants({ variant: 'text', size: 'md' }).item()).toContain('px-2.5');
      expect(segmentGroupVariants({ variant: 'text', size: 'lg' }).item()).toContain('px-3');
    });
  });

  it('never outputs dark: overrides', () => {
    const variantValues = ['default', 'text'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const variant of variantValues) {
      for (const size of sizes) {
        const styles = segmentGroupVariants({ variant, size });
        expect(styles.base()).not.toMatch(/\bdark:/);
        expect(styles.indicator()).not.toMatch(/\bdark:/);
        expect(styles.item()).not.toMatch(/\bdark:/);
      }
    }
  });

  describe('tier', () => {
    it('defaults to commit (pill track)', () => {
      const styles = segmentGroupVariants({});
      expect(styles.base()).toContain('rounded-commit');
      expect(styles.indicator()).toContain('rounded-commit');
      expect(styles.item()).toContain('rounded-commit');
    });

    it('switches to modify on tier=modify (soft-rectangle track)', () => {
      const styles = segmentGroupVariants({ tier: 'modify' });
      expect(styles.base()).toContain('rounded-modify');
      expect(styles.indicator()).toContain('rounded-modify');
      expect(styles.item()).toContain('rounded-modify');
      expect(styles.base()).not.toContain('rounded-commit');
    });

    it('text variant strips the tier rounded-{commit|modify} cleanly', () => {
      // Regression guard: pre-fix, `tier × variant="text"` emitted both
      // `rounded-{commit|modify}` (tier stage) and `rounded-none`
      // (variant stage) into the same slot. The CSS source order
      // happened to favour `rounded-none`, but it was load-bearing on the
      // alphabetic ordering of the token names. Now `rounded-none` lives
      // in a compoundVariant, which strips the tier-stage rounded class
      // entirely from the resolved output.
      const commit = segmentGroupVariants({ tier: 'commit', variant: 'text' });
      const modify = segmentGroupVariants({ tier: 'modify', variant: 'text' });

      expect(commit.base()).toContain('rounded-none');
      expect(commit.base()).not.toContain('rounded-commit');
      expect(commit.item()).toContain('rounded-none');
      expect(commit.item()).not.toContain('rounded-commit');

      expect(modify.base()).toContain('rounded-none');
      expect(modify.base()).not.toContain('rounded-modify');
      expect(modify.item()).toContain('rounded-none');
      expect(modify.item()).not.toContain('rounded-modify');
    });
  });
});
