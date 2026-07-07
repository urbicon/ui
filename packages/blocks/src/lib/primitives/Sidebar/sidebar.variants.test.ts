import { describe, expect, it } from 'vitest';
import { sidebarVariants } from './sidebar.variants';

describe('sidebarVariants', () => {
  it('provides all slot functions', () => {
    const styles = sidebarVariants();
    for (const slot of ['backdrop', 'panel', 'header', 'content', 'footer'] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('pins the panel + its divider to the correct edge per side', () => {
    // Left panel sits at left-0 with the divider on its RIGHT edge; right is mirrored. Easy to
    // transpose, so assert both the inset and the border side together.
    const left = sidebarVariants({ side: 'left' }).panel();
    expect(left).toContain('left-0');
    expect(left).toContain('border-r');

    const right = sidebarVariants({ side: 'right' }).panel();
    expect(right).toContain('right-0');
    expect(right).toContain('border-l');
  });

  it('hides the backdrop from lg up in both modes; collapsible additionally clips the panel', () => {
    expect(sidebarVariants({ mode: 'responsive' }).backdrop()).toContain('lg:hidden');
    expect(sidebarVariants({ mode: 'collapsible' }).backdrop()).toContain('lg:hidden');
    expect(sidebarVariants({ mode: 'collapsible' }).panel()).toContain('overflow-hidden');
  });

  it('uses semantic surface + z-index + border tokens and never emits dark: overrides', () => {
    const styles = sidebarVariants();
    expect(styles.panel()).toContain('bg-surface-elevated');
    expect(styles.panel()).toContain('z-[var(--z-sidebar)]');
    expect(styles.backdrop()).toContain('z-[var(--z-overlay)]');
    expect(styles.header()).toContain('border-border-hairline');
    for (const slot of ['backdrop', 'panel', 'header', 'content', 'footer'] as const) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
