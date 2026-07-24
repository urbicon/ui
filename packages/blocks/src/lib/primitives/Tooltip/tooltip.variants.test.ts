import { describe, expect, it } from 'vitest';
import { tooltipVariants } from './tooltip.variants';

describe('tooltipVariants', () => {
  it('provides all slot functions', () => {
    const styles = tooltipVariants();
    for (const slot of ['base', 'arrow'] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('fades on the retunable tooltip tokens with a motion-reduce guard (ACC-3 follow-up)', () => {
    // Mirrors the collapse-motion contract: the fade must resolve the shared
    // `--blocks-tooltip-*` vars (so `transitionDuration`/`transitionEasing` can
    // retune it inline) and carry the `motion-reduce` guard, since an inline
    // duration bypasses the token that reduced motion collapses to 1ms.
    const base = tooltipVariants().base();
    // display/overlay + transition-discrete keep the exit painted through
    // hidePopover(); without them the top-layer fade never runs (2026-07-14).
    expect(base).toContain('transition-[opacity,display,overlay]');
    expect(base).toContain('transition-discrete');
    expect(base).toContain('duration-[var(--blocks-tooltip-duration)]');
    expect(base).toContain('ease-[var(--blocks-tooltip-easing)]');
    expect(base).toContain('motion-reduce:duration-[1ms]');
  });

  it('drives visibility through the opacity axis (with the @starting-style enter state)', () => {
    const openBase = tooltipVariants({ open: true }).base();
    expect(openBase).toContain('opacity-100');
    // The @starting-style before-state showPopover() needs for the enter fade.
    expect(openBase).toContain('starting:opacity-0');
    expect(tooltipVariants({ open: false }).base()).toContain('opacity-0');
  });

  it('applies intent-specific surface + text classes', () => {
    const primary = tooltipVariants({ intent: 'primary' }).base();
    expect(primary).toContain('bg-primary');
    expect(primary).toContain('text-text-on-primary');

    const danger = tooltipVariants({ intent: 'danger' }).base();
    expect(danger).toContain('bg-danger');
  });

  it('applies size-specific padding + text scale', () => {
    expect(tooltipVariants({ size: 'sm' }).base()).toContain('text-xs');
    expect(tooltipVariants({ size: 'lg' }).base()).toContain('text-base');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = tooltipVariants({ intent });
      expect(styles.base()).not.toMatch(/\bdark:/);
      expect(styles.arrow()).not.toMatch(/\bdark:/);
    }
  });
});

describe('tooltipVariants — palette scope', () => {
  it('carries the standard six-value palette, without the feedback-only info', () => {
    // `info` belongs to Alert/Toast (feedback), not to a container primitive —
    // see docs/COMPONENT-API-CONVENTIONS.md §intent. It also rendered one hue
    // step from `primary`, so it implied a distinction it could not show.
    const intents = Object.keys(
      (tooltipVariants as unknown as { config: { variants: { intent: Record<string, unknown> } } })
        .config.variants.intent
    );
    expect(intents.sort()).toEqual(
      ['danger', 'neutral', 'primary', 'secondary', 'success', 'warning'].sort()
    );
  });
});
