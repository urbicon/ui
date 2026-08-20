import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import NestedAccessorHarness from './__fixtures__/NestedAccessorHarness.svelte';

/**
 * Dotted accessors in the factory cells.
 *
 * `TableColumns.status('user.status', …)` hands the accessor on as a key
 * (`statusKey`, `valueKey`, `dateKey`, `urlKey`), and search, sort, group and
 * summary all resolve it through `resolveColumnValue` → `getNestedValue`.
 * The cells used to read `item[key]` flat instead, so a dotted accessor made
 * the table order itself by a value it did not show. These assertions pin
 * that the factory cells resolve through the same rule as the rest of the
 * table (#234).
 *
 * Rendered through `svelte/server` like `cell-locale.svelte.test.ts`; the
 * cells go through `NestedAccessorHarness` because their `Item` generic needs
 * a component context to instantiate. One render carries all five cells, so
 * a failing assertion names the cell through the missing string.
 */

const nested = () => render(NestedAccessorHarness, { props: { variant: 'nested' } }).body;
const controls = () => render(NestedAccessorHarness, { props: { variant: 'controls' } }).body;

describe('factory cells resolve dotted accessors', () => {
  it('StatusBadge reads a nested status', () => {
    expect(nested()).toContain('Active');
  });

  it('NumberCell reads a nested number', () => {
    expect(nested()).toContain('1,234.56');
  });

  it('DateCell reads a nested date', () => {
    expect(nested()).toContain('Mar 12, 2026');
  });

  it('LinkCell reads nested url and text', () => {
    const body = nested();
    expect(body).toContain('href="https://example.com/docs"');
    expect(body).toContain('Docs');
  });

  it('UserAvatar reads a nested name', () => {
    expect(nested()).toContain('Ada Lovelace');
  });
});

describe('flat keys keep their pre-#234 behaviour', () => {
  it('StatusBadge still resolves a flat key', () => {
    expect(controls()).toContain('Active');
  });

  it('DateCell falls back for a missing path instead of throwing', () => {
    expect(controls()).toContain('—');
  });
});
