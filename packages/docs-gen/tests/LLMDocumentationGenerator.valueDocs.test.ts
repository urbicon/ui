import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../src/types';

// ---------------------------------------------------------------------------
// llm.txt "### Variants" — a value that carries a description gets its own
// indented line under the axis; a value without one gets nothing, so the
// section stays the one-line-per-axis list it was for undocumented axes.
// ---------------------------------------------------------------------------

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

const enriched: EnrichedComponentInfo = {
  name: 'Toggle',
  packageName: '@urbicon-ui/blocks',
  // Non-existent path -> no docs.svelte -> default config -> every section included.
  filePath: '/nonexistent/Toggle/index.ts',
  description: 'Toggle component',
  props: [],
  variants: [],
  inheritance: [],
  stats: { ...NO_STATS },
  crossReferences: [],
  examples: []
};

function apiFor(variants: ComponentAPIData['variants']): APIData {
  const component: ComponentAPIData = {
    name: 'Toggle',
    props: [],
    variants,
    inheritance: [],
    examples: [],
    stats: { ...NO_STATS },
    group: 'primitives'
  };
  return {
    components: { Toggle: component },
    types: [],
    metadata: {
      generated: new Date().toISOString(),
      version: '0.0.0-test',
      totalComponents: 1,
      totalProps: 0,
      generator: 'test'
    }
  };
}

describe('LLMDocumentationGenerator — per-value descriptions in the Variants section', () => {
  let root: string;
  let scopeDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'llmvaluedocs-'));
    scopeDir = path.join(root, 'blocks');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function generateAndRead(variants: ComponentAPIData['variants']): Promise<string> {
    const generator = new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'text'
    });
    await generator.generate([enriched], apiFor(variants));
    return fs.readFile(path.join(scopeDir, 'primitives', 'toggle', 'llm.txt'), 'utf-8');
  }

  it('lists a documented value under its axis and leaves undocumented ones bare', async () => {
    const content = await generateAndRead([
      {
        name: 'variant',
        values: ['default', 'dot'],
        defaultValue: 'default',
        valueDescriptions: { dot: 'Small indicator dot left of the label.' }
      },
      { name: 'size', values: ['md', 'sm'] }
    ]);
    expect(content).toContain('### Variants');
    expect(content).toContain(
      '- variant: default, dot (default: default)\n  - dot — Small indicator dot left of the label.\n- size: md, sm'
    );
    expect(content).not.toContain('- default —');
  });
});
