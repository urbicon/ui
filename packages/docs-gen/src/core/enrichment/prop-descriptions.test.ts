import { describe, expect, it } from 'vitest';
import type { ComponentInfo, PropInfo } from '../../types';
import { APIDataGenerator } from './APIDataGenerator';

/**
 * A prop's own JSDoc used to be replaced whenever it ran under 20 characters —
 * a threshold that conflates "the author wrote nothing" with "the author wrote
 * something short and exact". 71 props across the library sat under it, and the
 * strings reach `llm.txt`, `llms-full.txt` and the MCP catalog, not just the
 * page.
 *
 * The `size` case is the sharp one: for a name in the substitution table the
 * replacement is not merely empty, it contradicts the prop.
 */

const prop = (name: string, description: string): PropInfo =>
  ({
    name,
    type: 'string',
    required: false,
    description,
    source: { type: 'direct', name: 'ThingProps' }
  }) as unknown as PropInfo;

const component = (props: PropInfo[]): ComponentInfo =>
  ({
    name: 'Thing',
    packageName: '@urbicon-ui/blocks',
    filePath: '/src/lib/components/Thing/Thing.svelte',
    description: 'A thing.',
    props,
    variants: [],
    examples: [],
    inheritance: []
  }) as unknown as ComponentInfo;

async function describedAs(props: PropInfo[]): Promise<Record<string, string>> {
  const data = await new APIDataGenerator().generate([component(props)]);
  const thing = data.components.Thing;
  if (!thing) throw new Error(`no Thing in ${Object.keys(data.components).join(', ')}`);
  return Object.fromEntries(thing.props.map((p) => [p.name, p.description]));
}

describe('a prop keeps the description its author wrote', () => {
  it('keeps a short one, and still fills in an absent one', async () => {
    const out = await describedAs([
      prop('length', 'Number of cells.'),
      prop('nodes', 'Node list.'),
      // The control: nothing written, so the substitute is the only thing
      // there is. If this came back empty too, the test above would be
      // passing on a generator that simply stopped substituting.
      prop('sprocket', '')
    ]);

    expect(out.length).toBe('Number of cells.');
    expect(out.nodes).toBe('Node list.');
    expect(out.sprocket).toBe('Sprocket property for the Thing component');
  });

  it('does not overwrite a short description with a table entry that contradicts it', async () => {
    const out = await describedAs([prop('size', 'Icon size.'), prop('variant', '')]);

    expect(out.size).toBe('Icon size.');
    // Same run: an absent one still gets the table's wording, which is the
    // half of the substitution that says something true.
    expect(out.variant).toBe('Visual style variant for the Thing component');
  });
});
