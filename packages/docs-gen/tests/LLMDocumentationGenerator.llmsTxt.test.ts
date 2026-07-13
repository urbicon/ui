import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Fixtures
//
// The per-component `llm.txt` is written to `<scope>/<group>/<slug>/llm.txt`
// (or `<scope>/<slug>/llm.txt` when the component has no group). The per-scope
// `llms.txt` index MUST link to the same path — the pre-fix code dropped the
// group segment (`./<slug>/llm.txt`), 404-ing every link. These tests drive the
// public `generate()` round-trip into a temp dir and prove the index links
// resolve to the files that were actually written.
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

// ---------------------------------------------------------------------------

describe('LLMDocumentationGenerator — group-aware llms.txt index links', () => {
  let root: string;
  let scopeDir: string;

  beforeEach(async () => {
    // The generator is chatty; keep the suite output clean.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'llmstxt-'));
    // Nest the scope under root so the sibling global llms.txt (written one level
    // up by generate()) stays inside the temp tree instead of polluting tmpdir.
    scopeDir = path.join(root, 'blocks');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function run(entries: Array<{ name: string; group?: string }>): Promise<string> {
    const gen = new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'markdown'
    });
    await gen.generate(
      entries.map((e) => enriched(e.name)),
      apiFor(entries)
    );
    return fs.readFile(path.join(scopeDir, 'llms.txt'), 'utf-8');
  }

  it('writes index links carrying the on-disk group segment (bare slug only when groupless)', async () => {
    const index = await run([
      { name: 'Tooltip', group: 'primitives' },
      { name: 'Planner', group: 'components' },
      { name: 'Solo' }
    ]);

    expect(index).toContain('](./primitives/tooltip/llm.txt)');
    expect(index).toContain('](./components/planner/llm.txt)');
    expect(index).toContain('](./solo/llm.txt)');
  });

  it('no longer emits the pre-fix groupless link for grouped components', async () => {
    const index = await run([
      { name: 'Tooltip', group: 'primitives' },
      { name: 'Planner', group: 'components' }
    ]);

    // The bug wrote `./tooltip/llm.txt` / `./planner/llm.txt` (no group) — 404.
    expect(index).not.toContain('](./tooltip/llm.txt)');
    expect(index).not.toContain('](./planner/llm.txt)');
  });

  it('every index link resolves to an actually-written llm.txt (no 404)', async () => {
    const entries = [
      { name: 'Tooltip', group: 'primitives' },
      { name: 'Planner', group: 'components' },
      { name: 'Solo' }
    ];
    const index = await run(entries);

    const hrefs = [...index.matchAll(/\]\((\.\/[^)]+llm\.txt)\)/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(entries.length);

    for (const href of hrefs) {
      // Resolve the link relative to the scope dir it lives in; fs.access rejects
      // if the target file does not exist. Assert on existence rather than the
      // resolved value — Node resolves `access` to `undefined`, Bun to `null`, and
      // this suite runs under `bun --bun`.
      const exists = await fs.access(path.resolve(scopeDir, href)).then(
        () => true,
        () => false
      );
      expect(exists, `index link 404s (no file on disk): ${href}`).toBe(true);
    }
  });
});
