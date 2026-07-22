import { describe, expect, it } from 'vitest';
import { commandPaletteVariants } from './commandPalette.variants';

describe('commandPaletteVariants', () => {
  it('provides all required slot functions', () => {
    const styles = commandPaletteVariants();
    const expectedSlots = [
      'wrapper',
      'inputWrapper',
      'input',
      'inputIcon',
      'clearButton',
      'list',
      'groupLabel',
      'item',
      'itemHighlighted',
      'itemDefault',
      'itemDisabled',
      'itemIcon',
      'itemLabel',
      'itemShortcut',
      'empty',
      'footer',
      'footerHint',
      'kbd',
      'separator'
    ];
    for (const slot of expectedSlots) {
      expect(typeof styles[slot as keyof typeof styles]).toBe('function');
    }
  });

  it('uses semantic design tokens', () => {
    const styles = commandPaletteVariants();
    expect(styles.wrapper()).toContain('bg-surface-overlay');
    expect(styles.wrapper()).toContain('border-border-hairline');
    expect(styles.input()).toContain('text-text-primary');
    expect(styles.groupLabel()).toContain('text-text-quaternary');
    expect(styles.empty()).toContain('text-text-tertiary');
  });

  it('applies size-specific max-width classes', () => {
    expect(commandPaletteVariants({ size: 'sm' }).wrapper()).toContain('max-w-sm');
    expect(commandPaletteVariants({ size: 'md' }).wrapper()).toContain('max-w-lg');
    expect(commandPaletteVariants({ size: 'lg' }).wrapper()).toContain('max-w-2xl');
  });

  it('defaults to md size', () => {
    const defaultWrapper = commandPaletteVariants({}).wrapper();
    const explicitWrapper = commandPaletteVariants({ size: 'md' }).wrapper();
    expect(defaultWrapper).toBe(explicitWrapper);
  });

  it('highlighted item uses primary intent tokens', () => {
    const styles = commandPaletteVariants();
    expect(styles.itemHighlighted()).toContain('bg-primary-subtle');
    expect(styles.itemHighlighted()).toContain('text-primary');
  });

  it('disabled item has reduced opacity', () => {
    const styles = commandPaletteVariants();
    expect(styles.itemDisabled()).toContain('opacity-50');
    expect(styles.itemDisabled()).toContain('cursor-not-allowed');
  });

  it('footer uses hairline (container divider), kbd uses subtle (pill border)', () => {
    const styles = commandPaletteVariants();
    expect(styles.footer()).toContain('border-border-hairline');
    expect(styles.kbd()).toContain('border-border-subtle');
    expect(styles.kbd()).toContain('bg-surface-subtle');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const styles = commandPaletteVariants({ size });
      expect(styles.wrapper()).not.toMatch(/\bdark:/);
      expect(styles.item()).not.toMatch(/\bdark:/);
      expect(styles.input()).not.toMatch(/\bdark:/);
      expect(styles.footer()).not.toMatch(/\bdark:/);
    }
  });

  it('list has overflow handling', () => {
    const styles = commandPaletteVariants();
    expect(styles.list()).toContain('overflow-y-auto');
    expect(styles.list()).toContain('max-h-72');
  });

  it('list carries the shared listbox rhythm (XC-9)', () => {
    // 4px edge inset + 2px item-to-item gap — the same panel rhythm as the
    // Select/Combobox listboxes and the Menu panel.
    const list = commandPaletteVariants().list();
    expect(list).toContain('p-1');
    expect(list).not.toContain('p-1.5');
    expect(list).toContain('space-y-0.5');
  });

  it('items sit on the md listbox baseline', () => {
    // px-3 py-2 text-sm min-h-2.5rem gap-2 = the md rhythm shared with
    // Select/Combobox options; the palette has no per-item size axis.
    const item = commandPaletteVariants().item();
    expect(item).toContain('px-3');
    expect(item).toContain('py-2');
    expect(item).toContain('text-sm');
    expect(item).toContain('min-h-[2.5rem]');
    expect(item).toContain('gap-2');
    expect(item).toContain('rounded-modify');
  });

  it('group label shares the item inset', () => {
    expect(commandPaletteVariants().groupLabel()).toContain('px-3');
  });

  it('item has transition for smooth interactions', () => {
    const styles = commandPaletteVariants();
    expect(styles.item()).toContain('transition-colors');
  });
});
