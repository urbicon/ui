import { describe, expect, it } from 'vitest';
import { toastVariants } from './toast.variants';

describe('toastVariants', () => {
  it('provides all required slot functions', () => {
    const styles = toastVariants();
    expect(typeof styles.container).toBe('function');
    expect(typeof styles.toast).toBe('function');
    expect(typeof styles.icon).toBe('function');
    expect(typeof styles.content).toBe('function');
    expect(typeof styles.title).toBe('function');
    expect(typeof styles.description).toBe('function');
    expect(typeof styles.dismissButton).toBe('function');
    expect(typeof styles.progress).toBe('function');
  });

  it('uses design tokens for shadow and z-index', () => {
    const styles = toastVariants();
    expect(styles.container()).toContain('z-[var(--z-tooltip)]');
    expect(styles.toast()).toContain('shadow-[var(--blocks-shadow-lg)]');
    expect(styles.toast()).toContain('duration-[var(--blocks-duration-normal)]');
    expect(styles.toast()).toContain('ease-[var(--blocks-ease-smooth)]');
  });

  it('toast slot has relative and overflow-hidden for progress bar positioning', () => {
    const styles = toastVariants();
    expect(styles.toast()).toContain('relative');
    expect(styles.toast()).toContain('overflow-hidden');
  });

  it('applies intent-specific classes', () => {
    const success = toastVariants({ intent: 'success' });
    expect(success.icon()).toContain('text-success');
    expect(success.progress()).toContain('bg-success');

    const danger = toastVariants({ intent: 'danger' });
    expect(danger.icon()).toContain('text-danger');
    expect(danger.progress()).toContain('bg-danger');
  });

  it('applies info intent with semantic info tokens distinct from primary', () => {
    const info = toastVariants({ intent: 'info' });
    expect(info.icon()).toContain('text-info');
    expect(info.progress()).toContain('bg-info');
  });

  it('toast renders without border (intent signalled via icon + progress only)', () => {
    const intents = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const toast = toastVariants({ intent }).toast();
      // No `border` utility, no per-intent border-{name}/30, no neutral hairline
      expect(toast).not.toMatch(/(?<![a-z-])border(?![a-z-])/);
      expect(toast).not.toContain('border-hairline');
      expect(toast).toContain('bg-surface-overlay');
    }
  });

  it('applies placement-specific classes', () => {
    const topRight = toastVariants({ placement: 'top-right' });
    expect(topRight.container()).toContain('top-4');
    expect(topRight.container()).toContain('right-4');

    const bottomLeft = toastVariants({ placement: 'bottom-left' });
    expect(bottomLeft.container()).toContain('bottom-4');
    expect(bottomLeft.container()).toContain('left-4');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = toastVariants({ intent });
      expect(styles.toast()).not.toMatch(/\bdark:/);
      expect(styles.icon()).not.toMatch(/\bdark:/);
      expect(styles.progress()).not.toMatch(/\bdark:/);
    }
  });
});
