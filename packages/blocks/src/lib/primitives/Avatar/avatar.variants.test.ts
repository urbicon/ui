import { describe, expect, it } from 'vitest';
import { avatarVariants } from './avatar.variants';

describe('avatarVariants', () => {
  // Regression guard for the AVT-1 clipping fix: the clip lives on `frame`, and
  // `base` must stay clip-free so the status dot (a sibling of `frame`) is never
  // cut into a crescent.
  it('confines overflow-hidden to the frame, never the base — for every shape', () => {
    for (const variant of ['circle', 'rounded', 'square'] as const) {
      const styles = avatarVariants({ variant });
      expect(styles.frame()).toContain('overflow-hidden');
      expect(styles.base()).not.toContain('overflow-hidden');
    }
  });

  it('paints the intent fill on the frame, not the base', () => {
    const styles = avatarVariants({ intent: 'primary' });
    expect(styles.frame()).toContain('bg-primary-subtle');
    expect(styles.frame()).toContain('text-primary-emphasis');
    expect(styles.base()).not.toContain('bg-primary-subtle');
  });

  it('gives the frame a neutral surface fill by default (no intent)', () => {
    const styles = avatarVariants({ intent: 'neutral' });
    expect(styles.frame()).toContain('bg-surface-interactive');
    expect(styles.frame()).toContain('text-text-secondary');
    expect(styles.base()).not.toContain('bg-surface-interactive');
  });

  it('mirrors the shape radius onto both base (for the ring) and frame (for the clip)', () => {
    for (const [variant, radius] of [
      ['circle', 'rounded-full'],
      ['rounded', 'rounded-xl'],
      ['square', 'rounded-none']
    ] as const) {
      const styles = avatarVariants({ variant });
      expect(styles.base()).toContain(radius);
      expect(styles.frame()).toContain(radius);
    }
  });

  it('keeps the ring on the outer base element', () => {
    const styles = avatarVariants({ ring: true, ringIntent: 'success' });
    expect(styles.base()).toContain('ring-2');
    expect(styles.base()).toContain('ring-success');
  });

  it('publishes a matching pulse colour for every status', () => {
    for (const [status, token] of [
      ['online', 'var(--color-success)'],
      ['offline', 'var(--color-text-quaternary)'],
      ['away', 'var(--color-warning)'],
      ['busy', 'var(--color-danger)']
    ] as const) {
      const dot = avatarVariants({ status }).status();
      expect(dot).toContain(`[--blocks-avatar-pulse-color:${token}]`);
    }
  });

  it('adds the pulse animation class only when pulse is set', () => {
    expect(avatarVariants({ status: 'online', pulse: true }).status()).toContain(
      'blocks-avatar-status-pulse'
    );
    expect(avatarVariants({ status: 'online' }).status()).not.toContain(
      'blocks-avatar-status-pulse'
    );
    expect(avatarVariants({ status: 'online', pulse: false }).status()).not.toContain(
      'blocks-avatar-status-pulse'
    );
  });
});
