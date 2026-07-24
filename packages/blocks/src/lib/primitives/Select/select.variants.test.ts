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

  it('wears the shared field error frame, not a hand-copied twin', () => {
    // Same frame as Input/Textarea/PinInput/TimeInput/Combobox — sourced from
    // `internal/field-chrome` so a token fix can never miss Select again.
    const trigger = selectVariants({ error: true }).trigger();
    expect(trigger).toContain(
      'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
    );
    expect(trigger).not.toContain('border-border-subtle');
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

  it('marks selected options with the Form-family signature (parity with Combobox)', () => {
    // bg-surface-selected + font-medium is the shared listbox selected
    // signature; Combobox carries the same pair on its optionSelected slot.
    const selected = selectVariants({ selected: true }).option();
    expect(selected).toContain('bg-surface-selected');
    expect(selected).toContain('font-medium');

    const unselected = selectVariants({ selected: false }).option();
    expect(unselected).not.toContain('bg-surface-selected');
    expect(unselected).not.toContain('font-medium');
  });

  it('options follow the shared listbox item rhythm (XC-9)', () => {
    // px: 2 below md, 3 at md/lg, 4 at xl; min-h staggered 1.75→3.5rem.
    const xs = selectVariants({ size: 'xs' }).option();
    expect(xs).toContain('px-2');
    expect(xs).toContain('min-h-[1.75rem]');

    const sm = selectVariants({ size: 'sm' }).option();
    expect(sm).toContain('px-2');
    expect(sm).toContain('min-h-[2rem]');

    const md = selectVariants({ size: 'md' }).option();
    expect(md).toContain('px-3');
    expect(md).toContain('min-h-[2.5rem]');
    expect(md).toContain('text-sm');

    const lg = selectVariants({ size: 'lg' }).option();
    expect(lg).toContain('px-3');
    expect(lg).toContain('min-h-[3rem]');

    const xl = selectVariants({ size: 'xl' }).option();
    expect(xl).toContain('px-4');
    expect(xl).toContain('min-h-[3.5rem]');
  });

  it('group label shares the option inset per size', () => {
    expect(selectVariants({ size: 'xs' }).groupLabel()).toContain('px-2');
    expect(selectVariants({ size: 'sm' }).groupLabel()).toContain('px-2');
    expect(selectVariants({ size: 'md' }).groupLabel()).toContain('px-3');
    expect(selectVariants({ size: 'lg' }).groupLabel()).toContain('px-3');
    expect(selectVariants({ size: 'xl' }).groupLabel()).toContain('px-4');
  });

  it('grouped options keep the flat listbox item-to-item rhythm', () => {
    // The listbox spaces its direct children (flat options OR whole groups);
    // the group container re-establishes the same 2px gap for its options.
    expect(selectVariants({}).listbox()).toContain('space-y-0.5');
    expect(selectVariants({}).group()).toContain('space-y-0.5');
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
