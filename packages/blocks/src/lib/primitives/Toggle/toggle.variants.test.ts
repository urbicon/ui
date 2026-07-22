import { describe, expect, it } from 'vitest';
import { toggleVariants } from './toggle.variants';

describe('toggleVariants', () => {
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
      expect(primary.track()).toContain('border-primary');

      const success = toggleVariants({ variant: 'dot', checked: true, intent: 'success' });
      expect(success.track()).toContain('bg-success');
      expect(success.track()).toContain('border-success');

      const danger = toggleVariants({ variant: 'dot', checked: true, intent: 'danger' });
      expect(danger.track()).toContain('bg-danger');
      expect(danger.track()).toContain('border-danger');
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
    const variantValues = ['default', 'dot'] as const;
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const variant of variantValues) {
      for (const intent of intents) {
        const styles = toggleVariants({ variant, intent, checked: true });
        expect(styles.track()).not.toMatch(/\bdark:/);
        expect(styles.thumb()).not.toMatch(/\bdark:/);
        expect(styles.control()).not.toMatch(/\bdark:/);
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
