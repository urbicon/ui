import { describe, expect, it } from 'vitest';
import { dialogVariants } from './dialog.variants';

describe('dialogVariants', () => {
  it('provides all required slot functions', () => {
    const styles = dialogVariants();
    expect(typeof styles.dialog).toBe('function');
    expect(typeof styles.backdrop).toBe('function');
    expect(typeof styles.panel).toBe('function');
    expect(typeof styles.content).toBe('function');
    expect(typeof styles.header).toBe('function');
    expect(typeof styles.title).toBe('function');
    expect(typeof styles.body).toBe('function');
    expect(typeof styles.footer).toBe('function');
  });

  it('uses design tokens for shadow and z-index', () => {
    const styles = dialogVariants();
    expect(styles.dialog()).toContain('z-[var(--z-modal)]');
    expect(styles.backdrop()).toContain('z-[var(--z-overlay)]');
    expect(styles.panel()).toContain('shadow-[var(--blocks-shadow-lg)]');
    expect(styles.panel()).toContain('z-[var(--z-modal)]');
  });

  it('uses semantic tokens for panel', () => {
    const panel = dialogVariants({ size: 'md' }).panel();
    expect(panel).toContain('bg-surface-overlay');
    expect(panel).toContain('border-border-hairline');
  });

  it('applies size-specific max-width classes', () => {
    expect(dialogVariants({ size: 'sm' }).panel()).toContain('max-w-sm');
    expect(dialogVariants({ size: 'md' }).panel()).toContain('max-w-md');
    expect(dialogVariants({ size: 'lg' }).panel()).toContain('max-w-lg');
    expect(dialogVariants({ size: 'xl' }).panel()).toContain('max-w-2xl');
  });

  it('full size uses viewport-relative dimensions', () => {
    const panel = dialogVariants({ size: 'full' }).panel();
    expect(panel).toContain('max-w-[95vw]');
    expect(panel).toContain('max-h-[95vh]');
  });

  it('applies placement classes', () => {
    const top = dialogVariants({ placement: 'top' });
    expect(top.dialog()).toContain('items-start');
    // Mobile-first base + sm-breakpoint upgrade — assert both so a regression
    // in either branch surfaces. A bare `toContain('pt-16')` would silently
    // pass on just `sm:pt-16`.
    expect(top.dialog()).toContain('pt-12');
    expect(top.dialog()).toContain('sm:pt-16');

    const center = dialogVariants({ placement: 'center' });
    expect(center.dialog()).toContain('items-center');
  });

  it('Lighter: no intent adds a colored accent top-border (intent is signaled via icon + heading color in consumers)', () => {
    const intents = ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger'] as const;
    for (const intent of intents) {
      const panel = dialogVariants({ intent }).panel();
      expect(panel).not.toContain('border-t-[3px]');
    }
  });

  it('defaults to sm size, center placement, and neutral intent', () => {
    const defaultPanel = dialogVariants({}).panel();
    const explicitPanel = dialogVariants({
      size: 'sm',
      placement: 'center',
      intent: 'neutral'
    }).panel();
    expect(defaultPanel).toBe(explicitPanel);
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const;
    for (const size of sizes) {
      const styles = dialogVariants({ size });
      expect(styles.dialog()).not.toMatch(/\bdark:/);
      expect(styles.panel()).not.toMatch(/\bdark:/);
      expect(styles.backdrop()).not.toMatch(/\bdark:/);
    }
  });

  it('content slot has overflow handling', () => {
    const content = dialogVariants().content();
    expect(content).toContain('overflow-y-auto');
    expect(content).toContain('overscroll-contain');
  });

  it('structured slots are defined', () => {
    const styles = dialogVariants();
    expect(styles.header()).toContain('border-b');
    expect(styles.title()).toContain('font-semibold');
    expect(styles.body()).toContain('overflow-y-auto');
    expect(styles.footer()).toContain('border-t');
  });
});
