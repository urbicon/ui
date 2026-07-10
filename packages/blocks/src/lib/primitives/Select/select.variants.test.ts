import { describe, expect, it } from 'vitest';
import { selectVariants } from './select.variants';

describe('selectVariants', () => {
  it('produces outlined border by default', () => {
    const trigger = selectVariants({}).trigger();
    expect(trigger).toContain('border-border-subtle');
  });

  it('uses filled variant styles', () => {
    const trigger = selectVariants({ variant: 'filled' }).trigger();
    expect(trigger).toContain('bg-surface-interactive');
    expect(trigger).toContain('border-transparent');
  });

  it('uses ghost variant styles', () => {
    const trigger = selectVariants({ variant: 'ghost' }).trigger();
    expect(trigger).toContain('bg-transparent');
    expect(trigger).toContain('border-transparent');
  });

  it('uses underline variant — bottom-line only, no border-box (editorial knob-strip)', () => {
    const trigger = selectVariants({ variant: 'underline' }).trigger();
    expect(trigger).toContain('bg-transparent');
    expect(trigger).toContain('border-0');
    expect(trigger).toContain('border-b-2');
    expect(trigger).toContain('border-border-subtle');
    expect(trigger).toContain('rounded-none');
    // No focus ring — underline already signals focus
    expect(trigger).toContain('focus-visible:ring-0');
  });

  it('differentiates trigger sizes across the full xs-xl scale (form-family symmetry)', () => {
    const xs = selectVariants({ size: 'xs' }).trigger();
    const sm = selectVariants({ size: 'sm' }).trigger();
    const md = selectVariants({ size: 'md' }).trigger();
    const lg = selectVariants({ size: 'lg' }).trigger();
    const xl = selectVariants({ size: 'xl' }).trigger();

    expect(xs).toContain('h-7');
    expect(sm).toContain('h-8');
    expect(md).toContain('h-10');
    expect(lg).toContain('h-12');
    expect(xl).toContain('h-14');
  });

  it('rotates chevron when open', () => {
    const closed = selectVariants({ open: false }).chevron();
    const opened = selectVariants({ open: true }).chevron();

    expect(closed).not.toContain('rotate-180');
    expect(opened).toContain('rotate-180');
  });

  it('applies disabled state', () => {
    const trigger = selectVariants({ disabled: true }).trigger();
    expect(trigger).toContain('opacity-50');
    expect(trigger).toContain('cursor-not-allowed');
  });

  it('applies error styles', () => {
    const styles = selectVariants({ error: true });
    expect(styles.trigger()).toContain('border-danger');
    expect(styles.message()).toContain('text-danger');
  });

  it('applies required asterisk to label', () => {
    const label = selectVariants({ required: true }).label();
    expect(label).toContain("after:content-['*']");
    expect(label).toContain('after:text-danger');
  });

  it('shows check icon when selected', () => {
    const unselected = selectVariants({ selected: false }).optionCheck();
    const selected = selectVariants({ selected: true }).optionCheck();

    expect(unselected).toContain('opacity-0');
    expect(selected).toContain('opacity-100');
  });

  it('does not set a z-index on listbox (top-layer rendering)', () => {
    // After migration to `popover="manual"`, the listbox is rendered in
    // the browser's top layer, which sits above any stacking context —
    // a CSS z-index would be ineffective and misleading.
    const listbox = selectVariants({}).listbox();
    expect(listbox).not.toContain('z-[var(--z-dropdown)]');
    expect(listbox).not.toMatch(/\bz-\[/);
  });

  it('uses semantic surface token for listbox', () => {
    const listbox = selectVariants({}).listbox();
    expect(listbox).toContain('bg-surface-elevated');
  });

  it('uses shadow token for listbox', () => {
    const listbox = selectVariants({}).listbox();
    expect(listbox).toContain('shadow-[var(--blocks-shadow-md)]');
  });

  it('uses focus-visible not focus', () => {
    const trigger = selectVariants({}).trigger();
    expect(trigger).toContain('focus-visible:');
    expect(trigger).not.toMatch(/(?<![a-z-])focus:/);
  });

  it('never outputs dark: overrides', () => {
    const variants = ['outlined', 'filled', 'ghost', 'underline'] as const;
    for (const variant of variants) {
      const styles = selectVariants({ variant });
      expect(styles.trigger()).not.toMatch(/\bdark:/);
      expect(styles.listbox()).not.toMatch(/\bdark:/);
      expect(styles.option()).not.toMatch(/\bdark:/);
    }
  });

  it('exposes a clear slot with focus-visible ring and right offset per size', () => {
    const xs = selectVariants({ size: 'xs' }).clear();
    const sm = selectVariants({ size: 'sm' }).clear();
    const md = selectVariants({ size: 'md' }).clear();
    const lg = selectVariants({ size: 'lg' }).clear();
    const xl = selectVariants({ size: 'xl' }).clear();

    for (const cls of [xs, sm, md, lg, xl]) {
      expect(cls).toContain('absolute');
      expect(cls).toContain('focus-visible:');
      expect(cls).not.toMatch(/(?<![a-z-])focus:/);
    }

    expect(sm).toContain('right-2');
    expect(md).toContain('right-3');
    expect(lg).toContain('right-4');
  });
});
