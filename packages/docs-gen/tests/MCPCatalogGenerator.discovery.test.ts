import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ComponentCatalogEntry,
  INTERNAL_PACKAGE,
  MCPCatalogGenerator
} from '../src/generators/mcp/MCPCatalogGenerator';
import type { APIData, ComponentAPIData, EnrichedComponentInfo, PropInfo } from '../src/types';

// ---------------------------------------------------------------------------
// What a catalog entry carries for discovery beyond name/description/tags: the
// summary, the direct props' own JSDoc (`propDocs`) and per-value descriptions
// on the variant axes. The exclusions are the point — what is left out is
// exactly the text that would score every component the same way.
// ---------------------------------------------------------------------------

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

const component: EnrichedComponentInfo = {
  name: 'Toggle',
  packageName: '@urbicon-ui/blocks',
  filePath: '/nonexistent/Toggle/index.ts',
  description: 'Accessible switch control.',
  summary: 'On or off, with the switch to say which.',
  tags: ['form'],
  props: [],
  variants: [],
  inheritance: [],
  stats: { ...NO_STATS },
  crossReferences: [],
  examples: []
};

const direct = (name: string, description: string, summary?: string): PropInfo => ({
  name,
  type: 'string',
  required: false,
  description,
  ...(summary ? { summary } : {}),
  source: { type: 'direct', name: 'ToggleProps' }
});

const PROPS: PropInfo[] = [
  direct('...ToggleVariants', 'spread placeholder'),
  direct('checked', 'Current on/off state.'),
  direct(
    'variant',
    'Visual style. Use `dot` for dense settings rows.',
    'Switch-pill or a small monochrome dot.'
  ),
  direct('class', 'Extra classes merged onto the wrapper.'),
  direct('unstyled', 'Strip all default variant classes.'),
  direct('slotClasses', 'Per-slot class overrides.'),
  // No JSDoc on the declaration: the extractor's `<name> property` stand-in.
  direct('bare', 'bare property'),
  {
    name: 'size',
    type: "'md' | 'sm'",
    required: false,
    description: 'Controls the dimensions of the Toggle. Available options: md, sm.',
    source: { type: 'variant', name: 'ToggleVariants' }
  },
  {
    name: 'id',
    type: 'string',
    required: false,
    description: 'The element id.',
    source: { type: 'inherited', name: 'HTMLInputAttributes' }
  }
];

function apiFor(props: PropInfo[], variants: ComponentAPIData['variants']): APIData {
  const api: ComponentAPIData = {
    name: 'Toggle',
    group: 'primitives',
    props,
    variants,
    inheritance: [],
    examples: [],
    stats: { ...NO_STATS }
  };
  return {
    components: { Toggle: api },
    types: [],
    metadata: {
      generated: new Date().toISOString(),
      version: '0.0.0-test',
      totalComponents: 1,
      totalProps: props.length,
      generator: 'test'
    }
  };
}

describe('MCPCatalogGenerator — what the entry carries for discovery', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-catalog-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function generateEntry(
    apiData: APIData,
    packageName = '@urbicon-ui/blocks'
  ): Promise<ComponentCatalogEntry> {
    const generator = new MCPCatalogGenerator(packageName, tmp);
    await generator.generate([component], apiData);
    const raw = await fs.readFile(path.join(tmp, '_catalog.json'), 'utf-8');
    const [entry] = JSON.parse(raw) as ComponentCatalogEntry[];
    if (!entry) throw new Error('no entry written');
    return entry;
  }

  it('carries the summary', async () => {
    const entry = await generateEntry(apiFor(PROPS, []));
    expect(entry.summary).toBe('On or off, with the switch to say which.');
  });

  it("carries the direct props' JSDoc as propDocs, description and summary apart", async () => {
    const entry = await generateEntry(apiFor(PROPS, []));
    expect(entry.propDocs?.variant).toEqual({
      description: 'Visual style. Use `dot` for dense settings rows.',
      summary: 'Switch-pill or a small monochrome dot.'
    });
    expect(entry.propDocs?.checked).toEqual({ description: 'Current on/off state.' });
  });

  it('leaves out the spread placeholder, the style-override trio, a prop without JSDoc, variant boilerplate and inherited attributes', async () => {
    const entry = await generateEntry(apiFor(PROPS, []));
    expect(Object.keys(entry.propDocs ?? {}).sort()).toEqual(['checked', 'variant']);
  });

  it('omits propDocs entirely when no direct prop carries JSDoc', async () => {
    const entry = await generateEntry(apiFor([direct('bare', 'bare property')], []));
    expect(entry).not.toHaveProperty('propDocs');
  });

  it('writes no search-only fields for the internal package, which never reaches the search index', async () => {
    const entry = await generateEntry(
      apiFor(PROPS, [
        {
          name: 'variant',
          values: ['default', 'dot'],
          valueDescriptions: { dot: 'Small indicator dot.' }
        }
      ]),
      INTERNAL_PACKAGE
    );
    expect(entry.summary).toBe('On or off, with the switch to say which.');
    expect(entry).not.toHaveProperty('propDocs');
    expect(entry.variants).toEqual([{ name: 'variant', values: ['default', 'dot'] }]);
  });

  it('passes per-value descriptions through and omits the field where there are none', async () => {
    const entry = await generateEntry(
      apiFor(PROPS, [
        {
          name: 'variant',
          values: ['default', 'dot'],
          defaultValue: 'default',
          valueDescriptions: { dot: 'Small indicator dot.' }
        },
        { name: 'size', values: ['md', 'sm'] }
      ])
    );
    expect(entry.variants).toEqual([
      {
        name: 'variant',
        values: ['default', 'dot'],
        default: 'default',
        valueDescriptions: { dot: 'Small indicator dot.' }
      },
      { name: 'size', values: ['md', 'sm'] }
    ]);
  });
});
