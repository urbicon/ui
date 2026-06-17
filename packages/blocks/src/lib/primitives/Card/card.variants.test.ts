import { describe, expect, it } from 'vitest';
import { cardVariants } from './card.variants';

describe('cardVariants', () => {
  it('provides all required slot functions', () => {
    const styles = cardVariants();
    expect(typeof styles.base).toBe('function');
    expect(typeof styles.header).toBe('function');
    expect(typeof styles.content).toBe('function');
    expect(typeof styles.footer).toBe('function');
  });

  it('uses contain-tier radius (cards are architectural surfaces, not CTAs)', () => {
    expect(cardVariants().base()).toContain('rounded-contain');
  });

  it('defaults to quiet variant — reading-flow surface', () => {
    const explicitQuiet = cardVariants({ variant: 'quiet' }).base();
    const fallback = cardVariants({}).base();
    expect(fallback).toBe(explicitQuiet);
    expect(fallback).toContain('bg-surface-quiet');
  });

  it('outlined variant uses transparent background with a default border', () => {
    const base = cardVariants({ variant: 'outlined' }).base();
    expect(base).toContain('bg-transparent');
    expect(base).toContain('border-border-default');
  });

  it('elevated variant uses surface-elevated + md shadow', () => {
    const base = cardVariants({ variant: 'elevated' }).base();
    expect(base).toContain('bg-surface-elevated');
    expect(base).toContain('shadow-[var(--blocks-shadow-md)]');
  });

  it('elevated variant does NOT animate shadow on hover unless interactive (WCAG 3.2)', () => {
    const nonInteractive = cardVariants({ variant: 'elevated', interactive: false }).base();
    expect(nonInteractive).not.toContain('hover:shadow-[var(--blocks-shadow-lg)]');

    const interactive = cardVariants({ variant: 'elevated', interactive: true }).base();
    expect(interactive).toContain('hover:shadow-[var(--blocks-shadow-lg)]');
  });

  it('floating variant uses lg shadow — popover-family weight', () => {
    const base = cardVariants({ variant: 'floating' }).base();
    expect(base).toContain('bg-surface-elevated');
    expect(base).toContain('shadow-[var(--blocks-shadow-lg)]');
  });

  it('dividers default false — header/footer flush against body', () => {
    const noDividers = cardVariants({});
    expect(noDividers.header()).not.toContain('border-b');
    expect(noDividers.footer()).not.toContain('border-t');
  });

  it('dividers=true adds hairline separators (Lighter token, not subtle)', () => {
    const styles = cardVariants({ dividers: true });
    expect(styles.header()).toContain('border-b');
    expect(styles.header()).toContain('border-border-hairline');
    expect(styles.footer()).toContain('border-t');
    expect(styles.footer()).toContain('border-border-hairline');
  });

  it('interactive adds cursor-pointer and a subtle lift', () => {
    const base = cardVariants({ interactive: true }).base();
    expect(base).toContain('cursor-pointer');
    expect(base).toContain('hover:-translate-y-0.5');
    expect(base).toContain('active:translate-y-0');
  });

  it('interactive + quiet uses hover:bg-surface-hover (no shadow lift on quiet)', () => {
    const base = cardVariants({ interactive: true, variant: 'quiet' }).base();
    expect(base).toContain('hover:bg-surface-hover');
    expect(base).not.toContain('hover:shadow-[var(--blocks-shadow-lg)]');
  });

  it('interactive button/anchor element-types add focus-visible ring', () => {
    const button = cardVariants({ interactive: true, elementType: 'button' }).base();
    expect(button).toContain('focus-visible:ring-2');
    expect(button).toContain('focus-visible:ring-primary');

    const anchor = cardVariants({ interactive: true, elementType: 'a' }).base();
    expect(anchor).toContain('focus-visible:ring-2');
  });

  it('disabled state dims and disables pointer events', () => {
    const base = cardVariants({ disabled: true }).base();
    expect(base).toContain('opacity-50');
    expect(base).toContain('pointer-events-none');
  });

  it('padding scales all slots in sync', () => {
    const md = cardVariants({ padding: 'md' });
    expect(md.base()).toContain('p-6');
    expect(md.content()).toContain('py-3');

    const none = cardVariants({ padding: 'none' });
    expect(none.base()).toContain('p-0');
    expect(none.header()).toContain('p-0');
  });

  it('never outputs dark: overrides', () => {
    const variants = ['quiet', 'outlined', 'elevated', 'floating'] as const;
    for (const variant of variants) {
      const base = cardVariants({ variant }).base();
      expect(base).not.toMatch(/\bdark:/);
    }
  });
});
