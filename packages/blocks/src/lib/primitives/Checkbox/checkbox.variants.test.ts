import { describe, expect, it } from 'vitest';
import { checkboxVariants } from './checkbox.variants';

const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
const VARIANTS = ['outlined', 'filled', 'ghost'] as const;

describe('checkboxVariants', () => {
  it('uses semantic tokens for unchecked outlined state', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'outlined' });
    const box = styles.box();
    expect(box).toContain('bg-surface-base');
    expect(box).toContain('border-border-default');
  });

  it('uses subtle background for unchecked filled variant', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'filled' });
    const box = styles.box();
    expect(box).toContain('bg-surface-subtle');
    expect(box).toContain('border-border-subtle');
  });

  it('uses transparent background for unchecked ghost variant', () => {
    const styles = checkboxVariants({ checked: false, indeterminate: false, variant: 'ghost' });
    const box = styles.box();
    expect(box).toContain('bg-transparent');
    expect(box).toContain('border-transparent');
  });

  it('applies intent color when checked', () => {
    const intents = ['primary', 'secondary', 'success', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const box = checkboxVariants({ checked: true, intent }).box();
      expect(box).toContain(`bg-${intent}`);
      expect(box).toContain(`border-${intent}`);
    }
  });

  it('mirrors checked style for indeterminate', () => {
    const indeterminate = checkboxVariants({ indeterminate: true, intent: 'primary' }).box();
    expect(indeterminate).toContain('bg-primary');
    expect(indeterminate).toContain('border-primary');
  });

  it('shows icon when checked or indeterminate', () => {
    const unchecked = checkboxVariants({ checked: false, indeterminate: false }).icon();
    expect(unchecked).toContain('opacity-0');
    // Hidden by the full dash offset — the icon stays mounted so the draw-in
    // transition can run; the offset (not display) is what conceals it.
    expect(unchecked).toContain('[&_path]:[stroke-dashoffset:23px]');

    const checked = checkboxVariants({ checked: true }).icon();
    expect(checked).toContain('opacity-100');
    // The checked variant pulls the dash offset to 0 (draw-in) and must fold
    // the base's hidden offset out of the class list — same bucket, later wins.
    expect(checked).toContain('[&_path]:[stroke-dashoffset:0]');
    expect(checked).not.toContain('[&_path]:[stroke-dashoffset:23px]');

    const indeterminate = checkboxVariants({ indeterminate: true }).icon();
    expect(indeterminate).toContain('opacity-100');
    expect(indeterminate).toContain('[&_path]:[stroke-dashoffset:0]');
  });

  describe('press cue + intent interaction layer', () => {
    it('squeezes the box — the control surface — in every state', () => {
      for (const variant of VARIANTS) {
        for (const state of ['off', 'checked', 'indeterminate'] as const) {
          const box = checkboxVariants({
            variant,
            checked: state === 'checked',
            indeterminate: state === 'indeterminate'
          }).box();
          expect(box, `${variant}/${state}`).toContain('group-active:scale-95');
        }
      }
    });

    it('lists `scale` as a transitioned property (otherwise the squeeze snaps)', () => {
      expect(checkboxVariants({}).box()).toContain(
        'transition-[color,background-color,border-color,box-shadow,scale]'
      );
    });

    it('walks the hover/active token ladder on the checked box for every intent', () => {
      for (const intent of INTENTS) {
        const box = checkboxVariants({ checked: true, intent }).box();
        expect(box, intent).toContain(`bg-${intent}`);
        expect(box, intent).toContain(`group-hover:bg-${intent}-hover`);
        expect(box, intent).toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('walks the same ladder on the indeterminate box for every intent', () => {
      // The indeterminate branch is a full twin of the checked one — it used
      // to be untested, which is how the sibling gap went unnoticed.
      for (const intent of INTENTS) {
        const box = checkboxVariants({ indeterminate: true, intent }).box();
        expect(box, intent).toContain(`bg-${intent}`);
        expect(box, intent).toContain(`group-hover:bg-${intent}-hover`);
        expect(box, intent).toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('keeps the border on the base intent stop (only the fill steps)', () => {
      for (const intent of INTENTS) {
        for (const key of ['checked', 'indeterminate'] as const) {
          const box = checkboxVariants({ [key]: true, intent }).box();
          expect(box, `${key}/${intent}`).toContain(`border-${intent}`);
          expect(box, `${key}/${intent}`).not.toContain(`group-hover:border-${intent}-hover`);
        }
      }
    });

    it('leaves the unchecked box free of intent fills', () => {
      for (const intent of INTENTS) {
        const box = checkboxVariants({ checked: false, indeterminate: false, intent }).box();
        expect(box, intent).not.toContain(`group-hover:bg-${intent}-hover`);
        expect(box, intent).not.toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('steps the unchecked boundary/fill per variant on hover', () => {
      const off = { checked: false, indeterminate: false } as const;
      expect(checkboxVariants({ ...off, variant: 'outlined' }).box()).toContain(
        'group-hover:border-border-emphasis'
      );
      expect(checkboxVariants({ ...off, variant: 'filled' }).box()).toContain(
        'group-hover:border-border-default'
      );
      expect(checkboxVariants({ ...off, variant: 'ghost' }).box()).toContain(
        'group-hover:bg-surface-hover'
      );
    });
  });

  it('applies disabled state correctly', () => {
    const styles = checkboxVariants({ disabled: true });
    expect(styles.control()).toContain('opacity-50');
    expect(styles.control()).toContain('pointer-events-none');
    expect(styles.control()).toContain('cursor-not-allowed');
  });

  it('includes cursor-pointer on non-disabled control', () => {
    const control = checkboxVariants({ disabled: false }).control();
    expect(control).toContain('cursor-pointer');
  });

  it('applies error border when unchecked', () => {
    const box = checkboxVariants({ error: true, checked: false, indeterminate: false }).box();
    expect(box).toContain('border-danger');
  });

  it('uses peer-focus-visible for focus ring on box', () => {
    const box = checkboxVariants({}).box();
    expect(box).toContain('peer-focus-visible:ring-2');
    expect(box).toContain('peer-focus-visible:ring-offset-surface-base');
  });

  it('differentiates all sizes', () => {
    const xs = checkboxVariants({ size: 'xs' }).box();
    const sm = checkboxVariants({ size: 'sm' }).box();
    const md = checkboxVariants({ size: 'md' }).box();
    const lg = checkboxVariants({ size: 'lg' }).box();
    expect(xs).toContain('w-3.5');
    expect(sm).toContain('w-4');
    expect(md).toContain('w-5');
    expect(lg).toContain('w-6');
  });

  it('never outputs dark: overrides', () => {
    // Covers the indeterminate branch and every variant too: the interaction
    // layer is exactly where a `dark:` override would be tempting, and
    // semantic tokens already switch through light-dark().
    for (const intent of INTENTS) {
      for (const variant of VARIANTS) {
        for (const checked of [true, false] as const) {
          for (const indeterminate of [true, false] as const) {
            const styles = checkboxVariants({ intent, variant, checked, indeterminate });
            const where = `${intent}/${variant}/${checked}/${indeterminate}`;
            expect(styles.box(), where).not.toMatch(/\bdark:/);
            expect(styles.control(), where).not.toMatch(/\bdark:/);
            expect(styles.label(), where).not.toMatch(/\bdark:/);
          }
        }
      }
    }
  });

  describe('tier', () => {
    it('defaults to modify (input-tap surface)', () => {
      const styles = checkboxVariants({});
      expect(styles.box()).toContain('rounded-modify');
    });

    it('switches to commit on tier=commit (pill-style checklist)', () => {
      const styles = checkboxVariants({ tier: 'commit' });
      expect(styles.box()).toContain('rounded-commit');
      expect(styles.box()).not.toContain('rounded-modify');
    });

    it('produces no bare `rounded` class — token-only', () => {
      // Regression guard for the lg-size bug that hard-coded Tailwind's
      // default `rounded` (~ rounded-sm) instead of `rounded-modify`.
      // Every size should resolve through the tier token only.
      const sizes = ['xs', 'sm', 'md', 'lg'] as const;
      for (const size of sizes) {
        const box = checkboxVariants({ size }).box();
        // Must match the tier token, not the bare Tailwind utility.
        expect(box).toContain('rounded-modify');
        expect(box).not.toMatch(/\brounded(?!-)/);
      }
    });
  });
});

describe('checkboxVariants — error boundary survives hover', () => {
  it('pins the danger border against the unchecked hover step', () => {
    // Modifier prefixes live in their own conflict bucket, so a plain
    // `border-danger` never folds `group-hover:border-border-emphasis` — the
    // error boundary used to turn grey under the pointer.
    for (const variant of ['outlined', 'filled', 'ghost'] as const) {
      const box = checkboxVariants({ variant, error: true, checked: false }).box();
      expect(box).toContain('group-hover:border-danger');
    }
  });
});
