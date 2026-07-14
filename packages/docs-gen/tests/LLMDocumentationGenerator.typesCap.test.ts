import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type {
  APIData,
  ComponentAPIData,
  EnrichedComponentInfo,
  TypeDefinition
} from '../src/types';

// ---------------------------------------------------------------------------
// llm.txt "### Types" section — per-type size cap.
//
// llm.txt is the token-efficiency surface: a helper type whose rendering
// exceeds MAX_TYPE_DEFINITION_LINES (40) must collapse to a one-line summary
// (member count + source path), never a truncated body. Small helpers keep
// their full fenced definition. api.ts / TypesReference stay uncapped — the
// docs page renders definitions collapsed behind its row expansion.
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

const SMALL_TYPE: TypeDefinition = {
  name: 'SmallHelper',
  type: 'interface',
  definition: '/** Anchor id. */\n  target?: string;',
  package: '@urbicon-ui/blocks',
  members: 1,
  sourcePath: 'packages/blocks/src/lib/utils/small.ts'
};

// 60 members -> 60+ rendered lines -> must be summarized.
const BIG_TYPE: TypeDefinition = {
  name: 'HugeLocale',
  type: 'interface',
  definition: Array.from({ length: 60 }, (_, i) => `  key${i}: string;`).join('\n'),
  package: '@urbicon-ui/blocks',
  members: 60,
  sourcePath: 'packages/blocks/src/lib/locales/huge.ts'
};

// Oversized type WITHOUT size metadata (e.g. produced by an older extractor):
// the summary must still be honest, falling back to the line count.
const BIG_TYPE_NO_META: TypeDefinition = {
  name: 'HugeBare',
  type: 'type',
  definition: Array.from({ length: 60 }, (_, i) => `| 'variant-${i}'`).join('\n'),
  package: '@urbicon-ui/blocks'
};

function apiFor(types: TypeDefinition[]): APIData {
  const component: ComponentAPIData = {
    name: 'Caped',
    props: [],
    variants: [],
    inheritance: [],
    examples: [],
    stats: { ...NO_STATS },
    group: 'primitives',
    types
  };
  return {
    components: { Caped: component },
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

describe('LLMDocumentationGenerator — per-type size cap in the Types section', () => {
  let root: string;
  let scopeDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'llmtypescap-'));
    scopeDir = path.join(root, 'blocks');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function generateAndRead(types: TypeDefinition[]): Promise<string> {
    const generator = new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'text'
    });
    await generator.generate([enriched('Caped')], apiFor(types));
    return fs.readFile(path.join(scopeDir, 'primitives', 'caped', 'llm.txt'), 'utf-8');
  }

  it('keeps small helper types as full fenced definitions', async () => {
    const content = await generateAndRead([SMALL_TYPE, BIG_TYPE]);
    expect(content).toContain('### Types');
    expect(content).toContain('interface SmallHelper {');
    expect(content).toContain('target?: string;');
  });

  it('collapses oversized types to a member-count summary with source path', async () => {
    const content = await generateAndRead([SMALL_TYPE, BIG_TYPE]);
    expect(content).toContain(
      '- `interface HugeLocale` — 60 members, definition omitted (62 lines; full definition: packages/blocks/src/lib/locales/huge.ts)'
    );
    // No truncated body: none of the members leak into the file.
    expect(content).not.toContain('key0: string;');
    expect(content).not.toContain('key59: string;');
  });

  it('falls back to line count when an oversized type carries no size metadata', async () => {
    const content = await generateAndRead([BIG_TYPE_NO_META]);
    expect(content).toMatch(
      /- `type HugeBare` — 60 lines, definition omitted \(60 lines; full definition in the package sources\)/
    );
    expect(content).not.toContain("'variant-0'");
  });
});
