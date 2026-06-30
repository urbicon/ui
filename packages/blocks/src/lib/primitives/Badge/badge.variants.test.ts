import { describe, expect, it } from 'vitest';
import { badgeVariants } from './badge.variants';

describe('badgeVariants', () => {
  it('content slot uses the [gap:inherit] arbitrary property, not the non-existent gap-inherit utility (Codeberg #21)', () => {
    // Tailwind v4 generates no `gap-inherit` rule (the spacing scale has no
    // `inherit` member), so only the arbitrary property actually renders the
    // icon↔label gap. Guard against a refactor back to the broken class.
    const content = badgeVariants({ size: 'md' }).content();
    expect(content).toContain('[gap:inherit]');
    expect(content).not.toMatch(/\bgap-inherit\b/);
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    const variants = ['filled', 'outlined', 'soft', 'dot'] as const;

    for (const intent of intents) {
      for (const variant of variants) {
        const base = badgeVariants({ intent, variant }).base();
        expect(base).not.toMatch(/\bdark:/);
      }
    }
  });
});
