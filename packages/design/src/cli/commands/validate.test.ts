import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runValidate } from './validate.js';

describe('urbicon validate', () => {
  let dir: string;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urbicon-validate-'));
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('passes a clean component (exit 0)', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    expect(await runValidate([file], {})).toBe(0);
  });

  it('fails on a raw Tailwind colour (exit 1)', async () => {
    const file = join(dir, 'Bad.svelte');
    await writeFile(file, '<div class="bg-red-500 text-white">Hi</div>\n');
    expect(await runValidate([file], {})).toBe(1);
  });

  it('emits a machine-readable report with --json', async () => {
    const file = join(dir, 'Bad.svelte');
    await writeFile(file, '<div class="bg-red-500">Hi</div>\n');
    await runValidate([file], { json: true });

    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as {
      ok: boolean;
      results: { counts: { error: number } }[];
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.results[0]?.counts.error).toBeGreaterThan(0);
  });

  it('recurses a directory and skips node_modules', async () => {
    await writeFile(join(dir, 'Good.svelte'), '<button class="px-4 py-2">Go</button>\n');
    // A failing file inside node_modules must be ignored (skipped dir).
    const vendored = join(dir, 'node_modules', 'pkg');
    await mkdir(vendored, { recursive: true });
    await writeFile(join(vendored, 'Evil.svelte'), '<div class="bg-blue-500">x</div>\n');
    expect(await runValidate([dir], {})).toBe(0);
  });

  it('treats warnings as passing by default but failing under --strict', async () => {
    // `bg-status-danger` looks semantic but is not a real token → warning severity.
    const file = join(dir, 'Warn.svelte');
    await writeFile(file, '<div class="bg-status-danger">x</div>\n');
    expect(await runValidate([file], {})).toBe(0);
    expect(await runValidate([file], { strict: true })).toBe(1);
  });

  it('reports a usage error for a missing path (exit 2)', async () => {
    expect(await runValidate([join(dir, 'nope.svelte')], {})).toBe(2);
  });
});
