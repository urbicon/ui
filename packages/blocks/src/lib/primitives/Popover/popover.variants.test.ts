import { describe, expect, it } from 'vitest';
import { popoverVariants } from './popover.variants';

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

  it('includes overflow and max-height constraints', () => {
    const result = popoverVariants();
    expect(result).toContain('overflow-y-auto');
    expect(result).toContain('max-h-[calc(100dvh-4rem)]');
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const result = popoverVariants({ size });
      expect(result).not.toMatch(/\bdark:/);
    }
  });
});
