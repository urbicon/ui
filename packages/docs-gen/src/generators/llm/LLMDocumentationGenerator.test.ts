import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { APIData } from '../../types';
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
