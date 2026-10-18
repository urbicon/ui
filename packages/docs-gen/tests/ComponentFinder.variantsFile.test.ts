import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ComponentFinder } from '../src/core/discovery/ComponentFinder';
import type { ComponentManifest, PackageConfig } from '../src/types';

/**
 * A component's variants file is the one in its own directory. A family folder
 * can share its name with one member (`components/Chat/Chat/`), and every
 * sibling's file lies below that folder too (`Chat/A2UIView/…`); a member whose
 * own directory holds no variants file has none.
 */

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let manifests: ComponentManifest[];

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const config = {
    name: '@test/fixtures',
    path: FIXTURES,
    glob: {
      components: 'nested-family/**/index.ts',
      variants: 'nested-family/**/*.variants.ts'
    }
  } as PackageConfig;
  manifests = await new ComponentFinder().findComponents(config);
});

function variantsFileOf(name: string): string | undefined {
  const manifest = manifests.find((m) => m.component.name === name);
  expect(manifest, `${name} manifest`).toBeDefined();
  const file = manifest?.files.variants;
  return file ? path.relative(path.join(FIXTURES, 'nested-family'), file) : undefined;
}

describe('ComponentFinder — the variants file of a member named like its family folder', () => {
  it('discovers the members and skips the family barrel', () => {
    expect(manifests.map((m) => m.component.name).sort()).toEqual([
      'Alpha',
      'Beta',
      'Kit',
      'Suite'
    ]);
  });

  it("takes the member's own file, not a sibling's that sorts first", () => {
    expect(variantsFileOf('Suite')).toBe(path.join('Suite', 'Suite', 'suite.variants.ts'));
    expect(variantsFileOf('Alpha')).toBe(path.join('Suite', 'Alpha', 'alpha.variants.ts'));
  });

  it('gives a member without a file of its own none', () => {
    expect(variantsFileOf('Kit')).toBeUndefined();
    expect(variantsFileOf('Beta')).toBe(path.join('Kit', 'Beta', 'beta.variants.ts'));
  });
});
