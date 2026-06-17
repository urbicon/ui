import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFinder } from '../src/core/discovery/ComponentFinder';
import type { PackageConfig } from '../src/types';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

function packageConfig(componentsGlob: string): PackageConfig {
  return {
    name: '@test/fixtures',
    path: FIXTURES,
    glob: { components: componentsGlob }
  } as PackageConfig;
}

let finder: ComponentFinder;

beforeEach(() => {
  finder = new ComponentFinder();
});

describe('ComponentFinder — @standalone discovery', () => {
  it('emits one manifest per @standalone export on top of the primary manifest', async () => {
    const manifests = await finder.findComponents(packageConfig('standalone/**/index.ts'));
    const names = manifests.map((m) => m.component.name).sort();

    // Family = primary (directory name); FamilyPanel (interface) and FamilyToggle
    // (type-alias union Props) = @standalone opt-ins.
    expect(names).toEqual(['Family', 'FamilyPanel', 'FamilyToggle']);
  });

  it('does NOT emit manifests for compound subcomponents without @standalone', async () => {
    const manifests = await finder.findComponents(packageConfig('standalone/**/index.ts'));
    const names = manifests.map((m) => m.component.name);

    // FamilyItemProps carries @description/@tag like a real surface, but no @standalone.
    expect(names).not.toContain('FamilyItem');
    // OrphanProps is tagged @standalone but has no matching `.svelte` export.
    expect(names).not.toContain('Orphan');
  });

  it('points standalone manifests at the shared family index.ts', async () => {
    const manifests = await finder.findComponents(packageConfig('standalone/**/index.ts'));
    const family = manifests.find((m) => m.component.name === 'Family');
    const panel = manifests.find((m) => m.component.name === 'FamilyPanel');

    expect(family).toBeDefined();
    expect(panel).toBeDefined();
    // Same source file: extraction works per (filePath, componentName) pair.
    expect(panel!.component.filePath).toBe(family!.component.filePath);
    expect(panel!.files.main).toBe(family!.files.main);
  });
});
