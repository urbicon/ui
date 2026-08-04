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
    types: [
      {
        name: 'HelperType',
        type: 'interface',
        definition: 'interface HelperType {}',
        package: '@urbicon-ui/blocks',
        documentation: 'A helper.',
        scope: 'imported',
        category: 'helper',
        members: 1,
        sourcePath: 'packages/blocks/src/lib/utils/helper.ts',
        seeAlso: 'https://example.test/helper',
        seeAlsoRefs: ['OtherType'],
        exported: true,
        owner: 'Other',
        usedByProps: [{ component: 'Widget', propName: 'helper', source: 'direct' }],
        usedByCount: 1
      }
    ]
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
    const memberList = [
      ...(interfaceBlock as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm)
    ].map((m) => m[1]);
    const declaredMembers = new Set(memberList);
    // Duplicate members are a TS error in every generated file ("Duplicate
    // identifier") — two parallel fixes once each added `slots`.
    expect(memberList.length, `duplicate interface members: ${memberList.join(', ')}`).toBe(
      declaredMembers.size
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

  // Same gap one level down: `inheritance[].props[]` is emitted against the
  // one-line `InheritanceProp` interface, and a field that only appears in the
  // data type-errors in the docs app, never here. `values` slipped through this
  // way when the Pick<…> resolution started carrying literal unions.
  it('declares every emitted inheritance prop field on InheritanceProp', async () => {
    const generator = new APIFileGenerator({ outputPath: dir, format: 'typescript' });
    const data = fullComponentData();
    data.inheritance = [
      {
        typeName: "Pick<ButtonProps, 'variant'>",
        source: 'pick-pattern',
        props: [
          {
            name: 'variant',
            type: "'filled' | 'ghost'",
            required: false,
            description: 'Visual variant.',
            summary: 'Visual variant.',
            values: ['filled', 'ghost'],
            source: { type: 'inherited', name: 'ButtonProps' },
            seeAlso: 'https://example.test/button',
            seeAlsoRefs: ['ButtonProps'],
            examples: [{ title: 'ghost', code: '<CopyButton variant="ghost" />' }]
          }
        ]
      }
    ] as unknown as typeof data.inheritance;

    await generator.generate({
      metadata: { generated: '2026-07-30T00:00:00.000Z', version: 'test' },
      components: { Widget: data }
    } as unknown as APIData);

    const emitted = await fs.readFile(path.join(dir, 'primitives', 'widget', 'api.ts'), 'utf-8');
    const line = emitted.match(/export interface InheritanceProp \{([^\n]*)\}/);
    expect(line).not.toBeNull();
    const declared = new Set(
      [...(line as RegExpMatchArray)[1].matchAll(/(\w+)\??:/g)].map((m) => m[1])
    );

    const dataMatch = emitted.match(
      /export const componentData: ComponentAPIInfo = ([\s\S]*?) as const;/
    );
    const parsed = JSON.parse((dataMatch as RegExpMatchArray)[1]) as {
      inheritance: { props: Record<string, unknown>[] }[];
    };
    const emittedFields = Object.keys(parsed.inheritance[0].props[0]);
    expect(emittedFields).toContain('values');
    for (const field of emittedFields) {
      expect(declared, `InheritanceProp is missing "${field}"`).toContain(field);
    }
  });

  // Third instance of the same gap, one level down again: `types[]` used to be
  // typed `{ name; type; definition; [key: string]: unknown }`, so every extra
  // field read back as `unknown` and no consumer could branch on it without
  // asserting. tsc accepted that array as `LocalTypeDef[]` all the same — the
  // index signature made the two never be compared — which is exactly why the
  // drift went unnoticed. This guard is what keeps a newly emitted field from
  // re-opening the hole.
  it('declares every emitted type-definition field on TypeDefinitionInfo', async () => {
    const generator = new APIFileGenerator({ outputPath: dir, format: 'typescript' });
    await generator.generate({
      metadata: { generated: '2026-08-04T00:00:00.000Z', version: 'test' },
      components: { Widget: fullComponentData() }
    } as unknown as APIData);

    const emitted = await fs.readFile(path.join(dir, 'primitives', 'widget', 'api.ts'), 'utf-8');
    const block = emitted.match(/export interface TypeDefinitionInfo \{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    const declared = new Set(
      [...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
    );

    const dataMatch = emitted.match(
      /export const componentData: ComponentAPIInfo = ([\s\S]*?) as const;/
    );
    const parsed = JSON.parse((dataMatch as RegExpMatchArray)[1]) as {
      types: Record<string, unknown>[];
    };
    const emittedFields = Object.keys(parsed.types[0]);
    expect(emittedFields).toContain('exported');
    expect(emittedFields).toContain('owner');
    for (const field of emittedFields) {
      expect(declared, `TypeDefinitionInfo is missing "${field}"`).toContain(field);
    }
    // The index signature it replaced typed nothing; its return would make
    // every future field `unknown` again without failing anything.
    expect(block?.[1]).not.toMatch(/\[key: string\]/);

    // Second, independent oracle. The loop above only sees fields the fixture
    // above happens to carry, so it catches a new field only if someone also
    // remembers to fixture it — the same "green for the wrong reason" shape
    // this file exists to prevent. `TypeDefinition` in types/core.ts is the
    // authority on what *can* be emitted, so read it directly.
    const core = await fs.readFile(
      path.join(import.meta.dirname, '..', 'src', 'types', 'core.ts'),
      'utf-8'
    );
    const coreBlock = core.match(/export interface TypeDefinition \{([\s\S]*?)\n\}/);
    expect(coreBlock).not.toBeNull();
    const sourceFields = [...(coreBlock as RegExpMatchArray)[1].matchAll(/^ {2}(\w+)\??:/gm)].map(
      (m) => m[1]
    );
    expect(sourceFields.length).toBeGreaterThan(emittedFields.length - 1);
    for (const field of sourceFields) {
      expect(declared, `TypeDefinitionInfo does not cover TypeDefinition.${field}`).toContain(
        field
      );
    }
  });

  it('no longer emits the dead typeAnchor/typePreview fields (removed 2026-07: nothing read them)', async () => {
    const generator = new APIFileGenerator({ outputPath: dir, format: 'typescript' });
    const apiData: APIData = {
      metadata: { generated: '2026-07-20T00:00:00.000Z', version: 'test' },
      components: { Widget: fullComponentData() }
    } as unknown as APIData;

    await generator.generate(apiData);

    const emitted = await fs.readFile(path.join(dir, 'primitives', 'widget', 'api.ts'), 'utf-8');
    // The referenced TypeCell component never shipped; the strict type-link
    // tokenizer (seeAlso) is the surviving mechanism.
    expect(emitted).not.toMatch(/typeAnchor|typePreview/);
  });
});
