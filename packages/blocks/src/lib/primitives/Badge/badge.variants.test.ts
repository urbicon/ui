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

  it('never lets the remove button outgrow the badge it sits in', () => {
    // The slot's frozen `<Button size="xs">` fold carries `h-6` on no size axis,
    // so an xs badge (h-4) shipped a 24px ✕ inside a 16px element.
    const heights: Record<string, number> = { 'h-3': 12, 'h-4': 16, 'h-5': 20, 'h-6': 24 };
    const badge: Record<string, number> = { xs: 16, sm: 20, md: 24, lg: 28 };

    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const cls = badgeVariants({ size, removable: true }).removeButton();
      const found = Object.keys(heights).filter((h) => new RegExp(`\\b${h}\\b`).test(cls));
      expect(
        found,
        `${size}: expected exactly one height class, got ${found.join(', ')}`
      ).toHaveLength(1);
      expect(heights[found[0]], `${size}: ✕ must fit inside the badge`).toBeLessThanOrEqual(
        badge[size]
      );
    }
  });

  it('leaves the md and lg remove button at h-6 (removable VR baseline)', () => {
    // Only the overflowing sizes were re-scaled; md/lg already fit, and moving
    // them would churn the baseline for no defect.
    for (const size of ['md', 'lg'] as const) {
      expect(badgeVariants({ size, removable: true }).removeButton()).toMatch(/\bh-6\b/);
    }
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
