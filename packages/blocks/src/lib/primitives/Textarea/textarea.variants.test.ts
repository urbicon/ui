import { describe, expect, it } from 'vitest';
import { textareaVariants } from './textarea.variants';

describe('textareaVariants', () => {
  it('produces outlined border by default', () => {
    const base = textareaVariants({}).base();
    expect(base).toContain('border-border-subtle');
  });

  it('uses filled variant styles', () => {
    const base = textareaVariants({ variant: 'filled' }).base();
    expect(base).toContain('bg-surface-interactive');
    expect(base).toContain('border-transparent');
  });

  it('uses ghost variant styles', () => {
    const base = textareaVariants({ variant: 'ghost' }).base();
    expect(base).toContain('bg-transparent');
    expect(base).toContain('border-transparent');
  });

  it('uses underline variant — bottom-line only, no border-box', () => {
    const base = textareaVariants({ variant: 'underline' }).base();
    expect(base).toContain('bg-transparent');
    expect(base).toContain('border-0');
    expect(base).toContain('border-b-2');
    expect(base).toContain('border-border-subtle');
    expect(base).toContain('rounded-none');
    expect(base).toContain('focus-visible:ring-0');
  });

  it('applies size classes correctly across the full xs-xl scale', () => {
    const xs = textareaVariants({ size: 'xs' }).base();
    const sm = textareaVariants({ size: 'sm' }).base();
    const md = textareaVariants({ size: 'md' }).base();
    const lg = textareaVariants({ size: 'lg' }).base();
    const xl = textareaVariants({ size: 'xl' }).base();

    expect(xs).toContain('text-xs');
    // iOS focus-zoom floor on the sub-16px sizes.
    expect(xs).toContain('pointer-coarse:text-base');
    expect(sm).toContain('text-sm');
    expect(md).toContain('text-base');
    expect(lg).toContain('text-lg');
    expect(xl).toContain('text-xl');

    expect(sm).toContain('min-h-[5rem]');
    expect(md).toContain('min-h-[7rem]');
    expect(lg).toContain('min-h-[9rem]');
  });

  it('applies error styles', () => {
    const styles = textareaVariants({ error: true });
    expect(styles.base()).toContain('border-danger');
    expect(styles.message()).toContain('text-danger');
  });

  it('applies intent styles', () => {
    const success = textareaVariants({ intent: 'success' });
    expect(success.base()).toContain('border-success');

    const warning = textareaVariants({ intent: 'warning' });
    expect(warning.base()).toContain('border-warning');
  });

  it('applies disabled state', () => {
    const styles = textareaVariants({ disabled: true });
    expect(styles.base()).toContain('opacity-50');
    expect(styles.base()).toContain('cursor-not-allowed');
    expect(styles.label()).toContain('text-text-disabled');
  });

  it('applies readonly state', () => {
    const base = textareaVariants({ readonly: true }).base();
    expect(base).toContain('bg-surface-subtle');
    expect(base).toContain('cursor-default');
  });

  it('applies autoResize styles', () => {
    const base = textareaVariants({ autoResize: true }).base();
    expect(base).toContain('resize-none');
    expect(base).toContain('overflow-hidden');
  });

  it('applies required asterisk to label', () => {
    const label = textareaVariants({ required: true }).label();
    expect(label).toContain("after:content-['*']");
    expect(label).toContain('after:text-danger');
  });

  it('applies counter warning state', () => {
    const counter = textareaVariants({ counterState: 'warning' }).counter();
    expect(counter).toContain('text-warning');
  });

  it('applies counter over state', () => {
    const counter = textareaVariants({ counterState: 'over' }).counter();
    expect(counter).toContain('text-danger');
    expect(counter).toContain('font-medium');
  });

  it('uses focus-visible not focus', () => {
    const base = textareaVariants({}).base();
    expect(base).toContain('focus-visible:');
    expect(base).not.toMatch(/(?<![a-z-])focus:/);
  });

  it('includes resize-vertical by default', () => {
    const base = textareaVariants({}).base();
    expect(base).toContain('resize-vertical');
  });

  it('never outputs dark: overrides', () => {
    const variants = ['outlined', 'filled', 'ghost', 'underline'] as const;
    for (const variant of variants) {
      const styles = textareaVariants({ variant });
      expect(styles.base()).not.toMatch(/\bdark:/);
      expect(styles.wrapper()).not.toMatch(/\bdark:/);
      expect(styles.label()).not.toMatch(/\bdark:/);
    }
  });
});
