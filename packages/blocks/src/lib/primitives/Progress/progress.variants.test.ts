import { describe, expect, it } from 'vitest';
import { progressVariants } from './progress.variants';

describe('progressVariants', () => {
  it('applies intent colors to fill', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const fill = progressVariants({ intent }).fill();
      expect(fill).toContain(`bg-${intent}`);
    }
  });

  it('applies intent colors to circular fill', () => {
    const intents = ['primary', 'secondary', 'success', 'danger'] as const;
    for (const intent of intents) {
      const circularFill = progressVariants({ intent }).circularFill();
      expect(circularFill).toContain(`text-${intent}`);
    }
  });

  it('differentiates all sizes for track height', () => {
    const xs = progressVariants({ size: 'xs' }).track();
    const sm = progressVariants({ size: 'sm' }).track();
    const md = progressVariants({ size: 'md' }).track();
    const lg = progressVariants({ size: 'lg' }).track();

    expect(xs).toContain('h-1');
    expect(sm).toContain('h-1.5');
    expect(md).toContain('h-2.5');
    expect(lg).toContain('h-4');
  });

  it('sizes the circular label off the type scale at every size', () => {
    // xs needs 10px, below Tailwind's --text-xs floor; text-3xs keeps that
    // reachable by a consumer @theme override instead of hardcoding text-[10px].
    expect(progressVariants({ size: 'xs' }).circularLabel()).toContain('text-3xs');
    expect(progressVariants({ size: 'sm' }).circularLabel()).toContain('text-xs');
    expect(progressVariants({ size: 'md' }).circularLabel()).toContain('text-sm');
    expect(progressVariants({ size: 'lg' }).circularLabel()).toContain('text-base');
  });

  it('uses commit tier (rounded-commit) for track and fill', () => {
    const styles = progressVariants({});
    expect(styles.track()).toContain('rounded-commit');
    expect(styles.fill()).toContain('rounded-commit');
  });

  it('applies indeterminate animation class', () => {
    const fill = progressVariants({ indeterminate: true }).fill();
    expect(fill).toContain('animate-progress-indeterminate');
  });

  it('applies striped pattern', () => {
    const fill = progressVariants({ striped: true }).fill();
    expect(fill).toContain('bg-[linear-gradient');
  });

  it('applies animated striped animation', () => {
    const fill = progressVariants({ striped: true, animated: true }).fill();
    expect(fill).toContain('animate-progress-striped');
  });

  it('uses semantic surface token for track background', () => {
    const track = progressVariants({}).track();
    expect(track).toContain('bg-surface-subtle');
  });

  it('uses tabular-nums for value text', () => {
    const valueText = progressVariants({}).valueText();
    expect(valueText).toContain('tabular-nums');
  });

  it('uses semantic text tokens for labels', () => {
    const styles = progressVariants({});
    expect(styles.label()).toContain('text-text-secondary');
    expect(styles.valueText()).toContain('text-text-tertiary');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = progressVariants({ intent });
      expect(styles.fill()).not.toMatch(/\bdark:/);
      expect(styles.track()).not.toMatch(/\bdark:/);
      expect(styles.wrapper()).not.toMatch(/\bdark:/);
    }
  });
});
