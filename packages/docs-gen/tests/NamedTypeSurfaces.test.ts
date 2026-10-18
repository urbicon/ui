import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIDataGenerator } from '../src/core/enrichment/APIDataGenerator';
import {
  CatalogGenerator,
  type ComponentCatalogEntry
} from '../src/generators/catalog/CatalogGenerator';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { APIData, ComponentInfo, EnrichedComponentInfo, PropInfo } from '../src/types';
import { typeSpellsValues } from '../src/utils/prop-type';

// ---------------------------------------------------------------------------
// A prop whose type names its values (`ComponentIntent`) instead of spelling
// them (`'sm' | 'md'`) is shown together with them on every agent surface — the
// llm.txt Api row and the catalog's `keyPropTypes` — and flagged for the docs
// site's API table. One rule decides it, once, in APIDataGenerator.
// ---------------------------------------------------------------------------

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

const prop = (name: string, type: string, values?: string[]): PropInfo => ({
  name,
  type,
  required: false,
  description: `The ${name}.`,
  source: { type: 'direct', name: 'GroupProps' },
  ...(values ? { values } : {})
});

const PROPS: PropInfo[] = [
  prop('intent', 'ComponentIntent', ['primary', 'neutral']),
  prop('variant', "ButtonVariants['variant']", ['filled', 'outlined']),
  prop('mixed', "'auto' | ComponentSize", ['auto', 'sm', 'md']),
  prop('size', "'sm' | 'md'", ['sm', 'md']),
  prop('height', "number | 'auto'", ['auto']),
  prop('label', 'string')
];

const enriched: EnrichedComponentInfo = {
  name: 'Group',
  packageName: '@urbicon-ui/blocks',
  // Non-existent path -> no docs.svelte -> default config -> every section included.
  filePath: '/nonexistent/Group/index.ts',
  description: 'Group component',
  props: [],
  variants: [],
  inheritance: [],
  stats: { ...NO_STATS },
  crossReferences: [],
  examples: []
};

/** The props as every surface receives them: through APIDataGenerator. */
async function apiData(props: PropInfo[]): Promise<APIData> {
  const component = {
    name: 'Group',
    packageName: '@urbicon-ui/blocks',
    filePath: '/src/lib/primitives/Group/Group.svelte',
    description: 'Group component',
    props,
    variants: [],
    examples: [],
    inheritance: []
  } as unknown as ComponentInfo;
  const data = await new APIDataGenerator().generate([component]);
  const group = data.components.Group;
  if (!group) throw new Error('no Group in the generated data');
  group.group = 'primitives';
  return data;
}

describe('typeSpellsValues', () => {
  it('holds for a type that lists every value, mixed with non-literals or not', () => {
    expect(typeSpellsValues("'sm' | 'md'", ['sm', 'md'])).toBe(true);
    expect(typeSpellsValues('"sm" | "md"', ['sm', 'md'])).toBe(true);
    expect(typeSpellsValues("number | 'auto'", ['auto'])).toBe(true);
  });

  it('fails for a type that names some or all of them elsewhere', () => {
    expect(typeSpellsValues('ComponentIntent', ['primary'])).toBe(false);
    expect(typeSpellsValues("'auto' | ComponentSize", ['auto', 'sm'])).toBe(false);
  });
});

describe('PropInfo.namedType', () => {
  it('is set for a named type with values, and only there', async () => {
    const props = (await apiData(PROPS)).components.Group?.props ?? [];
    const flagged = props.filter((p) => p.namedType).map((p) => p.name);
    expect(flagged.sort()).toEqual(['intent', 'mixed', 'variant']);
  });
});

describe('agent surfaces show a named type with its values', () => {
  let root: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'namedtype-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('in the llm.txt Api row', async () => {
    const scopeDir = path.join(root, 'blocks');
    await new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'text'
    }).generate([enriched], await apiData(PROPS));
    const content = await fs.readFile(
      path.join(scopeDir, 'primitives', 'group', 'llm.txt'),
      'utf-8'
    );

    expect(content).toContain('| intent | `ComponentIntent` (primary, neutral) | no |');
    expect(content).toContain("| variant | `ButtonVariants['variant']` (filled, outlined) | no |");
    expect(content).toContain("| mixed | `'auto' | ComponentSize` (auto, sm, md) | no |");
    // A type that spells its values stands as written.
    expect(content).toContain("| size | `'sm' | 'md'` | no |");
    expect(content).toContain("| height | `number | 'auto'` | no |");
    expect(content).toContain('| label | `string` | no |');
  });

  it("in the catalog's keyPropTypes, worded as in the llm.txt row", async () => {
    await new CatalogGenerator('@urbicon-ui/blocks', root).generate(
      [enriched],
      await apiData(PROPS)
    );
    const [entry] = JSON.parse(
      await fs.readFile(path.join(root, '_catalog.json'), 'utf-8')
    ) as ComponentCatalogEntry[];

    expect(entry?.keyPropTypes).toEqual({
      intent: 'ComponentIntent (primary, neutral)',
      variant: "ButtonVariants['variant'] (filled, outlined)",
      mixed: "'auto' | ComponentSize (auto, sm, md)",
      size: "'sm' | 'md'",
      height: "number | 'auto'"
    });
  });
});
