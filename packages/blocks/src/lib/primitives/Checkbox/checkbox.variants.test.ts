import { describe, expect, it } from 'vitest';
import { checkboxVariants } from './checkbox.variants';

describe('checkboxVariants', () => {
  it('uses semantic tokens for unchecked outlined state', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'outlined' });
    const box = styles.box();
    expect(box).toContain('bg-surface-base');
    expect(box).toContain('border-border-default');
  });

  it('uses subtle background for unchecked filled variant', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'filled' });
    const box = styles.box();
    expect(box).toContain('bg-surface-subtle');
    expect(box).toContain('border-border-subtle');
  });

  it('uses transparent background for unchecked ghost variant', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'ghost' });
    const box = styles.box();
    expect(box).toContain('bg-transparent');
    expect(box).toContain('border-transparent');
  });

  it('applies intent color when checked', () => {
    const intents = ['primary', 'secondary', 'success', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const box = checkboxVariants({ checked: true, intent }).box();
      expect(box).toContain(`bg-${intent}`);
      expect(box).toContain(`border-${intent}`);
    }
  });

  it('mirrors checked style for indeterminate', () => {
    const indeterminate = checkboxVariants({ indeterminate: true, intent: 'primary' }).box();
    expect(indeterminate).toContain('bg-primary');
    expect(indeterminate).toContain('border-primary');
  });

  it('shows icon when checked or indeterminate', () => {
    const unchecked = checkboxVariants({ checked: false, indeterminate: false }).icon();
    expect(unchecked).toContain('opacity-0');

    const checked = checkboxVariants({ checked: true }).icon();
    expect(checked).toContain('opacity-100');
    expect(checked).toContain('scale-100');
  });

  it('applies disabled state correctly', () => {
    const styles = checkboxVariants({ disabled: true });
    expect(styles.control()).toContain('opacity-50');
    expect(styles.control()).toContain('pointer-events-none');
    expect(styles.control()).toContain('cursor-not-allowed');
  });

  it('includes cursor-pointer on non-disabled control', () => {
    const control = checkboxVariants({ disabled: false }).control();
    expect(control).toContain('cursor-pointer');
  });

  it('applies error border when unchecked', () => {
    const box = checkboxVariants({ error: true, checked: false, indeterminate: false }).box();
    expect(box).toContain('border-danger');
  });

  it('uses peer-focus-visible for focus ring on box', () => {
    const box = checkboxVariants({}).box();
    expect(box).toContain('peer-focus-visible:ring-2');
    expect(box).toContain('peer-focus-visible:ring-offset-surface-base');
  });

  it('differentiates all sizes', () => {
    const xs = checkboxVariants({ size: 'xs' }).box();
    const sm = checkboxVariants({ size: 'sm' }).box();
    const md = checkboxVariants({ size: 'md' }).box();
    const lg = checkboxVariants({ size: 'lg' }).box();
    expect(xs).toContain('w-3.5');
    expect(sm).toContain('w-4');
    expect(md).toContain('w-5');
    expect(lg).toContain('w-6');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      for (const checked of [true, false] as const) {
        const styles = checkboxVariants({ intent, checked });
        expect(styles.box()).not.toMatch(/\bdark:/);
        expect(styles.control()).not.toMatch(/\bdark:/);
        expect(styles.label()).not.toMatch(/\bdark:/);
      }
    }
  });

  describe('tier', () => {
    it('defaults to modify (input-tap surface)', () => {
      const styles = checkboxVariants({});
      expect(styles.box()).toContain('rounded-modify');
    });

    it('switches to commit on tier=commit (pill-style checklist)', () => {
      const styles = checkboxVariants({ tier: 'commit' });
      expect(styles.box()).toContain('rounded-commit');
      expect(styles.box()).not.toContain('rounded-modify');
    });

    it('produces no bare `rounded` class — token-only', () => {
      // Regression guard for the lg-size bug that hard-coded Tailwind's
      // default `rounded` (~ rounded-sm) instead of `rounded-modify`.
      // Every size should resolve through the tier token only.
      const sizes = ['xs', 'sm', 'md', 'lg'] as const;
      for (const size of sizes) {
        const box = checkboxVariants({ size }).box();
        // Must match the tier token, not the bare Tailwind utility.
        expect(box).toContain('rounded-modify');
        expect(box).not.toMatch(/\brounded(?!-)/);
      }
    });
  });
});
