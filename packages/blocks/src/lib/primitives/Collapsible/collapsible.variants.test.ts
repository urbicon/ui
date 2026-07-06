import { describe, expect, it } from 'vitest';
import { collapsibleVariants } from './collapsible.variants';

describe('collapsibleVariants', () => {
  it('provides all slot functions', () => {
    const styles = collapsibleVariants();
    for (const slot of ['base', 'trigger', 'chevron', 'content', 'contentInner'] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('animates the collapse on the retunable collapse tokens with a motion-reduce guard (ACC-3)', () => {
    const styles = collapsibleVariants();
    // The trigger keeps the fast token — that is the hover/focus micro-interaction, not the
    // collapse — so `transitionDuration`/`transitionEasing` must not retune it.
    expect(styles.trigger()).toContain('duration-[var(--blocks-duration-fast)]');
    for (const slot of ['chevron', 'content'] as const) {
      expect(styles[slot]()).toContain('duration-[var(--blocks-collapse-duration)]');
      expect(styles[slot]()).toContain('ease-[var(--blocks-collapse-easing)]');
      expect(styles[slot]()).toContain('motion-reduce:duration-[1ms]');
    }
  });

  it('applies card + ghost variant classes', () => {
    expect(collapsibleVariants({ variant: 'card' }).base()).toContain('border');
    expect(collapsibleVariants({ variant: 'ghost' }).trigger()).toContain('hover:bg-surface-hover');
  });

  it('never outputs dark: overrides', () => {
    for (const variant of ['default', 'card', 'ghost'] as const) {
      const styles = collapsibleVariants({ variant });
      expect(styles.base()).not.toMatch(/\bdark:/);
      expect(styles.trigger()).not.toMatch(/\bdark:/);
    }
  });
});
