import { describe, expect, it } from 'vitest';
import { radioGroupVariants, radioItemVariants } from './radioGroup.variants';

const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
const VARIANTS = ['outlined', 'filled', 'ghost'] as const;

describe('radioGroupVariants', () => {
  it('produces vertical layout by default', () => {
    const group = radioGroupVariants({}).group();
    expect(group).toContain('flex-col');
  });

  it('produces horizontal layout when specified', () => {
    const group = radioGroupVariants({ orientation: 'horizontal' }).group();
    expect(group).toContain('flex-row');
  });

  it('applies required asterisk to label', () => {
    const label = radioGroupVariants({ required: true }).label();
    expect(label).toContain("after:content-['*']");
    expect(label).toContain('after:text-danger');
  });

  it('applies error style to message', () => {
    const message = radioGroupVariants({ error: true }).message();
    expect(message).toContain('text-danger');
  });
});

describe('radioItemVariants', () => {
  it('uses semantic tokens for unchecked outlined state', () => {
    const styles = radioItemVariants({ checked: false, variant: 'outlined' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-surface-base');
    expect(indicator).toContain('border-border-default');
  });

  it('uses subtle background for unchecked filled variant', () => {
    const styles = radioItemVariants({ checked: false, variant: 'filled' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-surface-subtle');
    expect(indicator).toContain('border-border-subtle');
  });

  it('uses transparent background for unchecked ghost variant', () => {
    const styles = radioItemVariants({ checked: false, variant: 'ghost' });
    const indicator = styles.indicator();
    expect(indicator).toContain('bg-transparent');
    expect(indicator).toContain('border-transparent');
  });

  it('applies intent color when checked', () => {
    const intents = ['primary', 'secondary', 'success', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const indicator = radioItemVariants({ checked: true, intent }).indicator();
      expect(indicator).toContain(`bg-${intent}`);
      expect(indicator).toContain('border-transparent');
    }
  });

  // ── Interaction vocabulary (rolled out from Checkbox, W5/C) ──
  describe('press cue', () => {
    it('squeezes the indicator — the control surface — in every state', () => {
      for (const variant of VARIANTS) {
        for (const checked of [true, false] as const) {
          expect(
            radioItemVariants({ variant, checked }).indicator(),
            `${variant}/${checked ? 'on' : 'off'}`
          ).toContain('group-active:scale-95');
        }
      }
    });

    it('lists `scale` as a transitioned property (otherwise the squeeze snaps)', () => {
      expect(radioItemVariants({}).indicator()).toContain(
        'transition-[color,background-color,border-color,box-shadow,scale]'
      );
    });

    it('does NOT put the cue on the dot (it owns the scale bucket for its check-in)', () => {
      for (const checked of [true, false] as const) {
        expect(radioItemVariants({ checked }).dot()).not.toContain('group-active:scale-95');
      }
      // The dot's own animation must survive untouched.
      expect(radioItemVariants({ checked: false }).dot()).toContain('scale-0');
      expect(radioItemVariants({ checked: true }).dot()).toContain('scale-100');
    });

    it('transitions the dot on `scale`, not `transform`', () => {
      // Tailwind 4 compiles `scale-*` to the discrete `scale` property, which
      // `transition-property: transform` does not cover — the check-in used
      // to pop instantly with only the opacity fading.
      const dot = radioItemVariants({}).dot();
      expect(dot).toContain('transition-[opacity,scale]');
      expect(dot).not.toContain('transition-[opacity,transform]');
    });
  });

  describe('intent interaction layer', () => {
    it('walks the hover/active token ladder on the checked indicator for every intent', () => {
      for (const intent of INTENTS) {
        const indicator = radioItemVariants({ checked: true, intent }).indicator();
        expect(indicator, intent).toContain(`bg-${intent}`);
        expect(indicator, intent).toContain(`group-hover:bg-${intent}-hover`);
        expect(indicator, intent).toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('gives the filled indicator no border colour to fall behind its fill', () => {
      // Same rule as Checkbox and Button: only the fill steps, so a border on
      // the intent's resting tone would be left ringing a darkened indicator.
      for (const intent of INTENTS) {
        const indicator = radioItemVariants({ checked: true, intent }).indicator();
        expect(indicator, intent).toContain('border-transparent');
        expect(indicator, intent).not.toMatch(new RegExp(`(^| )border-${intent}( |$)`));
      }
    });

    it('holds the dot at one on-colour across base/hover/active', () => {
      // style/contrast.test.ts measures `--color-<intent>` / `-hover` /
      // `-active` against the intent's paired on-colour for every theme ×
      // mode and asserts AA — including warning/light/active, where the fill
      // darkens toward the dark `text-on-warning`. So the dot needs no
      // state-dependent colour; asserting the absence keeps it that way.
      for (const intent of INTENTS) {
        const dot = radioItemVariants({ checked: true, intent }).dot();
        const expected =
          intent === 'warning'
            ? 'bg-text-on-warning'
            : intent === 'primary'
              ? 'bg-text-on-primary'
              : 'bg-text-on-fill';
        // Exact token, not `toContain`: `'bg-text-on-fillx'.includes('bg-text-on-fill')`
        // is true, and `variants:lint` does not guard the `bg-` namespace (only
        // text-/rounded-/shadow-/blur-/tracking-/leading-/ease- — see
        // scripts/theme-tokens.ts), so a typo here would render with no colour
        // and pass both gates.
        expect(dot.split(/\s+/), intent).toContain(expected);
        expect(dot, intent).not.toMatch(/group-(hover|active):bg-/);
      }
    });

    it('leaves the unchecked indicator free of intent fills', () => {
      for (const intent of INTENTS) {
        const indicator = radioItemVariants({ checked: false, intent }).indicator();
        expect(indicator, intent).not.toContain(`group-hover:bg-${intent}-hover`);
        expect(indicator, intent).not.toContain(`group-active:bg-${intent}-active`);
      }
    });
  });

  describe('unchecked hover', () => {
    it('steps the boundary/fill per variant (identical to Checkbox)', () => {
      expect(radioItemVariants({ checked: false, variant: 'outlined' }).indicator()).toContain(
        'group-hover:border-border-emphasis'
      );
      expect(radioItemVariants({ checked: false, variant: 'filled' }).indicator()).toContain(
        'group-hover:border-border-default'
      );
      expect(radioItemVariants({ checked: false, variant: 'ghost' }).indicator()).toContain(
        'group-hover:bg-surface-hover'
      );
    });

    it('keeps the danger boundary on hover when in error', () => {
      // Modifier prefixes are part of the tv() conflict bucket, so a plain
      // `border-danger` does NOT fold the unchecked compound's
      // `group-hover:border-*` step — the error compound pins it itself.
      for (const variant of VARIANTS) {
        const indicator = radioItemVariants({ error: true, checked: false, variant }).indicator();
        expect(indicator, variant).toContain('group-hover:border-danger');
        expect(indicator, variant).not.toContain('group-hover:border-border-emphasis');
        expect(indicator, variant).not.toContain('group-hover:border-border-default');
      }
    });
  });

  it('shows dot when checked', () => {
    const unchecked = radioItemVariants({ checked: false }).dot();
    expect(unchecked).toContain('opacity-0');
    expect(unchecked).toContain('scale-0');

    const checked = radioItemVariants({ checked: true }).dot();
    expect(checked).toContain('opacity-100');
    expect(checked).toContain('scale-100');
  });

  it('applies disabled state correctly', () => {
    const styles = radioItemVariants({ disabled: true });
    expect(styles.item()).toContain('opacity-50');
    expect(styles.item()).toContain('pointer-events-none');
    expect(styles.item()).toContain('cursor-not-allowed');
  });

  it('includes cursor-pointer on non-disabled item', () => {
    const item = radioItemVariants({ disabled: false }).item();
    expect(item).toContain('cursor-pointer');
  });

  it('applies error border when unchecked', () => {
    const indicator = radioItemVariants({ error: true, checked: false }).indicator();
    expect(indicator).toContain('border-danger');
  });

  it('uses peer-focus-visible for focus ring on indicator', () => {
    const indicator = radioItemVariants({}).indicator();
    expect(indicator).toContain('peer-focus-visible:ring-2');
    expect(indicator).toContain('peer-focus-visible:ring-offset-surface-base');
  });

  it('uses the control radius for the radio indicator', () => {
    const indicator = radioItemVariants({}).indicator();
    // `rounded-control`, not `rounded-commit`: since 2026-07-31 the circle is
    // independent of the pill, so a theme squaring its buttons keeps the "pick
    // exactly one" affordance. See style/control-radius.test.ts.
    expect(indicator).toContain('rounded-control');
  });

  it('differentiates all sizes', () => {
    const xs = radioItemVariants({ size: 'xs' }).indicator();
    const sm = radioItemVariants({ size: 'sm' }).indicator();
    const md = radioItemVariants({ size: 'md' }).indicator();
    const lg = radioItemVariants({ size: 'lg' }).indicator();
    expect(xs).toContain('w-3.5');
    expect(sm).toContain('w-4');
    expect(md).toContain('w-5');
    expect(lg).toContain('w-6');
  });

  it('never outputs dark: overrides', () => {
    // Covers the hover/active-bearing states too: the interaction layer is
    // exactly where a `dark:` override would be tempting, and semantic tokens
    // already switch through light-dark().
    for (const intent of INTENTS) {
      for (const variant of VARIANTS) {
        for (const checked of [true, false] as const) {
          for (const error of [true, false] as const) {
            const styles = radioItemVariants({ intent, variant, checked, error });
            const where = `${intent}/${variant}/${checked}/${error}`;
            expect(styles.indicator(), where).not.toMatch(/\bdark:/);
            expect(styles.dot(), where).not.toMatch(/\bdark:/);
            expect(styles.item(), where).not.toMatch(/\bdark:/);
            expect(styles.label(), where).not.toMatch(/\bdark:/);
          }
        }
      }
    }
  });

  it('never outputs a bare focus: modifier (keyboard-only rings)', () => {
    for (const variant of VARIANTS) {
      for (const checked of [true, false] as const) {
        const indicator = radioItemVariants({ variant, checked }).indicator();
        expect(indicator, `${variant}/${checked}`).toContain('peer-focus-visible:');
        expect(indicator, `${variant}/${checked}`).not.toMatch(/(?<![a-z-])focus:/);
      }
    }
  });

  describe('tier', () => {
    it('defaults to commit (circle indicator)', () => {
      const styles = radioItemVariants({});
      expect(styles.indicator()).toContain('rounded-control');
      expect(styles.dot()).toContain('rounded-control');
    });

    it('switches to modify on tier=modify (soft-rectangle indicator)', () => {
      const styles = radioItemVariants({ tier: 'modify' });
      expect(styles.indicator()).toContain('rounded-modify');
      expect(styles.dot()).toContain('rounded-modify');
      expect(styles.indicator()).not.toContain('rounded-control');
      expect(styles.dot()).not.toContain('rounded-control');
    });
  });
});
