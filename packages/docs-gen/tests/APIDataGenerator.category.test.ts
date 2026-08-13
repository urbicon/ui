import type { ComponentInfo } from '@urbicon-ui/shared-types';
import { describe, expect, it } from 'vitest';
import { APIDataGenerator } from '../src/core/enrichment/APIDataGenerator';
import type { TypeDefinition } from '../src/types';

/**
 * What a type inherits is not what it is.
 *
 * `category` decides which types reach a consumer-facing surface: the llm.txt
 * Types section lists 'helper' (business) types and drops 'variant' ones,
 * because `XVariants` / `XSlots` aliases are tv() machinery a reader never
 * writes by hand. The test for "is this machinery" is a substring match for
 * `VariantProps<` / `SlotNames<` against the definition.
 *
 * Since 2026-08-13 a definition also carries the members it inherits, inline.
 * That turned the question from "does this type mention tv() machinery" into
 * "does anything in its ancestry", and a business type extending a base that
 * happens to declare one such field would quietly stop being documented.
 */

const BLOCKS = '/repo/packages/blocks/src/lib';

function component(name: string, localTypes: TypeDefinition[]): ComponentInfo {
  return {
    name,
    packageName: '@urbicon-ui/blocks',
    filePath: `${BLOCKS}/primitives/${name}/index.ts`,
    description: `${name} component`,
    props: [],
    variants: [],
    inheritance: [],
    stats: { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 },
    ...{ localTypes }
  } as unknown as ComponentInfo;
}

function typeDef(name: string, definition: string): TypeDefinition {
  return {
    name,
    type: 'interface',
    definition,
    package: '@urbicon-ui/blocks',
    sourcePath: 'packages/blocks/src/lib/primitives/Widget/index.ts'
  };
}

async function categoriesFor(types: TypeDefinition[]) {
  const api = await new APIDataGenerator().generate([component('Widget', types)], {
    routeBasePath: '/blocks'
  });
  return Object.fromEntries((api.components.Widget?.types ?? []).map((t) => [t.name, t.category]));
}

describe('APIDataGenerator — type category', () => {
  it('classifies by the type’s own members, not by what it inherits', async () => {
    const categories = await categoriesFor([
      typeDef(
        'TableSummary',
        [
          'total: number;',
          '  // ── inherited from WidgetBase ──',
          '  variants?: VariantProps<typeof widgetVariants>;'
        ].join('\n')
      )
    ]);

    // A business type that inherits tv() machinery is still a business type;
    // classifying it 'variant' drops it from the llm.txt Types section.
    expect(categories.TableSummary).toBe('helper');
  });

  it('still classifies a type that declares the machinery itself', async () => {
    // The positive control: the match has to keep working on own members, or
    // the fix above would have been "stop classifying anything".
    const categories = await categoriesFor([
      typeDef('WidgetChrome', 'variants?: VariantProps<typeof widgetVariants>;')
    ]);

    expect(categories.WidgetChrome).toBe('variant');
  });

  it('keeps naming a `*Props` interface props regardless of either', async () => {
    const categories = await categoriesFor([
      typeDef(
        'WidgetProps',
        ['own?: string;', '  // ── inherited from Base ──', '  slots?: SlotNames<typeof v>;'].join(
          '\n'
        )
      )
    ]);

    expect(categories.WidgetProps).toBe('props');
  });
});
