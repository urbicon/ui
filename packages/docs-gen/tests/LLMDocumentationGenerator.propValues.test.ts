import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { APIData, ComponentAPIData, EnrichedComponentInfo, PropInfo } from '../src/types';

// ---------------------------------------------------------------------------
// llm.txt "### Api" — a prop whose type is named elsewhere carries the values
// docs-gen resolved it to, because an agent reads this row instead of the
// definition. A type that spells its literals is printed as it stands.
// ---------------------------------------------------------------------------

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

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

function apiFor(props: PropInfo[]): APIData {
  const component: ComponentAPIData = {
    name: 'Group',
    props,
    variants: [],
    inheritance: [],
    examples: [],
    stats: { ...NO_STATS },
    group: 'primitives'
  };
  return {
    components: { Group: component },
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

const prop = (name: string, type: string, values?: string[]): PropInfo => ({
  name,
  type,
  required: false,
  description: `The ${name}.`,
  source: { type: 'direct' },
  ...(values ? { values } : {})
});

describe('LLMDocumentationGenerator — resolved values in the Api table', () => {
  let root: string;
  let scopeDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'llmpropvalues-'));
    scopeDir = path.join(root, 'blocks');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function generateAndRead(props: PropInfo[]): Promise<string> {
    const generator = new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'text'
    });
    await generator.generate([enriched], apiFor(props));
    return fs.readFile(path.join(scopeDir, 'primitives', 'group', 'llm.txt'), 'utf-8');
  }

  it('follows a named type with the values it resolved to', async () => {
    const content = await generateAndRead([
      prop('intent', 'ComponentIntent', ['primary', 'neutral']),
      prop('variant', "ButtonVariants['variant']", ['filled', 'outlined'])
    ]);
    expect(content).toContain('| intent | `ComponentIntent` (primary, neutral) | no |');
    expect(content).toContain("| variant | `ButtonVariants['variant']` (filled, outlined) | no |");
  });

  it('prints a type that spells its literals as it stands', async () => {
    const content = await generateAndRead([
      prop('size', "'sm' | 'md'", ['sm', 'md']),
      prop('height', "number | 'auto'", ['auto']),
      prop('label', 'string')
    ]);
    expect(content).toContain("| size | `'sm' | 'md'` | no |");
    expect(content).toContain("| height | `number | 'auto'` | no |");
    expect(content).toContain('| label | `string` | no |');
  });
});
