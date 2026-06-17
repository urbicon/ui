import { describe, expect, it } from 'vitest';
import { radioGroupVariants, radioItemVariants } from './radioGroup.variants';

describe('radioGroupVariants', () => {
  it('produces vertical layout by default', () => {
    const group = radioGroupVariants({}).group();
    expect(group).toContain('flex-col');
  });

  it('produces horizontal layout when specified', () => {
    const group = radioGroupVariants({ orientation: 'horizontal' }).group();
    expect(group).toContain('flex-row');
  });

  it('applies required asterisk to label', () => {
    const label = radioGroupVariants({ required: true }).label();
    expect(label).toContain("after:content-['*']");
    expect(label).toContain('after:text-danger');
  });

  it('applies error style to message', () => {
    const message = radioGroupVariants({ error: true }).message();
    expect(message).toContain('text-danger');
  });
});

describe('radioItemVariants', () => {
  it('uses semantic tokens for unchecked outlined state', () => {
    const styles = radioItemVariants({ checked: false, variant: 'outlined' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-surface-base');
    expect(indicator).toContain('border-border-default');
  });

  it('uses subtle background for unchecked filled variant', () => {
    const styles = radioItemVariants({ checked: false, variant: 'filled' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-surface-subtle');
    expect(indicator).toContain('border-border-subtle');
  });

  it('uses transparent background for unchecked ghost variant', () => {
    const styles = radioItemVariants({ checked: false, variant: 'ghost' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-transparent');
    expect(indicator).toContain('border-transparent');
  });

  it('applies intent color when checked', () => {
    const intents = ['primary', 'secondary', 'success', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const indicator = radioItemVariants({ checked: true, intent }).indicator();
      expect(indicator).toContain(`bg-${intent}`);
      expect(indicator).toContain(`border-${intent}`);
    }
  });

  it('shows dot when checked', () => {
    const unchecked = radioItemVariants({ checked: false }).dot();
    expect(unchecked).toContain('opacity-0');
    expect(unchecked).toContain('scale-0');

    const checked = radioItemVariants({ checked: true }).dot();
    expect(checked).toContain('opacity-100');
    expect(checked).toContain('scale-100');
  });

  it('applies disabled state correctly', () => {
    const styles = radioItemVariants({ disabled: true });
    expect(styles.item()).toContain('opacity-50');
    expect(styles.item()).toContain('pointer-events-none');
    expect(styles.item()).toContain('cursor-not-allowed');
  });

  it('includes cursor-pointer on non-disabled item', () => {
    const item = radioItemVariants({ disabled: false }).item();
    expect(item).toContain('cursor-pointer');
  });

  it('applies error border when unchecked', () => {
    const indicator = radioItemVariants({ error: true, checked: false }).indicator();
    expect(indicator).toContain('border-danger');
  });

  it('uses peer-focus-visible for focus ring on indicator', () => {
    const indicator = radioItemVariants({}).indicator();
    expect(indicator).toContain('peer-focus-visible:ring-2');
    expect(indicator).toContain('peer-focus-visible:ring-offset-surface-base');
  });

  it('uses commit tier (rounded-commit) for radio indicator', () => {
    const indicator = radioItemVariants({}).indicator();
    expect(indicator).toContain('rounded-commit');
  });

  it('differentiates all sizes', () => {
    const xs = radioItemVariants({ size: 'xs' }).indicator();
    const sm = radioItemVariants({ size: 'sm' }).indicator();
    const md = radioItemVariants({ size: 'md' }).indicator();
    const lg = radioItemVariants({ size: 'lg' }).indicator();
    expect(xs).toContain('w-3.5');
    expect(sm).toContain('w-4');
    expect(md).toContain('w-5');
    expect(lg).toContain('w-6');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      for (const checked of [true, false] as const) {
        const styles = radioItemVariants({ intent, checked });
        expect(styles.indicator()).not.toMatch(/\bdark:/);
        expect(styles.item()).not.toMatch(/\bdark:/);
        expect(styles.label()).not.toMatch(/\bdark:/);
      }
    }
  });

  describe('tier', () => {
    it('defaults to commit (circle indicator)', () => {
      const styles = radioItemVariants({});
      expect(styles.indicator()).toContain('rounded-commit');
      expect(styles.dot()).toContain('rounded-commit');
    });

    it('switches to modify on tier=modify (soft-rectangle indicator)', () => {
      const styles = radioItemVariants({ tier: 'modify' });
      expect(styles.indicator()).toContain('rounded-modify');
      expect(styles.dot()).toContain('rounded-modify');
      expect(styles.indicator()).not.toContain('rounded-commit');
      expect(styles.dot()).not.toContain('rounded-commit');
    });
  });
});
