import { existsSync } from 'node:fs';
import { getCatalogPath } from '@urbicon-ui/design-content';
import { describe, expect, it } from 'vitest';
import { getCachedCatalog, loadCatalog } from './catalog-loader.js';

// Integration test: exercises the real catalog JSON produced by docs-gen.
// If the catalog does not exist (e.g. in a fresh checkout before the docs
// pipeline has run), the test is skipped rather than failing.
const catalogPath = getCatalogPath();
const catalogAvailable = existsSync(catalogPath);

describe.skipIf(!catalogAvailable)('catalog-loader integration', () => {
  it('loads the catalog from disk', async () => {
    const catalog = await loadCatalog();
    expect(catalog).toHaveProperty('components');
    expect(catalog).toHaveProperty('recipes');
    expect(catalog).toHaveProperty('tags');
    expect(Array.isArray(catalog.components)).toBe(true);
  });

  it('every component has the required shape', async () => {
    const catalog = await loadCatalog();
    for (const component of catalog.components) {
      expect(component.name).toBeTruthy();
      expect(component.slug).toBeTruthy();
      expect(component.package).toMatch(/^@urbicon-ui\//);
      expect(['primitives', 'components', 'core', 'auth']).toContain(component.group);
      expect(Array.isArray(component.tags)).toBe(true);
      expect(Array.isArray(component.keyProps)).toBe(true);
      expect(Array.isArray(component.slots)).toBe(true);
    }
  });

  it('caches the catalog between invocations', async () => {
    await loadCatalog();
    const cached = getCachedCatalog();
    expect(cached).not.toBeNull();

    const second = await loadCatalog();
    expect(second).toBe(cached);
  });
});
