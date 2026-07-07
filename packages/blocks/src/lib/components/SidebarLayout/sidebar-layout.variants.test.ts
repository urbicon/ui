import { describe, expect, it } from 'vitest';
import { sidebarLayoutVariants } from './sidebar-layout.variants';

const SLOTS = ['root', 'mobileHeader', 'main', 'inner'] as const;

describe('sidebarLayoutVariants', () => {
  it('provides all slot functions', () => {
    const styles = sidebarLayoutVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('reserves the sidebar gutter on the matching side of main', () => {
    // Left sidebar pads main-left from lg up; right is mirrored. Both reference the shared width
    // custom property the Sidebar writes, so the layout tracks a collapsing/expanding rail.
    expect(sidebarLayoutVariants({ side: 'left' }).main()).toContain(
      'lg:pl-[var(--sidebar-effective-width)]'
    );
    expect(sidebarLayoutVariants({ side: 'right' }).main()).toContain(
      'lg:pr-[var(--sidebar-effective-width)]'
    );
  });

  it('caps the content column per contentMaxWidth', () => {
    expect(sidebarLayoutVariants({ contentMaxWidth: 'none' }).inner()).toContain('max-w-none');
    expect(sidebarLayoutVariants({ contentMaxWidth: 'md' }).inner()).toContain('max-w-5xl');
    expect(sidebarLayoutVariants({ contentMaxWidth: 'xl' }).inner()).toContain('max-w-7xl');
    expect(sidebarLayoutVariants({ contentMaxWidth: '2xl' }).inner()).toContain('max-w-screen-2xl');
  });

  it('hides the mobile header from lg up and uses sticky + surface tokens', () => {
    const styles = sidebarLayoutVariants();
    expect(styles.mobileHeader()).toContain('lg:hidden');
    expect(styles.mobileHeader()).toContain('z-[var(--z-sticky)]');
    expect(styles.root()).toContain('bg-surface-base');
  });

  it('never emits dark: overrides', () => {
    const styles = sidebarLayoutVariants();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
