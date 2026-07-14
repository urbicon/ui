import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APIFileGenerator } from '../src/generators/api/APIFileGenerator';
import type { APIData, ComponentAPIData } from '../src/types';

// Regression guard for the emitted per-component api.ts: every top-level key
// of the emitted `componentData` object must be declared on the emitted
// `ComponentAPIInfo` interface. The `slots` field slipped through this gap
// once (data emitted by APIDataGenerator, interface never extended) and broke
// the docs-app check with 57 phantom errors — data emission and interface
// emission live in different modules, so nothing else ties them together.

function fullComponentData(): ComponentAPIData {
  return {
    props: [],
    variants: [],
    inheritance: [],
    examples: [],
    stats: { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 },
    group: 'primitives',
    stability: 'stable',
    sourceHref: 'https://example.test/source',
    relatedComponents: ['Other'],
    slots: ['base', 'label'],
    types: [{ name: 'HelperType', type: 'interface', definition: 'interface HelperType {}' }]
  } as ComponentAPIData;
}

describe('APIFileGenerator — emitted interface covers the emitted data', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-file-gen-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('declares every top-level componentData key on ComponentAPIInfo', async () => {
    const generator = new APIFileGenerator({ outputPath: dir, format: 'typescript' });
    const apiData: APIData = {
      metadata: { generated: '2026-07-14T00:00:00.000Z', version: 'test' },
      components: { Widget: fullComponentData() }
    } as unknown as APIData;

    await generator.generate(apiData);

    const emitted = await fs.readFile(path.join(dir, 'primitives', 'widget', 'api.ts'), 'utf-8');

    const interfaceBlock = emitted.match(/export interface ComponentAPIInfo \{([\s\S]*?)\n\}/);
    expect(interfaceBlock).not.toBeNull();
    const declaredMembers = new Set(
      [...(interfaceBlock as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
    );

    const dataMatch = emitted.match(
      /export const componentData: ComponentAPIInfo = ([\s\S]*?) as const;/
    );
    expect(dataMatch).not.toBeNull();
    const dataKeys = Object.keys(JSON.parse((dataMatch as RegExpMatchArray)[1]));

    for (const key of dataKeys) {
      expect(declaredMembers, `componentData key "${key}" missing on ComponentAPIInfo`).toContain(
        key
      );
    }
  });
});
