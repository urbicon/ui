import { describe, expect, it } from 'vitest';
import { sidebarLayoutVariants } from './sidebar-layout.variants';

// Read off the config rather than listed: a slot added to the layout joins the
// "no dark:" sweep and the smoke test on its own instead of leaving behind a
// case nobody wrote.
const SLOTS = Object.keys(sidebarLayoutVariants.config.slots ?? {});
/** `Object.keys` widens to `string`, which the slot record does not admit. */
const slotFns = (variants = sidebarLayoutVariants()) =>
  variants as unknown as Record<string, () => string>;

describe('sidebarLayoutVariants', () => {
  it('provides all slot functions', () => {
    const styles = slotFns();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('reserves the sidebar gutter on the matching side of main', () => {
    // Left sidebar pads main-left from lg up; right is mirrored. Both reference the shared width
    // custom property the Sidebar writes, so the layout tracks a collapsing/expanding rail — plus
    // the strip the floating toggle grip is parked in, which is 0 unless that grip renders.
    expect(sidebarLayoutVariants({ side: 'left' }).main()).toContain(
      'lg:pl-[calc(var(--sidebar-effective-width)+var(--sidebar-toggle-gutter,0px))]'
    );
    expect(sidebarLayoutVariants({ side: 'right' }).main()).toContain(
      'lg:pr-[calc(var(--sidebar-effective-width)+var(--sidebar-toggle-gutter,0px))]'
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

  it('parks the toggle rail on the sidebar edge, desktop only', () => {
    // The grip rides the same custom property the panel animates, on the side
    // the panel is attached to — otherwise it drifts away from the rail it
    // belongs to whenever the sidebar collapses.
    expect(sidebarLayoutVariants({ side: 'left' }).toggleRail()).toContain(
      'left-[var(--sidebar-effective-width)]'
    );
    expect(sidebarLayoutVariants({ side: 'right' }).toggleRail()).toContain(
      'right-[var(--sidebar-effective-width)]'
    );
    // Mirror of mobileHeader's `lg:hidden`: exactly one of the two seams that
    // render the `toggle` snippet is visible at any width.
    const rail = sidebarLayoutVariants().toggleRail();
    expect(rail).toContain('hidden');
    expect(rail).toContain('lg:block');
  });

  it('never emits dark: overrides', () => {
    const styles = slotFns();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
