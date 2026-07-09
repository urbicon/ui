import { describe, expect, it } from 'vitest';
import { playgroundConfiguratorVariants } from './playground-configurator.variants';

describe('playgroundConfiguratorVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = playgroundConfiguratorVariants({ size: 'md' });
    const expectedSlots = [
      'root',
      'header',
      'title',
      'subtitle',
      'container',
      'preview',
      'previewContent',
      'controlsPanel',
      'controlsHeader',
      'controlsGrid',
      'controlItem',
      'controlLabel',
      'controlControl',
      'controlControlCompact',
      'controlHint',
      'modifiedDot',
      'variantBadge',
      'colorInput',
      'actionsBar',
      'helpToggle',
      'helpToggleActive',
      'codePanel'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }
  });

  it('uses semantic design tokens in base classes', () => {
    const styles = playgroundConfiguratorVariants({ size: 'md' });

    expect(styles.container()).toContain('border-border-hairline');
    expect(styles.container()).toContain('border-y');
    // The stage sits IN the reading-flow on the page paper — container and
    // preview deliberately carry no own background (the rooms skin tints the
    // playground frame via [data-docs-stage-frame]).
    expect(styles.container()).not.toMatch(/\bbg-/);
    expect(styles.preview()).not.toMatch(/\bbg-/);
    expect(styles.title()).toContain('text-text-primary');
    expect(styles.subtitle()).toContain('text-text-secondary');
    expect(styles.controlLabel()).toContain('text-text-tertiary');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    for (const size of sizes) {
      const styles = playgroundConfiguratorVariants({ size });
      const allClasses = [
        styles.root(),
        styles.container(),
        styles.preview(),
        styles.controlsGrid(),
        styles.codePanel()
      ].join(' ');

      expect(allClasses).not.toMatch(/\bdark:/);
    }
  });

  it('uses focus-visible instead of focus for the help toggle', () => {
    const styles = playgroundConfiguratorVariants({ size: 'md' });
    const helpToggle = styles.helpToggle();

    expect(helpToggle).toContain('focus-visible:');
    expect(helpToggle).not.toMatch(/(?<!-)focus:/);
  });

  describe('size variants', () => {
    it('sm has compact layout', () => {
      const styles = playgroundConfiguratorVariants({ size: 'sm' });

      expect(styles.preview()).toContain('p-4');
      expect(styles.title()).toContain('text-lg');
      expect(styles.controlLabel()).toContain('text-[10px]');
      expect(styles.colorInput()).toContain('h-7');
    });

    it('md has default layout', () => {
      const styles = playgroundConfiguratorVariants({ size: 'md' });

      expect(styles.preview()).toContain('p-8');
      expect(styles.title()).toContain('text-xl');
      expect(styles.controlLabel()).toContain('text-[11px]');
      expect(styles.colorInput()).toContain('h-8');
    });

    it('lg has spacious layout', () => {
      const styles = playgroundConfiguratorVariants({ size: 'lg' });

      expect(styles.preview()).toContain('p-12');
      expect(styles.title()).toContain('text-2xl');
      expect(styles.controlLabel()).toContain('text-xs');
      expect(styles.colorInput()).toContain('h-9');
    });

    it('produces distinct classes across all sizes', () => {
      const sm = playgroundConfiguratorVariants({ size: 'sm' });
      const md = playgroundConfiguratorVariants({ size: 'md' });
      const lg = playgroundConfiguratorVariants({ size: 'lg' });

      expect(sm.preview()).not.toBe(md.preview());
      expect(md.preview()).not.toBe(lg.preview());
      expect(sm.colorInput()).not.toBe(md.colorInput());
      expect(md.colorInput()).not.toBe(lg.colorInput());
    });
  });

  it('defaults to size md', () => {
    const withDefault = playgroundConfiguratorVariants({});
    const withExplicit = playgroundConfiguratorVariants({ size: 'md' });

    expect(withDefault.preview()).toBe(withExplicit.preview());
    expect(withDefault.title()).toBe(withExplicit.title());
    expect(withDefault.controlsGrid()).toBe(withExplicit.controlsGrid());
  });

  it('supports slotClasses via class merging', () => {
    const styles = playgroundConfiguratorVariants({ size: 'md' });
    const customized = styles.container({ class: 'my-custom-class' });

    expect(customized).toContain('my-custom-class');
    expect(customized).toContain('border-border-hairline');
  });
});
