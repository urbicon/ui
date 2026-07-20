import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Global llms.txt aggregator — fail-loud contract.
//
// Directory-mode generate() writes a global `llms.txt` one level above the
// scope dir (the static root). Pre-fix, that block sat in a silent catch: a
// failed write left a stale or missing aggregator at the published static
// root while the run reported success. The content itself is a pure static
// string with no optional inputs, so the only fallible operation is the write
// — and a failed write must abort the run.
// ---------------------------------------------------------------------------

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

function enriched(name: string): EnrichedComponentInfo {
  return {
    name,
    packageName: '@urbicon-ui/blocks',
    // Non-existent path -> no docs.svelte -> default config -> component included.
    filePath: `/nonexistent/${name}/index.ts`,
    description: `${name} component`,
    props: [],
    variants: [],
    inheritance: [],
    stats: { ...NO_STATS },
    crossReferences: [],
    examples: []
  };
}

function apiFor(entries: Array<{ name: string; group?: string }>): APIData {
  const components: Record<string, ComponentAPIData> = {};
  for (const { name, group } of entries) {
    components[name] = {
      name,
      props: [],
      variants: [],
      inheritance: [],
      examples: [],
      stats: { ...NO_STATS },
      ...(group ? { group } : {})
    };
  }
  return {
    components,
    types: [],
    metadata: {
      generated: new Date().toISOString(),
      version: '0.0.0-test',
      totalComponents: entries.length,
      totalProps: 0,
      generator: 'test'
    }
  };
}

describe('LLMDocumentationGenerator — global llms.txt aggregator', () => {
  let root: string;
  let scopeDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'llmstxt-global-'));
    scopeDir = path.join(root, 'blocks');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  function makeGenerator(): LLMDocumentationGenerator {
    return new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'markdown'
    });
  }

  it('writes the aggregator at the static root and reports it in the output', async () => {
    const gen = makeGenerator();
    const entries = [{ name: 'Tooltip', group: 'primitives' }];
    const result = await gen.generate([enriched('Tooltip')], apiFor(entries));

    const globalPath = path.join(root, 'llms.txt');
    const content = await fs.readFile(globalPath, 'utf-8');
    expect(content).toContain('# Urbicon UI');
    expect(content).toContain('(./llms-full.txt)');
    // The four scope links.
    for (const scope of ['blocks', 'docs', 'table', 'auth']) {
      expect(content).toContain(`(./${scope}/llms.txt)`);
    }
    // The write is part of the reported output size (it went through
    // writtenFiles), i.e. the aggregator is a first-class artifact of the run.
    expect(result.size).toBeGreaterThan(0);
  });

  it('fails loud when the aggregator cannot be written (no silent stale artifact)', async () => {
    // Simulate an unwritable target deterministically: a *directory* named
    // llms.txt at the static root makes fs.writeFile fail (EISDIR).
    await fs.mkdir(path.join(root, 'llms.txt'), { recursive: true });

    const gen = makeGenerator();
    await expect(
      gen.generate([enriched('Tooltip')], apiFor([{ name: 'Tooltip', group: 'primitives' }]))
    ).rejects.toThrow(/global llms\.txt aggregator/);
  });
});
