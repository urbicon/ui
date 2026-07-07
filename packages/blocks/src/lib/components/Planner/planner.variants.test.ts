import { describe, expect, it } from 'vitest';
import { plannerVariants } from './planner.variants';

describe('plannerVariants', () => {
  it('exposes all slots as functions and never emits dark: overrides', () => {
    const styles = plannerVariants();
    for (const [name, fn] of Object.entries(styles)) {
      expect(typeof fn, `slot ${name} should be a function`).toBe('function');
      expect((fn as () => string)(), `slot ${name} must not emit dark:`).not.toMatch(/\bdark:/);
    }
  });

  it('view drives the cell layout — week = standalone cards, month/range = continuous grid', () => {
    // Week: standalone cards (all-round border + rounding). Month/range: shared borders
    // (border-t + border-l only, no rounding) so cells tile into one continuous grid. Break this
    // and week cells lose their card shape or month cells grow gaps between them.
    const week = plannerVariants({ view: 'week' }).cell();
    expect(week).toContain('rounded-lg');
    expect(week).toContain('min-h-32');
    expect(week).not.toContain('border-t');

    const month = plannerVariants({ view: 'month' }).cell();
    expect(month).toContain('border-t');
    expect(month).toContain('border-l');
    expect(month).toContain('min-h-24');
    expect(month).not.toContain('rounded-lg');

    // range mirrors month's tiling layout.
    expect(plannerVariants({ view: 'range' }).cell()).toContain('border-t');
  });

  it('applies variant chrome and scales nav + date cells with size', () => {
    expect(plannerVariants({ variant: 'bordered' }).base()).toContain('rounded-xl');
    expect(plannerVariants({ variant: 'ghost' }).cell()).toContain('border-transparent');

    expect(plannerVariants({ size: 'sm' }).navButton()).toContain('h-7');
    expect(plannerVariants({ size: 'md' }).navButton()).toContain('h-8');
    expect(plannerVariants({ size: 'lg' }).navButton()).toContain('h-9');
    expect(plannerVariants({ size: 'sm' }).cellDate()).toContain('h-5');
    expect(plannerVariants({ size: 'lg' }).cellDate()).toContain('h-7');
  });

  it('uses semantic text + border tokens on the chrome', () => {
    const styles = plannerVariants();
    expect(styles.headerTitle()).toContain('text-text-primary');
    expect(styles.weekday()).toContain('text-text-tertiary');
    expect(styles.header()).toContain('border-border-hairline');
  });
});
