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
