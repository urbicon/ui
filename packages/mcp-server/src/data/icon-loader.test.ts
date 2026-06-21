import { existsSync } from 'node:fs';
import { getIconsPath } from '@urbicon-ui/design-content';
import { describe, expect, it } from 'vitest';
import { loadIcons } from './icon-loader.js';

// Integration test: exercises the real icons.json from the content bundle. The
// registry-parsing logic itself is unit-tested in docs-gen (icons.test.ts); here we
// only assert the loader reads + shapes the bundled JSON. Skipped on a fresh checkout
// before the bundle has been generated.
const iconsAvailable = existsSync(getIconsPath());

describe.skipIf(!iconsAvailable)('icon-loader integration', () => {
  it('loads icons with the expected shape', async () => {
    const icons = await loadIcons();
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.name).toBeTruthy();
      expect(icon.componentName).toMatch(/Icon$/);
      expect(typeof icon.label).toBe('string');
      expect(Array.isArray(icon.categories)).toBe(true);
      expect(Array.isArray(icon.keywords)).toBe(true);
    }
  });

  it('caches between invocations', async () => {
    const first = await loadIcons();
    const second = await loadIcons();
    expect(second).toBe(first);
  });
});
