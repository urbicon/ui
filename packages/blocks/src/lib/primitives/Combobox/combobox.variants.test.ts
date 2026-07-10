import { describe, expect, it } from 'vitest';
import { comboboxVariants } from './combobox.variants';

describe('comboboxVariants', () => {
  it('provides all required slot functions', () => {
    const styles = comboboxVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.input).toBe('function');
    expect(typeof styles.listbox).toBe('function');
    expect(typeof styles.option).toBe('function');
    expect(typeof styles.noResults).toBe('function');
    expect(typeof styles.clear).toBe('function');
    expect(typeof styles.chevron).toBe('function');
  });

  it('uses design tokens', () => {
    const styles = comboboxVariants();
    expect(styles.input()).toContain('duration-[var(--blocks-duration-fast)]');
    expect(styles.input()).toContain('ring-primary/50');
    expect(styles.listbox()).toContain('shadow-[var(--blocks-shadow-md)]');
  });

  it('does not set a z-index on listbox (top-layer rendering)', () => {
    // After migration to `popover="manual"`, the listbox is rendered in
    // the browser's top layer, which sits above any stacking context —
    // a CSS z-index would be ineffective and misleading.
    const styles = comboboxVariants();
    expect(styles.listbox()).not.toContain('z-[var(--z-dropdown)]');
    expect(styles.listbox()).not.toMatch(/\bz-\[/);
  });

  it('uses focus-visible for input', () => {
    const styles = comboboxVariants();
    expect(styles.input()).toContain('focus-visible:');
    expect(styles.input()).not.toMatch(/\bfocus:/);
  });

  it('applies size classes across the full xs-xl scale (form-family symmetry with Input)', () => {
    const xs = comboboxVariants({ size: 'xs' });
    expect(xs.input()).toContain('h-7');
    expect(xs.input()).toContain('text-xs');
    // iOS focus-zoom floor applies to the sub-16px sizes.
    expect(xs.input()).toContain('pointer-coarse:text-base');

    const sm = comboboxVariants({ size: 'sm' });
    expect(sm.input()).toContain('h-8');
    expect(sm.input()).toContain('text-sm');

    const lg = comboboxVariants({ size: 'lg' });
    expect(lg.input()).toContain('h-12');
    expect(lg.input()).toContain('text-lg');

    const xl = comboboxVariants({ size: 'xl' });
    expect(xl.input()).toContain('h-14');
    expect(xl.input()).toContain('text-xl');
  });

  it('rotates chevron when open', () => {
    const open = comboboxVariants({ open: true });
    expect(open.chevron()).toContain('rotate-180');

    const closed = comboboxVariants({ open: false });
    expect(closed.chevron()).not.toContain('rotate-180');
  });

  it('applies disabled state', () => {
    const styles = comboboxVariants({ disabled: true });
    expect(styles.base()).toContain('opacity-50');
    expect(styles.base()).toContain('pointer-events-none');
  });

  it('applies variant styles at parity with Input / Select / Textarea', () => {
    // Default (outlined) reproduces the historical surface-subtle frame.
    const outlined = comboboxVariants();
    expect(outlined.input()).toContain('border-border-subtle');
    expect(outlined.input()).toContain('hover:border-border-default');

    const filled = comboboxVariants({ variant: 'filled' });
    expect(filled.input()).toContain('bg-surface-interactive');
    expect(filled.input()).toContain('border-transparent');

    const ghost = comboboxVariants({ variant: 'ghost' });
    expect(ghost.input()).toContain('bg-transparent');
    expect(ghost.input()).toContain('border-transparent');
  });

  it('underline variant drops the frame to a single bottom border', () => {
    const underline = comboboxVariants({ variant: 'underline' });
    expect(underline.input()).toContain('border-b-2');
    expect(underline.input()).toContain('bg-transparent');
    expect(underline.input()).toContain('focus-visible:ring-0');
    // `rounded-none` neutralizes the tier radius. The tv() engine does not
    // dedupe the custom `rounded-modify` utility against `rounded-none` (both
    // stay in the class list — identical to the shipped Select/Input underline
    // variants); `rounded-none` wins by CSS source order. See the engine
    // bucketing caveat in TODO.md.
    expect(underline.input()).toContain('rounded-none');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    for (const size of sizes) {
      const styles = comboboxVariants({ size });
      expect(styles.input()).not.toMatch(/\bdark:/);
      expect(styles.listbox()).not.toMatch(/\bdark:/);
      expect(styles.option()).not.toMatch(/\bdark:/);
      // Multi-select tokenizer slots.
      expect(styles.control()).not.toMatch(/\bdark:/);
      expect(styles.tag()).not.toMatch(/\bdark:/);
    }
  });

  // ── Multi-select tokenizer slots (CMB-2) ──────────────────────────────────
  it('exposes the tokenizer slot functions', () => {
    const styles = comboboxVariants();
    expect(typeof styles.control).toBe('function');
    expect(typeof styles.search).toBe('function');
    expect(typeof styles.tag).toBe('function');
    expect(typeof styles.tagLabel).toBe('function');
    expect(typeof styles.tagRemove).toBe('function');
  });

  it('control carries the frame (border, surface, focus-within ring), not the input', () => {
    const control = comboboxVariants().control();
    expect(control).toContain('border');
    expect(control).toContain('bg-surface-base');
    expect(control).toContain('flex-wrap');
    // Keyboard-only ring lives on focus-within (any child focus), never bare focus:.
    expect(control).toContain('focus-within:ring-2');
    expect(control).not.toMatch(/\bfocus:/);
  });

  it('the search input inside the control is borderless (the frame owns the border)', () => {
    const search = comboboxVariants().search();
    expect(search).toContain('border-0');
    expect(search).toContain('bg-transparent');
    expect(search).toContain('flex-1');
    expect(search).toContain('focus-visible:ring-0');
  });

  it('the tokenizer scales across the size ladder (parity with the single input)', () => {
    const xs = comboboxVariants({ size: 'xs' });
    expect(xs.control()).toContain('min-h-7');
    expect(xs.tag()).toContain('text-xs');

    const md = comboboxVariants({ size: 'md' });
    expect(md.control()).toContain('min-h-10');

    const xl = comboboxVariants({ size: 'xl' });
    expect(xl.control()).toContain('min-h-14');
    expect(xl.tag()).toContain('text-lg');
  });

  it('applies the visual variant to the control frame at parity with the input', () => {
    const filled = comboboxVariants({ variant: 'filled' });
    expect(filled.control()).toContain('bg-surface-interactive');
    expect(filled.control()).toContain('border-transparent');

    const underline = comboboxVariants({ variant: 'underline' });
    expect(underline.control()).toContain('border-b-2');
    expect(underline.control()).toContain('rounded-none');
  });
});
