import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import type { EnrichedComponentInfo } from '../src/types';
import type { LLMOutputConfig } from '../src/types/configuration';

// ---------------------------------------------------------------------------
// `loadDocsConfig` used to read only `result.docsConfig` and drop
// `result.errors` — so a docs.svelte whose docsConfig could not be parsed fell
// back to the defaults without a word. That is the silent fallback the AST
// parser replaced eval to remove, one station later: `llm.include: false` would
// flip back to `true` and emit an llm.txt the author opted out of.
//
// These tests pin the closed channel: a present-but-broken config throws (with
// the parser's file:line:column), warnings are surfaced, and an *absent*
// docs.svelte still quietly takes the defaults.
//
// They are also the first exercise of the docs.svelte resolution path at all:
// no component in the repo co-locates one today (docs:gen is 89/89 "No docs
// file provided"), so without these fixtures the whole branch is untested.
// ---------------------------------------------------------------------------

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'docs-config');

const LLM_CONFIG: LLMOutputConfig = {
  enabled: true,
  outputPath: path.join(FIXTURES, '__out__'),
  format: 'markdown'
};

/** Only `name` + `filePath` are read by loadDocsConfig/resolveDocsFilePath. */
const componentIn = (dir: string, name = 'Fixture'): EnrichedComponentInfo =>
  ({ name, filePath: path.join(FIXTURES, dir, `${name}.svelte`) }) as EnrichedComponentInfo;

/** loadDocsConfig is private; the wiring is what we need to assert. */
const loadDocsConfig = (generator: LLMDocumentationGenerator, component: EnrichedComponentInfo) =>
  (
    generator as unknown as {
      loadDocsConfig(c: EnrichedComponentInfo): Promise<Record<string, never>>;
    }
  ).loadDocsConfig(component);

let generator: LLMDocumentationGenerator;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  generator = new LLMDocumentationGenerator(LLM_CONFIG);
});

describe('loadDocsConfig — a co-located docs.svelte is actually read', () => {
  it('applies the authored config over the defaults', async () => {
    const config = await loadDocsConfig(generator, componentIn('valid'));

    // The whole point of the channel: the author's opt-out survives.
    expect(config.llm?.include).toBe(false);
    expect(config.llm?.maxSections).toBe(3);
    expect(config.meta?.title).toBe('Valid Fixture');
    // Unspecified keys still fall back to the defaults.
    expect(config.llm?.simplifyContent).toBe(true);
  });

  it('resolves the nested docs/docs.svelte candidate too', async () => {
    const config = await loadDocsConfig(generator, componentIn('nested'));
    expect(config.meta?.title).toBe('Nested Fixture');
  });

  it('takes the defaults silently when no docs.svelte is co-located', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // FIXTURES itself holds no docs.svelte — the 89/89 case in a real run.
    const config = await loadDocsConfig(generator, componentIn('.'));

    expect(config.llm?.include).toBe(true);
    // An absent config is a constant default, not a guess: nothing to report.
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('loadDocsConfig — errors are raised, not swallowed', () => {
  it('throws on a docsConfig that is not statically evaluable', async () => {
    await expect(loadDocsConfig(generator, componentIn('broken'))).rejects.toThrow(
      /docsConfig for Fixture could not be read/
    );
  });

  it("carries the parser's file:line:column into the thrown message", async () => {
    // `MAX` is a binding reference on line 5 of the broken fixture.
    await expect(loadDocsConfig(generator, componentIn('broken'))).rejects.toThrow(
      /docs\.svelte:5:41: cannot statically evaluate Identifier/
    );

    // The quoted position really does address `MAX` in the fixture on disk —
    // so the message sends the author to the right character, not a plausible one.
    const source = await fs.readFile(path.join(FIXTURES, 'broken', 'docs.svelte'), 'utf-8');
    const line = source.split('\n')[5 - 1] as string;
    expect(line.slice(41 - 1)).toBe('MAX }');
  });

  it('does NOT fall back to the defaults for a broken config', async () => {
    // The regression: the old code returned mergeWithSvelteDocsDefaults({}),
    // flipping the fixture's `llm.include: false` back to `true`.
    const result = await loadDocsConfig(generator, componentIn('broken')).catch((e) => e);

    expect(result).toBeInstanceOf(Error);
    expect((result as Record<string, unknown>).llm).toBeUndefined();
  });

  it('does not cache a failed parse (a fixed file is picked up on retry)', async () => {
    await expect(loadDocsConfig(generator, componentIn('broken'))).rejects.toThrow();
    // Second call must re-parse and fail again, not serve a poisoned cache entry.
    await expect(loadDocsConfig(generator, componentIn('broken'))).rejects.toThrow(
      /cannot statically evaluate Identifier/
    );
  });
});

describe('loadDocsConfig — warnings are passed through', () => {
  it('logs the parser warnings and still returns the config', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = await loadDocsConfig(generator, componentIn('warns'));

    expect(config.meta?.title).toBe('Warns Fixture');
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes('[Fixture] docsConfig:'))).toBe(true);
    expect(messages.some((m) => m.includes('Playground featured array is empty'))).toBe(true);
  });

  it('a warning is advisory only — it never throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(loadDocsConfig(generator, componentIn('warns'))).resolves.toBeDefined();
  });
});
