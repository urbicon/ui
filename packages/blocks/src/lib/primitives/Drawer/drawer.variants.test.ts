import { describe, expect, it } from 'vitest';
import { drawerVariants } from './drawer.variants';

describe('drawerVariants', () => {
  it('uses z-index tokens for dialog and backdrop', () => {
    const styles = drawerVariants({});
    expect(styles.dialog()).toContain('z-[var(--z-modal)]');
    expect(styles.backdrop()).toContain('z-[var(--z-overlay)]');
  });

  it('uses semantic surface token for panel background', () => {
    const panel = drawerVariants({}).panel();
    expect(panel).toContain('bg-surface-overlay');
  });

  it('uses shadow token for panel', () => {
    const panel = drawerVariants({}).panel();
    expect(panel).toContain('shadow-[var(--blocks-shadow-lg)]');
  });

  it('applies right placement by default', () => {
    const styles = drawerVariants({});
    expect(styles.dialog()).toContain('justify-end');
    expect(styles.panel()).toContain('rounded-l-xl');
  });

  it('applies left placement', () => {
    const styles = drawerVariants({ placement: 'left' });
    expect(styles.dialog()).toContain('justify-start');
    expect(styles.panel()).toContain('rounded-r-xl');
    expect(styles.panel()).toContain('h-full');
  });

  it('applies top placement', () => {
    const styles = drawerVariants({ placement: 'top' });
    expect(styles.dialog()).toContain('items-start');
    expect(styles.panel()).toContain('rounded-b-xl');
    expect(styles.panel()).toContain('w-full');
  });

  it('applies bottom placement', () => {
    const styles = drawerVariants({ placement: 'bottom' });
    expect(styles.dialog()).toContain('items-end');
    expect(styles.panel()).toContain('rounded-t-xl');
    expect(styles.panel()).toContain('w-full');
  });

  it('applies horizontal size widths for left/right', () => {
    const sm = drawerVariants({ placement: 'right', size: 'sm' }).panel();
    const md = drawerVariants({ placement: 'right', size: 'md' }).panel();
    const lg = drawerVariants({ placement: 'right', size: 'lg' }).panel();
    const xl = drawerVariants({ placement: 'right', size: 'xl' }).panel();
    const full = drawerVariants({ placement: 'right', size: 'full' }).panel();

    expect(sm).toContain('w-72');
    expect(md).toContain('w-96');
    expect(lg).toContain('w-[32rem]');
    expect(xl).toContain('w-[42rem]');
    expect(full).toContain('w-full');
  });

  it('applies vertical size heights for top/bottom', () => {
    const sm = drawerVariants({ placement: 'bottom', size: 'sm' }).panel();
    const md = drawerVariants({ placement: 'bottom', size: 'md' }).panel();
    const lg = drawerVariants({ placement: 'bottom', size: 'lg' }).panel();

    expect(sm).toContain('h-48');
    expect(md).toContain('h-72');
    expect(lg).toContain('h-96');
  });

  it('uses backdrop blur', () => {
    const backdrop = drawerVariants({}).backdrop();
    expect(backdrop).toContain('backdrop-blur-sm');
  });

  it('uses semantic border tokens', () => {
    const styles = drawerVariants({});
    expect(styles.panel()).toContain('border-border-hairline');
    expect(styles.header()).toContain('border-border-hairline');
    expect(styles.footer()).toContain('border-border-hairline');
  });

  it('never outputs dark: overrides', () => {
    const placements = ['left', 'right', 'top', 'bottom'] as const;
    for (const placement of placements) {
      const styles = drawerVariants({ placement });
      expect(styles.panel()).not.toMatch(/\bdark:/);
      expect(styles.backdrop()).not.toMatch(/\bdark:/);
      expect(styles.dialog()).not.toMatch(/\bdark:/);
    }
  });
});
