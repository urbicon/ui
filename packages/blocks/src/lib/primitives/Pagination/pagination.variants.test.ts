import { describe, expect, it } from 'vitest';
import { paginationVariants } from './pagination.variants';

describe('paginationVariants', () => {
  it('provides all slot functions', () => {
    const styles = paginationVariants();
    for (const slot of ['base', 'info', 'controls', 'ellipsis'] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('applies layout-specific alignment + resets the info margin where the info moves', () => {
    expect(paginationVariants({ layout: 'navigation' }).base()).toContain('justify-between');

    const table = paginationVariants({ layout: 'table' });
    expect(table.base()).toContain('flex-col');
    expect(table.base()).toContain('sm:flex-row');
    expect(table.info()).toContain('ml-0');

    const minimal = paginationVariants({ layout: 'minimal' });
    expect(minimal.base()).toContain('justify-center');
    expect(minimal.info()).toContain('ml-0');
  });

  it('scales the ellipsis cell with size (text scale is the unique per-size marker)', () => {
    expect(paginationVariants({ size: 'sm' }).ellipsis()).toContain('text-sm');
    expect(paginationVariants({ size: 'md' }).ellipsis()).toContain('text-base');

    const lg = paginationVariants({ size: 'lg' }).ellipsis();
    expect(lg).toContain('text-lg');
    expect(lg).toContain('min-w-12');
  });

  it('signals disabled + loading through opacity', () => {
    const disabled = paginationVariants({ disabled: true }).base();
    expect(disabled).toContain('opacity-50');
    expect(disabled).toContain('pointer-events-none');
    expect(paginationVariants({ loading: true }).base()).toContain('opacity-75');
  });

  it('uses semantic text tokens and never emits dark: overrides', () => {
    const styles = paginationVariants();
    expect(styles.info()).toContain('text-text-tertiary');
    expect(styles.ellipsis()).toContain('text-text-tertiary');
    for (const slot of ['base', 'info', 'controls', 'ellipsis'] as const) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
