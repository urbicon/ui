import { describe, expect, it } from 'vitest';
import { codePanelVariants } from './codepanel.variants';

describe('codePanelVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = codePanelVariants({ size: 'md' });
    const expectedSlots = [
      'root',
      'toolbar',
      'codeToggle',
      'codeChevron',
      'languageTag',
      'copyButton',
      'copySeparator',
      'codeCollapse',
      'codeDisplay',
      'codeContent',
      'loadingContainer',
      'loadingText'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }
  });

  it('uses semantic design tokens in base classes', () => {
    const styles = codePanelVariants({ size: 'md' });

    expect(styles.codeToggle()).toContain('text-text-tertiary');
    expect(styles.copyButton()).toContain('text-text-quaternary');
    expect(styles.copySeparator()).toContain('text-text-quaternary');
    expect(styles.loadingText()).toContain('text-text-secondary');
  });

  it('toolbar has no border or background', () => {
    const styles = codePanelVariants({ size: 'md' });
    const toolbar = styles.toolbar();

    expect(toolbar).not.toContain('border');
    expect(toolbar).not.toContain('bg-');
  });

  it('root has no background', () => {
    const styles = codePanelVariants({ size: 'md' });

    expect(styles.root()).not.toContain('bg-');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    for (const size of sizes) {
      const styles = codePanelVariants({ size });
      const allClasses = [
        styles.root(),
        styles.toolbar(),
        styles.codeToggle(),
        styles.copyButton(),
        styles.codeCollapse(),
        styles.codeContent()
      ].join(' ');

      expect(allClasses).not.toMatch(/\bdark:/);
    }
  });

  it('uses focus-visible instead of focus', () => {
    const styles = codePanelVariants({ size: 'md' });

    const focusSlots = [styles.copyButton(), styles.codeContent()].join(' ');
    expect(focusSlots).toContain('focus-visible:');
    expect(focusSlots).not.toMatch(/(?<!-)focus:/);
  });

  it('uses editorial font-meta on toggle and copy', () => {
    const styles = codePanelVariants({ size: 'md' });

    expect(styles.codeToggle()).toContain('font-meta');
    expect(styles.copyButton()).toContain('font-meta');
  });

  it('uses meta-marker on language tag', () => {
    const styles = codePanelVariants({ size: 'md' });

    expect(styles.languageTag()).toContain('meta-marker');
  });

  describe('size variants', () => {
    it('sm has compact layout', () => {
      const styles = codePanelVariants({ size: 'sm' });

      expect(styles.toolbar()).toContain('px-3');
      expect(styles.codeToggle()).toContain('text-[11px]');
      expect(styles.codeChevron()).toContain('size-3');
    });

    it('lg has spacious layout', () => {
      const styles = codePanelVariants({ size: 'lg' });

      expect(styles.toolbar()).toContain('px-5');
    });

    it('produces distinct toolbar classes across sm and lg', () => {
      const sm = codePanelVariants({ size: 'sm' });
      const lg = codePanelVariants({ size: 'lg' });

      expect(sm.toolbar()).not.toBe(lg.toolbar());
    });
  });

  it('defaults to size md', () => {
    const withDefault = codePanelVariants({});
    const withExplicit = codePanelVariants({ size: 'md' });

    expect(withDefault.toolbar()).toBe(withExplicit.toolbar());
    expect(withDefault.codeToggle()).toBe(withExplicit.codeToggle());
  });

  it('supports slotClasses via class merging', () => {
    const styles = codePanelVariants({ size: 'md' });
    const customized = styles.toolbar({ class: 'my-custom-class' });

    expect(customized).toContain('my-custom-class');
    expect(customized).toContain('flex');
  });
});
