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
      expect(base).not.toContain('active:scale-[0.98]');
    });

    it('presses AWAY from whatever the variant rests at', () => {
      // The switch takes the movement out, not the feedback — so the depth step
      // has to be a step, and "one step down everywhere" is the wrong rule: the
      // resting value differs per variant. `sm` is the step for everything
      // resting at `none`; `outlined` is the only combination resting at `sm`
      // with no fill of its own to darken, so it steps down instead. Whether the
      // resolved values actually differ is a question for the browser —
      // `e2e/interaction-tokens.spec.ts` asks it.
      const press = (base: string) =>
        base.includes('active:shadow-[var(--blocks-shadow-xs)]')
          ? 'xs'
          : base.includes('active:shadow-[var(--blocks-shadow-sm)]')
            ? 'sm'
            : 'none';

      expect(press(buttonVariants({ variant: 'ghost' }).base())).toBe('sm');
      expect(press(buttonVariants({ variant: 'text' }).base())).toBe('sm');
      expect(press(buttonVariants({ variant: 'filled' }).base())).toBe('sm');
      // Rests at sm → steps down.
      expect(press(buttonVariants({ variant: 'outlined' }).base())).toBe('xs');
      // …unless a connected group already flattened its resting value to none,
      // where stepping down would be the weaker of the two directions.
      expect(
        press(buttonVariants({ variant: 'outlined', buttonGroupConnected: true }).base())
      ).toBe('sm');
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

  describe('the box holds the label (#393)', () => {
    // Whether a label actually stays inside its box is a layout question —
    // `e2e/button-overflow.spec.ts` measures it. This is the class contract
    // behind it: nothing may clip the button, and the content slot must be
    // allowed to shrink so truncation can be opted into.
    it('never clips its own overflow', () => {
      for (const variant of ['filled', 'outlined', 'ghost', 'text'] as const) {
        const base = buttonVariants({ variant, loading: true }).base();
        expect(base, variant).not.toMatch(/\boverflow-(hidden|clip|auto|scroll)\b/);
        // No explicit floor either: the automatic minimum of an unclipped flex
        // item is already `min-content`, the label under `whitespace-nowrap`.
        expect(base, variant).not.toMatch(/\bmin-w-min\b/);
      }
    });

    it('lets the content slot shrink below its label', () => {
      expect(buttonVariants({}).content()).toMatch(/\bmin-w-0\b/);
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

  describe('border vs. fill', () => {
    const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    // `border-primary` is a prefix of `border-primary-active`, so a substring
    // check cannot tell the resting stop from the interaction stops.
    const restingBorder = (base: string, intent: string) =>
      new RegExp(`(^| )border-${intent}( |$)`).test(base);

    it('leaves a filled button no border colour to fall behind its fill', () => {
      for (const intent of INTENTS) {
        const base = buttonVariants({ intent, variant: 'filled' }).base();
        expect(base, intent).toContain('border-transparent');
        expect(restingBorder(base, intent), intent).toBe(false);
        // The fill still walks the ladder — that is what carries the state.
        expect(base, intent).toContain(`hover:bg-${intent}-hover`);
        expect(base, intent).toContain(`active:bg-${intent}-active`);
      }
    });

    it('holds it transparent through the modelled active state', () => {
      for (const intent of INTENTS) {
        const base = buttonVariants({ intent, variant: 'filled', active: true }).base();
        expect(base, intent).toContain('border-transparent');
        expect(base, intent).not.toContain(`border-${intent}-active`);
      }
    });

    it('still paints the connected-group divider — a boundary, not a copy of a fill', () => {
      // The compound has to win the bucket over `variant.filled`'s transparent,
      // which is what the `not.toContain` pins: it is declared later, so it
      // folds it. Without that the `-ml-px` overlap renders nothing (BGR-1).
      for (const intent of INTENTS) {
        const base = buttonVariants({
          intent,
          variant: 'filled',
          buttonGroupConnected: true
        }).base();
        expect(base, intent).toContain(`border-${intent}-active`);
        expect(base, intent).not.toContain('border-transparent');
      }
    });

    it('moves an active outlined border with its fill, since there the border IS the variant', () => {
      for (const intent of INTENTS) {
        const base = buttonVariants({ intent, variant: 'outlined', active: true }).base();
        expect(restingBorder(base, intent), intent).toBe(true);
        expect(base, intent).toContain(`hover:border-${intent}-hover`);
      }
    });

    // The general form of the rule — "no border on the resting stop while the
    // fill steps off it" — is NOT stated here. It was, as a matrix loop over
    // this component, and that version was worthless twice over: it could only
    // see Button, and its own filters skipped every filled cell the moment the
    // fix landed. It now lives in style/intent-fill-border.test.ts, across all
    // five filled-intent surfaces and with a control on the oracle itself.
    // What stays here are the four Button-specific consequences above.
    //
    // Note what the first assertion pins shut: `border-transparent` for every
    // filled intent. `warning` is the one intent whose filled surface does not
    // clear the 3:1 non-text floor against a light page (2.22–2.31:1 across
    // themes, measured — and no gate covers that direction; contrast.test.ts
    // measures label-on-fill). A darker border WOULD fix it (border-warning-
    // active reaches 4.13:1), so if that case is ever taken up, this test is
    // the thing that has to be argued with first. That is deliberate: the
    // border would then be a boundary carrying contrast, not a copy of the
    // fill, and the difference should be stated rather than discovered.
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
