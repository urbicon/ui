import { describe, expect, it } from 'vitest';
import type { ComponentInfo, PropInfo, TypeDefinition } from '../../types';
import { APIDataGenerator } from './APIDataGenerator';

const type = (
  name: string,
  definition: string,
  extra: Partial<TypeDefinition> = {}
): TypeDefinition => ({
  name,
  type: 'type',
  definition,
  package: '@urbicon-ui/blocks',
  exported: true,
  ...extra
});

const LOCAL_TYPES: TypeDefinition[] = [
  type('ThingVariants', 'VariantProps<typeof thingVariants>'),
  type('ThingSlots', 'SlotNames<typeof thingVariants>', { exported: false }),
  type('ThingTone', "'calm' | 'loud'"),
  type('ComponentVariant', '(typeof VARIANTS)[number]'),
  type('VariantProps', 'Omit<TVProps<…>, "class">', { scope: 'imported' }),
  type('SlotNames', 'keyof ReturnType<T> & string', { scope: 'imported' })
];

const component = (props: PropInfo[]): ComponentInfo =>
  ({
    name: 'Thing',
    packageName: '@urbicon-ui/blocks',
    filePath: '/src/lib/components/Thing/Thing.svelte',
    description: 'A thing.',
    props,
    variants: [],
    examples: [],
    inheritance: [],
    localTypes: LOCAL_TYPES.map((t) => ({ ...t }))
  }) as unknown as ComponentInfo;

async function generate() {
  const data = await new APIDataGenerator().generate([component([])]);
  const thing = data.components.Thing;
  if (!thing) throw new Error('no Thing');
  return thing;
}

describe('which extracted types a component lists', () => {
  it("drops the variant engine's generics and unexported tv() aliases", async () => {
    const names = ((await generate()).types ?? []).map((t) => t.name);
    expect(names).toEqual(['ThingVariants', 'ThingTone', 'ComponentVariant']);
  });

  it('keeps the engine generics out of the package-wide type list', async () => {
    const generator = new APIDataGenerator();
    const data = await generator.generate([component([])]);
    // The engine generics never reach `types`, so the llm.txt Types section
    // (helpers only) cannot print them either.
    expect(data.types.map((t) => t.name)).not.toContain('SlotNames');
    expect(data.types.map((t) => t.name)).not.toContain('VariantProps');
  });

  it('links a prop type to a listed type and never to an unlisted one', async () => {
    const direct = (name: string, propType: string) =>
      ({
        name,
        type: propType,
        required: false,
        description: `The ${name}.`,
        source: { type: 'direct', name: 'ThingProps' }
      }) as unknown as PropInfo;
    const data = await new APIDataGenerator().generate([
      component([direct('tone', 'ThingTone'), direct('slot', 'ThingSlots')])
    ]);
    const seeAlso = Object.fromEntries(
      (data.components.Thing?.props ?? []).map((p) => [p.name, p.seeAlso])
    );
    expect(seeAlso.tone).toMatch(/#type-ThingTone$/);
    expect(seeAlso.slot ?? '').not.toContain('#type-ThingSlots');
  });
});
