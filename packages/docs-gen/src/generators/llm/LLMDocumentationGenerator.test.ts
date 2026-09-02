import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../../types';
import type { LLMOutputConfig } from '../../types/configuration';
import { LLMDocumentationGenerator } from './LLMDocumentationGenerator';

// Directory-mode runs with no components: the write loop is skipped, but the
// scope index, the global aggregator and (the subject here) the guide copies
// still happen — exactly the shape the guide feature has to survive.
const EMPTY_API_DATA = { components: {}, types: [], metadata: {} } as unknown as APIData;

const baseConfig = (outputPath: string): LLMOutputConfig => ({
  enabled: true,
  outputPath,
  format: 'text'
});

describe('LLMDocumentationGenerator guides', () => {
  let tmp: string;
  let scopeDir: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'docs-gen-llm-'));
    // The generator writes the global aggregator one level above outputPath,
    // so the scope dir must be a child of the sandbox.
    scopeDir = path.join(tmp, 'auth');
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('copies each guide into the output root and indexes it before the components', async () => {
    const source = path.join(tmp, 'AUTH-source.md');
    await writeFile(source, '# Auth Reference\n', 'utf-8');

    const generator = new LLMDocumentationGenerator({
      ...baseConfig(scopeDir),
      guides: [
        {
          title: 'Auth Reference',
          sourcePath: source,
          outputName: 'AUTH.md',
          description: 'Architecture & limitations'
        }
      ]
    });
    await generator.generate([], EMPTY_API_DATA);

    const copied = await readFile(path.join(scopeDir, 'AUTH.md'), 'utf-8');
    expect(copied).toBe('# Auth Reference\n');

    const index = await readFile(path.join(scopeDir, 'llms.txt'), 'utf-8');
    expect(index).toContain('## Guides');
    expect(index).toContain('- [Auth Reference](./AUTH.md): Architecture & limitations');
    // Guides come first: the hand-written reference outranks per-component context.
    expect(index.indexOf('## Guides')).toBeLessThan(index.indexOf('## Components'));
  });

  it('fails loud when a guide source is missing instead of publishing a dangling index link', async () => {
    const generator = new LLMDocumentationGenerator({
      ...baseConfig(scopeDir),
      guides: [
        {
          title: 'Auth Reference',
          sourcePath: path.join(tmp, 'does-not-exist.md'),
          outputName: 'AUTH.md',
          description: 'Architecture & limitations'
        }
      ]
    });
    await expect(generator.generate([], EMPTY_API_DATA)).rejects.toThrow(
      /Failed to copy guide "Auth Reference"/
    );
    // The scope index must not have been written for a failed run.
    await expect(stat(path.join(scopeDir, 'llms.txt'))).rejects.toThrow();
  });

  it('emits no Guides section when none are configured', async () => {
    const generator = new LLMDocumentationGenerator(baseConfig(scopeDir));
    await generator.generate([], EMPTY_API_DATA);

    const index = await readFile(path.join(scopeDir, 'llms.txt'), 'utf-8');
    expect(index).not.toContain('## Guides');
    expect(index).toContain('## Components');
  });
});

// A component's maturity reached only the docs-page badge and the MCP catalog, so
// every file-based consumer path — the per-component `llm.txt`, `llms-full.txt`
// assembled from them, and `urbicon get-component`, which prints one verbatim —
// showed an experimental component exactly like a stable one.
describe('LLMDocumentationGenerator stability', () => {
  let tmp: string;
  let scopeDir: string;

  const component = (name: string): EnrichedComponentInfo =>
    ({
      name,
      packageName: '@urbicon-ui/blocks',
      filePath: `/src/lib/components/${name}/${name}.svelte`,
      description: `The ${name} component.`,
      crossReferences: [],
      examples: []
    }) as unknown as EnrichedComponentInfo;

  const apiEntry = (name: string, stability?: string) =>
    ({
      name,
      props: [{ name: 'value', type: 'string', required: false, description: 'A value.' }],
      variants: [],
      inheritance: [],
      examples: [],
      stats: { total: 1, direct: 1, variant: 0, inherited: 0 },
      group: 'components',
      ...(stability ? { stability } : {})
    }) as unknown as ComponentAPIData;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'docs-gen-stability-'));
    scopeDir = path.join(tmp, 'blocks');
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  const run = async () => {
    const generator = new LLMDocumentationGenerator(baseConfig(scopeDir));
    await generator.generate(
      [component('Betamax'), component('Steadfast'), component('Wildcard')],
      {
        components: {
          Betamax: apiEntry('Betamax', 'beta'),
          // The positive control in the opposite case: same rig, same run — a
          // `stable` component must come back with no note at all, or the
          // assertion below would pass on a generator that stamps every entry.
          Steadfast: apiEntry('Steadfast', 'stable'),
          Wildcard: apiEntry('Wildcard', 'experimental')
        },
        types: [],
        metadata: {}
      } as unknown as APIData
    );
    const read = (name: string) =>
      readFile(path.join(scopeDir, 'components', name, 'llm.txt'), 'utf-8');
    return {
      betamax: await read('betamax'),
      steadfast: await read('steadfast'),
      wildcard: await read('wildcard'),
      index: await readFile(path.join(scopeDir, 'llms.txt'), 'utf-8')
    };
  };

  it('states a non-stable level in the component file, and states nothing for stable', async () => {
    const { betamax, steadfast, wildcard } = await run();

    expect(betamax).toContain('**Stability:** beta —');
    expect(wildcard).toContain('**Stability:** experimental —');
    expect(steadfast).not.toContain('**Stability:**');
  });

  it('puts the level above the description, where a truncating reader still sees it', async () => {
    const { betamax } = await run();

    const level = betamax.indexOf('**Stability:**');
    const description = betamax.indexOf('The Betamax component.');
    expect(level).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(-1);
    expect(level).toBeLessThan(description);
  });

  it('marks the level in the scope index, which is the only thing its lines say', async () => {
    const { index } = await run();

    expect(index).toContain(
      '[Betamax](./components/betamax/llm.txt): Component LLM context (beta)'
    );
    expect(index).toContain(
      '[Wildcard](./components/wildcard/llm.txt): Component LLM context (experimental)'
    );
    expect(index).toContain('[Steadfast](./components/steadfast/llm.txt): Component LLM context\n');
  });
});
