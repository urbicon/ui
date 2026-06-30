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
