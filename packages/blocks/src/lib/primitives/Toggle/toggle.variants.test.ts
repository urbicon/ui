import { describe, expect, it } from 'vitest';
import { toggleVariants } from './toggle.variants';

const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
const VARIANTS = ['default', 'dot'] as const;

describe('toggleVariants', () => {
  it('renders a block-level root so stacked toggles stack (#91)', () => {
    const wrapper = toggleVariants().wrapper().split(' ');
    expect(wrapper).toContain('flex');
    expect(wrapper).not.toContain('inline-flex');
  });

  it('provides all required slot functions', () => {
    const styles = toggleVariants();
    expect(typeof styles.wrapper).toBe('function');
    expect(typeof styles.control).toBe('function');
    expect(typeof styles.track).toBe('function');
    expect(typeof styles.thumb).toBe('function');
    expect(typeof styles.label).toBe('function');
    expect(typeof styles.message).toBe('function');
  });

  it('uses design tokens for transitions', () => {
    const styles = toggleVariants();
    expect(styles.track()).toContain('duration-[var(--blocks-duration-fast)]');
    expect(styles.thumb()).toContain('duration-[var(--blocks-duration-fast)]');
  });

  it('uses focus-visible (not focus) for keyboard focus', () => {
    const track = toggleVariants().track();
    expect(track).toContain('focus-visible:');
    expect(track).not.toMatch(/(?<![a-z-])focus:/);
  });

  it('applies pill size classes (default variant)', () => {
    const md = toggleVariants({ size: 'md' });
    expect(md.track()).toContain('w-12');
    expect(md.track()).toContain('h-6');
    expect(md.thumb()).toContain('w-5');

    const lg = toggleVariants({ size: 'lg' });
    expect(lg.track()).toContain('w-14');
    expect(lg.thumb()).toContain('w-6');
  });

  // The thumb travel below is measured against the track's NOMINAL width, so
  // the track must never be shrunk by the flex row it shares with the label —
  // a squeezed track leaves the knob hanging past its right edge.
  it('keeps the track at its nominal width inside a flex row', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      expect(toggleVariants({ size }).track()).toContain('shrink-0');
    }
  });

  it('translates thumb on checked per size (default variant only)', () => {
    expect(toggleVariants({ checked: true, size: 'xs' }).thumb()).toContain('translate-x-4');
    expect(toggleVariants({ checked: true, size: 'sm' }).thumb()).toContain('translate-x-5');
    expect(toggleVariants({ checked: true, size: 'md' }).thumb()).toContain('translate-x-6');
    expect(toggleVariants({ checked: true, size: 'lg' }).thumb()).toContain('translate-x-7');
  });

  it('applies intent-coloured fill on checked (default variant)', () => {
    expect(toggleVariants({ checked: true, intent: 'primary' }).track()).toContain('bg-primary');
    expect(toggleVariants({ checked: true, intent: 'success' }).track()).toContain('bg-success');
    expect(toggleVariants({ checked: true, intent: 'danger' }).track()).toContain('bg-danger');
  });

  it('applies disabled state', () => {
    const control = toggleVariants({ disabled: true }).control();
    expect(control).toContain('opacity-50');
    expect(control).toContain('cursor-not-allowed');
  });

  // ── Interaction vocabulary (rolled out from Checkbox, W5/C) ──
  describe('press cue', () => {
    it('squeezes the track — the control surface — in every variant and state', () => {
      for (const variant of VARIANTS) {
        for (const checked of [true, false] as const) {
          expect(
            toggleVariants({ variant, checked }).track(),
            `${variant}/${checked ? 'on' : 'off'}`
          ).toContain('group-active:scale-95');
        }
      }
    });

    it('lists `scale` as a transitioned property (otherwise the squeeze snaps)', () => {
      expect(toggleVariants({}).track()).toContain(
        'transition-[color,background-color,border-color,box-shadow,scale]'
      );
    });

    it('does NOT put the cue on the thumb', () => {
      // Judgement call: the thumb already drives `translate` for the slide and
      // is `hidden` in the dot variant — a thumb-mounted cue would shrink the
      // knob in place and vanish entirely in dot mode. Guard both directions.
      for (const variant of VARIANTS) {
        for (const checked of [true, false] as const) {
          expect(toggleVariants({ variant, checked }).thumb()).not.toContain('scale-95');
        }
      }
    });
  });

  describe('intent interaction layer', () => {
    it('walks the hover/active token ladder on the checked pill for every intent', () => {
      for (const intent of INTENTS) {
        const track = toggleVariants({ variant: 'default', checked: true, intent }).track();
        expect(track, intent).toContain(`bg-${intent}`);
        expect(track, intent).toContain(`group-hover:bg-${intent}-hover`);
        expect(track, intent).toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('walks the same ladder on the checked dot for every intent', () => {
      for (const intent of INTENTS) {
        const track = toggleVariants({ variant: 'dot', checked: true, intent }).track();
        expect(track, intent).toContain(`bg-${intent}`);
        expect(track, intent).toContain(`group-hover:bg-${intent}-hover`);
        expect(track, intent).toContain(`group-active:bg-${intent}-active`);
      }
    });

    it('gives the checked track no border colour to fall behind its fill', () => {
      // Only the fill steps, so a border on the intent's resting tone would be
      // left ringing a track that has already moved — worst of all on `dot`,
      // where the whole 14px outline is curve. The slot base keeps `border
      // border-transparent`, so the geometry is unchanged and the background
      // paints under it. Same rule as Button/Checkbox/Radio; the general form
      // is asserted in style/intent-fill-border.test.ts.
      for (const variant of VARIANTS) {
        for (const intent of INTENTS) {
          const track = toggleVariants({ variant, checked: true, intent }).track();
          expect(track, `${variant}/${intent}`).toContain('border-transparent');
          expect(track, `${variant}/${intent}`).not.toMatch(
            new RegExp(`(^| )border-${intent}( |$)`)
          );
        }
      }
    });

    it('leaves the off state free of intent fills', () => {
      for (const variant of VARIANTS) {
        for (const intent of INTENTS) {
          const track = toggleVariants({ variant, checked: false, intent }).track();
          expect(track, `${variant}/${intent}`).not.toContain(`group-hover:bg-${intent}-hover`);
          expect(track, `${variant}/${intent}`).not.toContain(`group-active:bg-${intent}-active`);
        }
      }
    });
  });

  describe('off-state hover', () => {
    it('steps the pill boundary up to border-emphasis', () => {
      const track = toggleVariants({ variant: 'default', checked: false }).track();
      expect(track).toContain('group-hover:border-border-emphasis');
    });

    it('steps the dot boundary default → emphasis (the Checkbox outlined ladder)', () => {
      const track = toggleVariants({ variant: 'dot', checked: false }).track();
      expect(track).toContain('border-border-default');
      expect(track).toContain('group-hover:border-border-emphasis');
    });

    it('does not use a fill step — surface-hover/-active collapse onto surface-interactive', () => {
      // `surface-interactive` === `surface-hover` in light mode and
      // === `surface-active` in dark, so either would be a silent no-op in
      // one mode. Regression guard for a well-meaning "simplification".
      const track = toggleVariants({ variant: 'default', checked: false }).track();
      expect(track).toContain('bg-surface-interactive');
      expect(track).not.toContain('group-hover:bg-surface-hover');
      expect(track).not.toContain('group-hover:bg-surface-active');
    });

    it('withBorder pins the hover boundary at strong instead of weakening it', () => {
      const track = toggleVariants({
        variant: 'default',
        checked: false,
        withBorder: true
      }).track();
      expect(track).toContain('border-border-strong');
      expect(track).toContain('group-hover:border-border-strong');
      expect(track).not.toContain('group-hover:border-border-emphasis');
    });
  });

  describe('variant="dot"', () => {
    it('strips pill-track sizing in favour of a 14px circle', () => {
      const track = toggleVariants({ variant: 'dot' }).track();
      expect(track).toContain('w-3.5');
      expect(track).toContain('h-3.5');
      expect(track).toContain('rounded-full');
      expect(track).toContain('shadow-none');
    });

    it('hides the thumb (no slider animation in dot mode)', () => {
      const thumb = toggleVariants({ variant: 'dot' }).thumb();
      expect(thumb).toContain('hidden');
    });

    it('off state renders an outline-only dot (border, no fill)', () => {
      const track = toggleVariants({ variant: 'dot', checked: false }).track();
      expect(track).toContain('border-border-default');
      // No intent fill when off
      expect(track).not.toContain('bg-primary');
      expect(track).not.toContain('bg-success');
    });

    it('on state fills the dot in the intent colour', () => {
      const primary = toggleVariants({ variant: 'dot', checked: true, intent: 'primary' });
      expect(primary.track()).toContain('bg-primary');
      expect(primary.track()).toContain('border-transparent');

      const success = toggleVariants({ variant: 'dot', checked: true, intent: 'success' });
      expect(success.track()).toContain('bg-success');
      expect(success.track()).toContain('border-transparent');

      const danger = toggleVariants({ variant: 'dot', checked: true, intent: 'danger' });
      expect(danger.track()).toContain('bg-danger');
      expect(danger.track()).toContain('border-transparent');
    });

    it('does NOT apply the default-variant pill compounds (no thumb translate, no pill bg)', () => {
      const track = toggleVariants({ variant: 'dot', checked: false }).track();
      // default-variant checked-false compound applies bg-surface-interactive — dot must not pick it up
      expect(track).not.toContain('bg-surface-interactive');

      const thumb = toggleVariants({ variant: 'dot', checked: true, size: 'md' }).thumb();
      // default-variant pill thumb translates by size; dot hides the thumb entirely
      expect(thumb).not.toContain('translate-x-6');
    });

    it('shrinks the control min-height (denser than pill)', () => {
      const control = toggleVariants({ variant: 'dot' }).control();
      expect(control).toContain('min-h-6');
    });
  });

  it('never outputs dark: overrides', () => {
    // Covers the hover/active-bearing states too: the interaction layer is
    // exactly where a `dark:` override would be tempting, and semantic tokens
    // already switch through light-dark().
    for (const variant of VARIANTS) {
      for (const intent of INTENTS) {
        for (const checked of [true, false] as const) {
          for (const withBorder of [true, false] as const) {
            for (const error of [true, false] as const) {
              const styles = toggleVariants({ variant, intent, checked, withBorder, error });
              const where = `${variant}/${intent}/${checked}/${withBorder}/${error}`;
              expect(styles.track(), where).not.toMatch(/\bdark:/);
              expect(styles.thumb(), where).not.toMatch(/\bdark:/);
              expect(styles.control(), where).not.toMatch(/\bdark:/);
            }
          }
        }
      }
    }
  });

  it('never outputs a bare focus: modifier (keyboard-only rings)', () => {
    for (const variant of VARIANTS) {
      for (const checked of [true, false] as const) {
        const track = toggleVariants({ variant, checked }).track();
        expect(track, `${variant}/${checked}`).not.toMatch(/(?<![a-z-])focus:/);
      }
    }
  });

  describe('error', () => {
    it('paints the message danger and marks the unchecked track (mirrors Checkbox)', () => {
      const styles = toggleVariants({ error: true, checked: false });
      expect(styles.message()).toContain('text-danger');
      expect(styles.track()).toContain('border-danger');
      expect(styles.track()).toContain('peer-focus-visible:ring-danger/40');
    });

    it('keeps the intent colour on the checked track (error marks only the off state)', () => {
      const styles = toggleVariants({ error: true, checked: true, intent: 'primary' });
      expect(styles.track()).toContain('bg-primary');
      expect(styles.track()).not.toContain('border-danger');
    });

    it('dot variant gets the danger outline when unchecked', () => {
      const styles = toggleVariants({ variant: 'dot', error: true, checked: false });
      expect(styles.track()).toContain('border-danger');
    });

    it('keeps the danger boundary on hover (the off-state hover must not eat it)', () => {
      // Modifier prefixes are part of the tv() conflict bucket, so a plain
      // `border-danger` does NOT fold the unchecked compound's
      // `group-hover:border-border-emphasis` — the error compound has to pin
      // the hover bucket itself.
      for (const variant of VARIANTS) {
        const track = toggleVariants({ variant, error: true, checked: false }).track();
        expect(track, variant).toContain('group-hover:border-danger');
        expect(track, variant).not.toContain('group-hover:border-border-emphasis');
      }
    });

    it('holds the pin even with withBorder (error outranks the strong boundary)', () => {
      const track = toggleVariants({
        variant: 'default',
        error: true,
        checked: false,
        withBorder: true
      }).track();
      expect(track).toContain('border-danger');
      expect(track).toContain('group-hover:border-danger');
      expect(track).not.toContain('group-hover:border-border-strong');
    });
  });

  describe('tier', () => {
    it('defaults to commit (Pill switch)', () => {
      const styles = toggleVariants({});
      expect(styles.track()).toContain('rounded-commit');
      expect(styles.thumb()).toContain('rounded-commit');
    });

    it('switches to modify on tier=modify (compact rectangle)', () => {
      const styles = toggleVariants({ tier: 'modify' });
      expect(styles.track()).toContain('rounded-modify');
      expect(styles.thumb()).toContain('rounded-modify');
      expect(styles.track()).not.toContain('rounded-commit');
      expect(styles.thumb()).not.toContain('rounded-commit');
    });
  });
});
