import { describe, expect, it } from 'vitest';
import { popoverMotion, popoverVariants } from './popover.variants';

describe('popoverVariants', () => {
  it('produces base classes with design tokens', () => {
    const result = popoverVariants();
    expect(result).toContain('bg-surface-elevated');
    expect(result).toContain('border-border-hairline');
    expect(result).toContain('rounded-contain');
    expect(result).toContain('shadow-[var(--blocks-shadow-md)]');
    expect(result).toContain('backdrop-blur-sm');
  });

  it('applies default md size', () => {
    const result = popoverVariants();
    expect(result).toContain('p-2');
    expect(result).toContain('min-w-48');
    expect(result).toContain('max-w-96');
    expect(result).toContain('text-sm');
  });

  it('applies sm size classes', () => {
    const result = popoverVariants({ size: 'sm' });
    expect(result).toContain('p-1');
    expect(result).toContain('min-w-32');
    expect(result).toContain('max-w-64');
    expect(result).toContain('text-xs');
  });

  it('applies lg size classes', () => {
    const result = popoverVariants({ size: 'lg' });
    expect(result).toContain('p-3');
    expect(result).toContain('min-w-64');
    expect(result).toContain('max-w-screen-sm');
    expect(result).toContain('text-base');
  });

  it('includes overflow and a keyboard-aware max-height constraint', () => {
    const result = popoverVariants();
    expect(result).toContain('overflow-y-auto');
    // Static design cap inside a min() with the live available-height var, so
    // the panel shrinks above the iOS keyboard but never exceeds the cap.
    expect(result).toContain(
      'max-h-[min(calc(100dvh-4rem),var(--blocks-overlay-available-height,100dvh))]'
    );
  });

  it('carries the enter/exit motion fragment (ACC-3 rest)', () => {
    const result = popoverVariants();
    // The discrete transition list is what keeps the panel painted through
    // hidePopover()/light dismiss; @starting-style supplies the enter
    // before-state a showPopover() un-hide otherwise lacks.
    expect(result).toContain('transition-[opacity,scale,display,overlay]');
    expect(result).toContain('transition-discrete');
    expect(result).toContain('duration-[var(--blocks-popover-duration)]');
    expect(result).toContain('ease-[var(--blocks-popover-easing)]');
    expect(result).toContain('motion-reduce:duration-[1ms]');
    expect(result).toContain('data-[state=closed]:opacity-0');
    expect(result).toContain('starting:data-[state=open]:opacity-0');
  });

  it('exports the motion fragment standalone for Menu (which re-applies it after unstyled)', () => {
    // Menu strips popoverVariants via `unstyled` (double-surface avoidance)
    // and re-applies exactly this fragment via Popover's `class` prop — the
    // base must therefore contain the fragment verbatim, not a variation.
    expect(popoverVariants()).toContain(popoverMotion);
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const result = popoverVariants({ size });
      expect(result).not.toMatch(/\bdark:/);
    }
  });
});
