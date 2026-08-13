import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button.variants';

describe('buttonVariants', () => {
  it('produces base classes with design tokens', () => {
    const styles = buttonVariants({ intent: 'primary', variant: 'filled', size: 'md' });
    const base = styles.base();

    expect(base).toContain('duration-[var(--blocks-duration-fast)]');
    expect(base).toContain('shadow-[var(--blocks-shadow-sm)]');
    expect(base).toContain('hover:shadow-[var(--blocks-shadow-md)]');
    expect(base).toContain('focus-visible:ring-primary/50');
  });

  it('uses shadow tokens for all intents', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;

    for (const intent of intents) {
      const base = buttonVariants({ intent, variant: 'filled', size: 'md' }).base();
      expect(base).toContain('shadow-[var(--blocks-shadow-sm)]');
      expect(base).not.toMatch(/(?<!\[var\(--blocks-)shadow-sm/);
    }
  });

  it('applies correct classes for each variant', () => {
    const filled = buttonVariants({ intent: 'primary', variant: 'filled' }).base();
    expect(filled).toContain('bg-primary');
    expect(filled).toContain('text-text-on-primary');

    const outlined = buttonVariants({ intent: 'primary', variant: 'outlined' }).base();
    expect(outlined).toContain('text-primary');
    expect(outlined).toContain('border-primary');

    const ghost = buttonVariants({ intent: 'primary', variant: 'ghost' }).base();
    expect(ghost).toContain('text-primary');
    expect(ghost).toContain('shadow-none');
  });

  it('applies size classes correctly', () => {
    const sm = buttonVariants({ size: 'sm' }).base();
    expect(sm).toContain('h-8');
    expect(sm).toContain('text-sm');

    const lg = buttonVariants({ size: 'lg' }).base();
    expect(lg).toContain('h-12');
    expect(lg).toContain('text-lg');
  });

  it('uses design tokens not hardcoded values for pressed state', () => {
    const pressed = buttonVariants({ pressed: true }).base();
    expect(pressed).toContain('shadow-[var(--blocks-shadow-xs)]');
  });

  describe('press cue (#192)', () => {
    it('sinks on :active by default, through the reduced-motion-aware token', () => {
      // The literal 0.98 would be invisible to `prefers-reduced-motion`; the
      // token is what interaction.css flattens to 1 there. A test asserting the
      // literal would pass on a cue nobody can turn off.
      const base = buttonVariants({}).base();
      expect(base).toContain('active:scale-[var(--blocks-press-scale)]');
      expect(base).toContain('active:shadow-[var(--blocks-shadow-sm)]');
      expect(base).not.toContain('active:scale-[0.98]');
    });

    it('keeps the press DEPTH step on every variant, flat ones included', () => {
      // The switch takes the movement out, not the feedback. A quiet outlined or
      // ghost button — `outlined` is the ButtonGroup default — has no fill to
      // darken, so without this step a click on it would report nothing at all.
      for (const variant of ['filled', 'outlined', 'ghost', 'text'] as const) {
        expect(buttonVariants({ variant }).base()).toContain(
          'active:shadow-[var(--blocks-shadow-sm)]'
        );
      }
    });

    it('shares the token with the modelled `pressed` state', () => {
      // Reduced motion takes the size change out of both; brightness + shadow
      // keep carrying the modelled state, which is not click feedback and so is
      // never silenced by `mint="none"`.
      const held = buttonVariants({ pressed: true }).base();
      expect(held).toContain('scale-[var(--blocks-press-scale)]');
      expect(held).toContain('brightness-90');
    });

    it('exposes no variant axis for the switch — it must not become a public prop', () => {
      // Every tv() axis is promoted to a documented prop by docs-gen and reaches
      // the element through restProps; a `pressCue` axis would therefore ship as
      // `<Button pressCue>` and stamp a stray `presscue` attribute while doing
      // nothing (Button never destructures it). The token carries the switch
      // instead, so there is no axis to promote.
      expect(Object.keys(buttonVariants.config.variants ?? {})).not.toContain('pressCue');
    });

    it('keeps the per-intent focus ring after the depth cues moved off the intent axis', () => {
      const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
      for (const intent of intents) {
        expect(buttonVariants({ intent }).base()).toContain(`focus-visible:ring-${intent}/50`);
      }
    });

    it('still lets a flat variant win the resting shadow bucket', () => {
      // The resting/hover depth moved from the intent axis into `base`; ghost
      // and text drop it again from a LATER axis, so they must still come out flat.
      expect(buttonVariants({ variant: 'ghost' }).base()).toContain('shadow-none');
      expect(buttonVariants({ variant: 'text' }).base()).toContain('shadow-none');
    });
  });

  it('content slot uses the [gap:inherit] arbitrary property, not the non-existent gap-inherit utility (Codeberg #21)', () => {
    // Tailwind v4 generates no `gap-inherit` rule (the spacing scale has no
    // `inherit` member), so only the arbitrary property actually renders the
    // icon↔label gap. Guard against a refactor back to the broken class.
    const content = buttonVariants({ size: 'md' }).content();
    expect(content).toContain('[gap:inherit]');
    expect(content).not.toMatch(/\bgap-inherit\b/);
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    const variants = ['filled', 'outlined', 'ghost', 'text'] as const;

    for (const intent of intents) {
      for (const variant of variants) {
        const base = buttonVariants({ intent, variant }).base();
        expect(base).not.toMatch(/\bdark:/);
      }
    }
  });
});
