import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFlagAliases } from '../command-flags.js';
import { printError } from '../output.js';
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
    // An icon-only button with no accessible name → warning severity.
    //
    // This case used `bg-status-danger` until 2026-07-31, when
    // `token-hallucination` was promoted from `warning` to `error` — a
    // hallucinated token renders completely unstyled, so it belongs behind the
    // error gate rather than behind `--strict`. That made this case assert the
    // opposite of the rule it was testing, which is why it needs a source of
    // warnings that is genuinely advisory.
    const file = join(dir, 'Warn.svelte');
    await writeFile(file, '<button class="p-2"><svg /></button>\n');
    expect(await runValidate([file], {})).toBe(0);
    expect(await runValidate([file], { strict: true })).toBe(1);
  });

  it('fails the default gate on a hallucinated token, without --strict', async () => {
    // The promotion, pinned from the CLI side: `bg-status-danger` looks
    // semantic but names no token, so the element renders with no background at
    // all. Measured on the artifact-recorder spike as "correctness 25 with zero
    // errors" — passing a gate while rendering unstyled.
    const file = join(dir, 'Hallucinated.svelte');
    await writeFile(file, '<div class="bg-status-danger">x</div>\n');
    expect(await runValidate([file], {})).toBe(1);
  });

  it('reports a usage error for a missing path (exit 2)', async () => {
    expect(await runValidate([join(dir, 'nope.svelte')], {})).toBe(2);
  });

  it('refuses to pass on nothing — no path and empty stdin is a usage error (exit 2)', async () => {
    // The gate's worst failure mode: `urbicon validate` with no path in a
    // non-interactive shell (a CI step, a harness that closes stdin) linted the
    // empty string and printed "✓ no issues", exit 0.
    const stdin = vi.spyOn(process, 'stdin', 'get');
    stdin.mockReturnValue(Readable.from([]) as unknown as typeof process.stdin);
    expect(await runValidate([], {})).toBe(2);

    // Explicit `-` with nothing piped in is the same nothing.
    stdin.mockReturnValue(Readable.from([]) as unknown as typeof process.stdin);
    expect(await runValidate(['-'], {})).toBe(2);
  });

  it('still lints real markup on stdin', async () => {
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([
        Buffer.from('<div class="bg-red-500">x</div>\n')
      ]) as unknown as typeof process.stdin
    );
    expect(await runValidate(['-'], {})).toBe(1);
  });

  it('gates the craft axis only when --craft-floor is given (F-S6-3)', async () => {
    // A token-correct but generic page: many craft notes, zero correctness errors.
    const file = join(dir, 'Generic.svelte');
    await writeFile(
      file,
      '<div style="font-family: Arial; color: #888">\n' +
        '  <p style="text-align: center">Lorem ipsum dolor sit amet</p>\n' +
        '</div>\n'
    );
    // Advisory by default: craft notes never fail the gate.
    expect(await runValidate([file], {})).toBe(0);
    // With a floor, a low craft score fails — opt-in enforcement.
    expect(await runValidate([file], { 'craft-floor': '90' })).toBe(1);
    // A floor the page clears passes.
    expect(await runValidate([file], { 'craft-floor': '0' })).toBe(0);
  });

  it('rejects a malformed --craft-floor as a usage error (exit 2)', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    expect(await runValidate([file], { 'craft-floor': '101' })).toBe(2);
    expect(await runValidate([file], { 'craft-floor': 'abc' })).toBe(2);
    expect(await runValidate([file], { 'craft-floor': true })).toBe(2); // bare flag, no number
  });

  it('gates identically under the pre-rename --slop-floor spelling', async () => {
    // Both spellings, one verdict: `index.ts` folds the deprecated flag before
    // dispatch, so a CI step pinned to the old name keeps gating instead of
    // exiting 2 with "unknown flag".
    const file = join(dir, 'Generic.svelte');
    await writeFile(
      file,
      '<div style="font-family: Arial; color: #888">\n' +
        '  <p style="text-align: center">Lorem ipsum dolor sit amet</p>\n' +
        '</div>\n'
    );
    const legacy: Record<string, string | boolean> = { 'slop-floor': '90' };
    applyFlagAliases('validate', legacy);
    expect(await runValidate([file], legacy)).toBe(1);
    expect(await runValidate([file], { 'craft-floor': '90' })).toBe(1);
  });

  it('keeps the deprecation notice off stdout, so --json stays parseable', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');

    const flags: Record<string, string | boolean> = { json: true, 'slop-floor': '40' };
    for (const notice of applyFlagAliases('validate', flags)) printError(notice);
    await runValidate([file], flags);

    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    expect(() => JSON.parse(out)).not.toThrow(); // the notice went to stderr
    expect(out).not.toContain('deprecated');
    expect((JSON.parse(out) as { craftFloor: number | null }).craftFloor).toBe(40);

    const err = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n');
    expect(err).toContain('--slop-floor');
    expect(err).toContain('--craft-floor');
  });

  it('carries craftFloor in the --json envelope', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    await runValidate([file], { json: true, 'craft-floor': '40' });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { craftFloor: number | null; ok: boolean };
    expect(parsed.craftFloor).toBe(40);
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

  // A shape decision taken at the tier level lives in a stylesheet no linted
  // `.svelte` unit can see, so `validate` resolves it project-side and hands it to
  // the engine. Without this the note fires against exactly the projects that used
  // the mechanism the design system sanctions.
  describe('project-level shape decision', () => {
    const cards = '<Card>a</Card><Card>b</Card><Card>c</Card>\n';
    const notes = (): string => log.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');

    it('nudges when nothing decides shape', async () => {
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src', 'Page.svelte'), cards);
      await runValidate([join(dir, 'src')], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).toContain('no-radius-strategy');
    });

    it('stays quiet when a stylesheet retunes a tier token', async () => {
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src', 'Page.svelte'), cards);
      await writeFile(
        join(dir, 'src', 'app.css'),
        '@theme {\n  --radius-contain: var(--radius-xl);\n}\n'
      );
      await runValidate([join(dir, 'src')], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).not.toContain('no-radius-strategy');
    });

    it('finds the stylesheet from the manifest root when a single file is linted', async () => {
      // The hook case: one edited file, theme two directories away.
      await mkdir(join(dir, 'src', 'routes', 'settings'), { recursive: true });
      const file = join(dir, 'src', 'routes', 'settings', '+page.svelte');
      await writeFile(file, cards);
      await writeFile(
        join(dir, 'src', 'routes', 'layout.css'),
        '@theme { --radius-contain: 0; }\n'
      );
      await runValidate([file], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).not.toContain('no-radius-strategy');
    });

    it('does not accept a commented-out tier token as a decision', async () => {
      // The expensive direction: a false negative here disables the nudge
      // project-wide and silently.
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src', 'Page.svelte'), cards);
      await writeFile(
        join(dir, 'src', 'app.css'),
        '/* --radius-contain: var(--radius-md); TODO: decide later */\n'
      );
      await runValidate([join(dir, 'src')], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).toContain('no-radius-strategy');
    });

    it('names the file that answered the nudge, so the suppression is visible', async () => {
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src', 'Page.svelte'), cards);
      await writeFile(join(dir, 'src', 'app.css'), '@theme { --radius-contain: 0; }\n');
      await runValidate([join(dir, 'src')], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).toContain('Shape decided at the tier in');
      expect(notes()).toContain('app.css');
    });

    it('does not accept a mere reference to a tier token as a decision', async () => {
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src', 'Page.svelte'), cards);
      await writeFile(
        join(dir, 'src', 'app.css'),
        '.tile { border-radius: var(--radius-contain); }\n'
      );
      await runValidate([join(dir, 'src')], { manifest: join(dir, 'design.manifest.md') });
      expect(notes()).toContain('no-radius-strategy');
    });
  });
});
