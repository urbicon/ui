import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('gates the slop axis only when --slop-floor is given (F-S6-3)', async () => {
    // A token-correct but generic page: many slop notes, zero correctness errors.
    const file = join(dir, 'Generic.svelte');
    await writeFile(
      file,
      '<div style="font-family: Arial; color: #888">\n' +
        '  <p style="text-align: center">Lorem ipsum dolor sit amet</p>\n' +
        '</div>\n'
    );
    // Advisory by default: slop notes never fail the gate.
    expect(await runValidate([file], {})).toBe(0);
    // With a floor, a low slop score fails — opt-in enforcement.
    expect(await runValidate([file], { 'slop-floor': '90' })).toBe(1);
    // A floor the page clears passes.
    expect(await runValidate([file], { 'slop-floor': '0' })).toBe(0);
  });

  it('rejects a malformed --slop-floor as a usage error (exit 2)', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    expect(await runValidate([file], { 'slop-floor': '101' })).toBe(2);
    expect(await runValidate([file], { 'slop-floor': 'abc' })).toBe(2);
    expect(await runValidate([file], { 'slop-floor': true })).toBe(2); // bare flag, no number
  });

  it('carries slopFloor in the --json envelope', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    await runValidate([file], { json: true, 'slop-floor': '40' });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { slopFloor: number | null; ok: boolean };
    expect(parsed.slopFloor).toBe(40);
    expect(parsed.ok).toBe(true);
  });

  it('applies ## Token Overrides from the manifest so a project token is not flagged (F-S4-1)', async () => {
    const file = join(dir, 'Brand.svelte');
    // `bg-surface-brand` looks semantic but is not a built-in token → hallucination warning.
    await writeFile(file, '<div class="bg-surface-brand">x</div>\n');

    // No override: the warning fails --strict. (Point at an absent manifest to stay hermetic.)
    expect(await runValidate([file], { strict: true, manifest: join(dir, 'absent.md') })).toBe(1);

    // Declared in the manifest: the warning is gone → passes even under --strict.
    const manifest = join(dir, 'design.manifest.md');
    await writeFile(manifest, '## Token Overrides\n\n- `surface-brand`\n');
    expect(await runValidate([file], { strict: true, manifest })).toBe(0);
  });

  it('suppresses manifest-##-Exempt rules for the matching file only (visible, not silent)', async () => {
    const bad = '<div class="bg-red-500">x</div>\n';
    const poster = join(dir, 'Poster.svelte');
    const other = join(dir, 'Other.svelte');
    await writeFile(poster, bad);
    await writeFile(other, bad);
    const manifest = join(dir, 'design.manifest.md');
    await writeFile(manifest, '## Exempt\n\n- `Poster.svelte` — `raw-tailwind-color` — poster\n');

    // The exempted file passes; the sibling with the same violation still fails.
    expect(await runValidate([poster], { manifest })).toBe(0);
    expect(await runValidate([other], { manifest })).toBe(1);

    // The suppression is surfaced in the JSON report, never swallowed.
    log.mockClear();
    await runValidate([poster], { manifest, json: true });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as {
      results: { suppressed?: { ruleId: string; count: number; source: string }[] }[];
    };
    expect(parsed.results[0]?.suppressed).toEqual([
      { ruleId: 'raw-tailwind-color', count: 1, source: 'option' }
    ]);
  });

  it('honours an in-file urbicon-ignore pragma without any manifest', async () => {
    const file = join(dir, 'Landing.svelte');
    await writeFile(
      file,
      '<!-- urbicon-ignore raw-tailwind-color — renders linter output as prose -->\n' +
        '<div class="bg-red-500">x</div>\n'
    );
    expect(await runValidate([file], { manifest: join(dir, 'absent.md') })).toBe(0);
  });

  it('a typo in an Exempt rule id warns loudly instead of silently suppressing nothing', async () => {
    const file = join(dir, 'Typo.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    const manifest = join(dir, 'design.manifest.md');
    await writeFile(manifest, '## Exempt\n\n- `Typo.svelte` — `raw-tailwind-colour`\n');
    // invalid-suppression is a warning: passes by default, fails under --strict.
    expect(await runValidate([file], { manifest })).toBe(0);
    expect(await runValidate([file], { manifest, strict: true })).toBe(1);
  });

  it('echoes the applied overrides in the --json envelope', async () => {
    const file = join(dir, 'Brand.svelte');
    await writeFile(file, '<div class="bg-surface-brand">x</div>\n');
    const manifest = join(dir, 'design.manifest.md');
    await writeFile(manifest, '## Token Overrides\n\n- `surface-brand`\n- `text-brand`\n');

    await runValidate([file], { json: true, manifest });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { extraTokens: string[] };
    expect(parsed.extraTokens).toEqual(['surface-brand', 'text-brand']);
  });

  it('appends a drift entry to the sidecar history with --record', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    const manifest = join(dir, 'design.manifest.md');

    expect(await runValidate([file], { record: true, manifest })).toBe(0);

    const sidecar = join(dir, 'design.manifest.history.ndjson');
    const entry = JSON.parse((await readFile(sidecar, 'utf-8')).trim()) as {
      files: number;
      correctness: number;
      date: string;
    };
    expect(entry.files).toBe(1);
    expect(entry.correctness).toBe(100);
    expect(typeof entry.date).toBe('string');

    // A second run appends, never overwrites.
    await runValidate([file], { record: true, manifest });
    const lines = (await readFile(sidecar, 'utf-8')).trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('does not write history without --record', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    await runValidate([file], { manifest: join(dir, 'design.manifest.md') });
    await expect(readFile(join(dir, 'design.manifest.history.ndjson'), 'utf-8')).rejects.toThrow();
  });
});
