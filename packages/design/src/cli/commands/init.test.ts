import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from './init.js';

let dir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'urbicon-init-'));
  process.chdir(dir);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const read = (p: string): Promise<string> => readFile(join(dir, p), 'utf-8');

describe('runInit', () => {
  it('creates AGENTS.md with the context block and scaffolds the manifest', async () => {
    const code = await runInit([], {});
    expect(code).toBe(0);
    expect(await read('AGENTS.md')).toContain('urbicon:start');
    expect(await read('AGENTS.md')).toContain('Urbicon UI');
    expect(await read('design.manifest.md')).toContain('Product Intent');
  });

  it('appends the block to an existing AGENTS.md without destroying it', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Mine\n\nKeep me.\n');
    await runInit([], {});
    const agents = await read('AGENTS.md');
    expect(agents).toContain('Keep me.');
    expect(agents).toContain('urbicon:start');
  });

  it('is idempotent — a second run leaves AGENTS.md byte-identical', async () => {
    await runInit([], {});
    const first = await read('AGENTS.md');
    await runInit([], {});
    expect(await read('AGENTS.md')).toBe(first);
  });

  it('refreshes the block in place rather than duplicating it', async () => {
    await runInit([], {});
    await runInit([], {});
    expect(await read('AGENTS.md')).toMatch(/urbicon:start/);
    expect((await read('AGENTS.md')).match(/urbicon:start/g)).toHaveLength(1);
  });

  it('never overwrites an existing manifest', async () => {
    await writeFile(join(dir, 'design.manifest.md'), 'CUSTOM INTENT\n');
    await runInit([], {});
    expect(await read('design.manifest.md')).toBe('CUSTOM INTENT\n');
  });

  it('--hook merges the PostToolUse hook into .claude/settings.json', async () => {
    await runInit([], { hook: true });
    expect(await read('.claude/settings.json')).toContain('urbicon hook');
  });

  it('--hook preserves existing settings and merges exactly once', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(
      join(dir, '.claude/settings.json'),
      JSON.stringify({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash' }] } }, null, 2)
    );
    await runInit([], { hook: true });
    await runInit([], { hook: true }); // second run must not duplicate
    const settings = JSON.parse(await read('.claude/settings.json'));
    expect(settings.model).toBe('opus'); // unrelated key preserved
    expect(settings.hooks.PreToolUse).toHaveLength(1); // existing hook preserved
    expect(settings.hooks.PostToolUse).toHaveLength(1); // merged once, not twice
    expect(JSON.stringify(settings.hooks.PostToolUse)).toContain('urbicon hook');
  });

  it('--ci writes the design-gate workflow', async () => {
    await runInit([], { ci: true });
    expect(await read('.github/workflows/design-gate.yml')).toContain('urbicon validate');
  });

  it('fails loud on an unterminated urbicon:start marker instead of duplicating', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Mine\n\n<!-- urbicon:start truncated, no end -->\n');
    const before = await read('AGENTS.md');
    const code = await runInit([], {});
    expect(code).toBe(1);
    expect(await read('AGENTS.md')).toBe(before); // never touched — no second block appended
  });

  it('--hook refuses a non-object settings.json instead of silently dropping the hook', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(join(dir, '.claude/settings.json'), '[]'); // valid JSON, wrong shape
    const code = await runInit([], { hook: true });
    expect(code).toBe(0); // init itself succeeds; only the hook step is skipped
    expect(await read('.claude/settings.json')).toBe('[]'); // left untouched, not rewritten
  });
});

/**
 * The primer step lives in `init`, not in the template, so that the template
 * stays a prompt base a harness can take verbatim. That split only holds if
 * both halves are asserted: the step must appear on the way into a consumer's
 * AGENTS.md, and it must be absent from the template that the harness reads.
 */
describe('runInit — the primer step', () => {
  it('adds the primer step by default, inside the loop', async () => {
    await runInit([], {});
    const agents = await read('AGENTS.md');
    expect(agents).toContain('bunx urbicon primer');
    // Placed as step 0, i.e. before the first numbered step — not appended
    // somewhere after it, where an agent would read it too late to act on.
    expect(agents.indexOf('urbicon primer')).toBeLessThan(agents.indexOf('1. **Read the intent**'));
  });

  it('omits it with --with-primer=false, for a harness that injects the primer itself', async () => {
    await runInit([], { 'with-primer': 'false' });
    const agents = await read('AGENTS.md');
    expect(agents).not.toContain('urbicon primer');
    // The rest of the block is unaffected — this is a subtraction, not a variant.
    expect(agents).toContain('1. **Read the intent**');
    expect(agents).toContain('urbicon:start');
  });

  it('keeps the step out of the shipped template', async () => {
    // The harness reads templates/AGENTS.md directly and must not find an
    // instruction it cannot act on. Guarding it here rather than in the harness
    // keeps the knowledge on the side that owns the template.
    const template = await readFile(
      new URL('../../../templates/AGENTS.md', import.meta.url),
      'utf-8'
    );
    expect(template).not.toContain('urbicon primer');
    expect(template).toContain('1. **Read the intent**');
  });

  it('stays idempotent with the step in place', async () => {
    await runInit([], {});
    const first = await read('AGENTS.md');
    await runInit([], {});
    expect(await read('AGENTS.md')).toBe(first);
  });

  it('switches an existing block from with-primer to without on re-run', async () => {
    await runInit([], {});
    expect(await read('AGENTS.md')).toContain('urbicon primer');
    await runInit([], { 'with-primer': 'false' });
    expect(await read('AGENTS.md')).not.toContain('urbicon primer');
  });
});
