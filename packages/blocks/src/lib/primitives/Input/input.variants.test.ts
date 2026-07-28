import { describe, expect, it } from 'vitest';
import { inputVariants } from './input.variants';

describe('inputVariants', () => {
  it('uses semantic tokens for base styles', () => {
    const styles = inputVariants({ variant: 'outlined', size: 'md' });
    const base = styles.base();

    expect(base).toContain('text-text-primary');
    expect(base).toContain('bg-surface-base');
    expect(base).toContain('placeholder:text-text-quaternary');
    expect(base).toContain('duration-[var(--blocks-duration-fast)]');
  });

  it('applies filled variant with interactive background', () => {
    const styles = inputVariants({ variant: 'filled' });
    const base = styles.base();

    expect(base).toContain('bg-surface-interactive');
    expect(base).toContain('border-transparent');
    // Not `surface-hover`: that resolves to the same value as the resting
    // `surface-interactive` fill in light mode, so the hover was invisible.
    expect(base).toContain('hover:bg-surface-interactive-hover');
  });

  it('applies ghost variant with transparent background', () => {
    const styles = inputVariants({ variant: 'ghost' });
    const base = styles.base();

    expect(base).toContain('bg-transparent');
    expect(base).toContain('border-transparent');
    expect(base).toContain('hover:bg-surface-hover');
  });

  it('uses semantic tokens for disabled state', () => {
    const styles = inputVariants({ disabled: true });
    const base = styles.base();
    expect(base).toContain('opacity-50');
    expect(base).toContain('cursor-not-allowed');

    const label = styles.label();
    expect(label).toContain('text-text-disabled');
  });

  it('uses semantic border tokens for intent states', () => {
    const danger = inputVariants({ intent: 'danger' }).base();
    expect(danger).toContain('border-danger');
    expect(danger).toContain('focus-visible:ring-danger/20');

    const success = inputVariants({ intent: 'success' }).base();
    expect(success).toContain('border-success');
  });

  it('applies icon padding for compound variants', () => {
    const withLeftIcon = inputVariants({ hasLeftIcon: true, size: 'md' }).base();
    expect(withLeftIcon).toContain('pl-10');

    const withRightIcon = inputVariants({ hasRightIcon: true, size: 'lg' }).base();
    expect(withRightIcon).toContain('pr-12');
  });

  it('applies error styles overriding intent', () => {
    const styles = inputVariants({ intent: 'success', error: true, messageType: 'error' });
    const base = styles.base();
    expect(base).toContain('border-danger');

    const message = styles.message();
    expect(message).toContain('text-danger');
  });

  it('lets error beat every intent, with no losing frame left over', () => {
    // The precedence comes from the compound stage, not from `error` being
    // declared after `intent` — see the note on the first compoundVariant.
    for (const intent of ['success', 'warning'] as const) {
      const base = inputVariants({ intent, error: true }).base();
      expect(base).toContain('border-danger');
      expect(base).toContain('focus-visible:ring-danger/20');
      expect(base).not.toContain(`border-${intent}`);
      expect(base).not.toContain(`focus-visible:ring-${intent}/20`);
    }
  });

  it('keeps ghost border transparent when intent is set', () => {
    const ghost = inputVariants({ variant: 'ghost', intent: 'success' });
    const base = ghost.base();

    expect(base).toContain('border-transparent');
    expect(base).toContain('focus-visible:border-success');
  });

  it('shows error border on ghost even when intent is set', () => {
    const ghost = inputVariants({ variant: 'ghost', intent: 'success', error: true });
    const base = ghost.base();

    expect(base).toContain('border-danger');
    expect(base).not.toMatch(/(?<![a-z-:])border-transparent/);
  });

  it('applies underline variant with bottom border only', () => {
    const styles = inputVariants({ variant: 'underline' });
    const base = styles.base();

    expect(base).toContain('bg-transparent');
    expect(base).toContain('border-0');
    expect(base).toContain('border-b-2');
    expect(base).toContain('rounded-none');
    expect(base).toContain('focus-visible:ring-0');
  });

  it('shows intent color on underline bottom border', () => {
    const styles = inputVariants({ variant: 'underline', intent: 'success' });
    const base = styles.base();

    expect(base).toContain('border-success');
    expect(base).toContain('focus-visible:ring-0');
  });

  it('uses focus-visible exclusively, never focus:', () => {
    const variants = ['outlined', 'filled', 'ghost', 'underline'] as const;
    for (const variant of variants) {
      const base = inputVariants({ variant }).base();
      expect(base).toContain('focus-visible:');
      expect(base).not.toMatch(/(?<!-)focus:/);
    }
  });

  it('never outputs dark: overrides', () => {
    const variants = ['outlined', 'filled', 'ghost', 'underline'] as const;
    const intents = ['default', 'success', 'warning', 'danger'] as const;

    for (const variant of variants) {
      for (const intent of intents) {
        const styles = inputVariants({ variant, intent });
        expect(styles.base()).not.toMatch(/\bdark:/);
        expect(styles.label()).not.toMatch(/\bdark:/);
        expect(styles.message()).not.toMatch(/\bdark:/);
      }
    }
  });
});
