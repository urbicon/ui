import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFlagAliases } from '../command-flags.js';
import { runHook } from './hook.js';

/** The real stdin descriptor, restored after each test. */
const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');

/** Feed a string as the process's stdin (an async-iterable readable). */
function feedStdin(data: string): void {
  Object.defineProperty(process, 'stdin', {
    value: Readable.from([Buffer.from(data, 'utf-8')]),
    configurable: true
  });
}

/** A PostToolUse event for an Edit of `filePath`. */
function event(filePath: string, tool = 'Edit'): string {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: tool,
    tool_input: { file_path: filePath }
  });
}

describe('urbicon hook (PostToolUse adapter)', () => {
  let dir: string;
  let err: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urbicon-hook-'));
    err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalStdin) Object.defineProperty(process, 'stdin', originalStdin);
    await rm(dir, { recursive: true, force: true });
  });

  const stderr = (): string => err.mock.calls.map((c: unknown[]) => c[0]).join('\n');

  it('passes a clean edit silently (exit 0, no stderr)', async () => {
    const file = join(dir, 'Clean.svelte');
    await writeFile(file, '<button class="px-4 py-2">Save</button>\n');
    feedStdin(event(file));
    expect(await runHook([], {})).toBe(0);
    expect(stderr()).toBe('');
  });

  it('blocks a bad edit with exit 2 and the findings on stderr', async () => {
    const file = join(dir, 'Bad.svelte');
    await writeFile(file, '<div class="bg-red-500 text-white">Hi</div>\n');
    feedStdin(event(file));
    expect(await runHook([], {})).toBe(2);
    const out = stderr();
    expect(out).toContain('bg-red-500'); // the offending token
    expect(out).toContain('design gate'); // the closing instruction
  });

  it('ignores a non-svelte edit (exit 0)', async () => {
    const file = join(dir, 'script.ts');
    await writeFile(file, 'export const x = "bg-red-500";\n');
    feedStdin(event(file));
    expect(await runHook([], {})).toBe(0);
    expect(stderr()).toBe('');
  });

  it('no-ops on an event without a file_path (exit 0)', async () => {
    feedStdin(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }));
    expect(await runHook([], {})).toBe(0);
  });

  it('no-ops on an unparseable event, never breaking the edit flow (exit 0)', async () => {
    feedStdin('not json at all');
    expect(await runHook([], {})).toBe(0);
  });

  it('no-ops when the edited file has vanished (exit 0)', async () => {
    feedStdin(event(join(dir, 'gone.svelte')));
    expect(await runHook([], {})).toBe(0);
  });

  it('gates the craft axis only when --craft-floor is given', async () => {
    const file = join(dir, 'Generic.svelte');
    await writeFile(
      file,
      '<div style="font-family: Arial; color: #888">\n' +
        '  <p style="text-align: center">Lorem ipsum dolor sit amet</p>\n' +
        '</div>\n'
    );
    // Token-correct: without a floor the generic page passes the hook.
    feedStdin(event(file));
    expect(await runHook([], {})).toBe(0);
    // With a floor, the low craft score blocks.
    feedStdin(event(file));
    expect(await runHook([], { 'craft-floor': '90' })).toBe(2);
    expect(stderr()).toContain('craft floor');
  });

  it('blocks the same way under the pre-rename --slop-floor spelling', async () => {
    // A hook command lives in a checked-in `.claude/settings.json`; the rename must
    // not turn every edit into an "unknown flag" exit 2.
    const file = join(dir, 'Generic.svelte');
    await writeFile(
      file,
      '<div style="font-family: Arial; color: #888">\n' +
        '  <p style="text-align: center">Lorem ipsum dolor sit amet</p>\n' +
        '</div>\n'
    );
    const legacy: Record<string, string | boolean> = { 'slop-floor': '90' };
    const notices = applyFlagAliases('hook', legacy);
    expect(notices).toHaveLength(1);

    feedStdin(event(file));
    expect(await runHook([], legacy)).toBe(2);
    expect(stderr()).toContain('craft floor');
  });

  it('surfaces a misconfigured --craft-floor as a usage error (exit 2)', async () => {
    feedStdin(event(join(dir, 'whatever.svelte')));
    expect(await runHook([], { 'craft-floor': 'oops' })).toBe(2);
    expect(stderr()).toContain('--craft-floor');
  });

  it('respects manifest token overrides when linting the edited file', async () => {
    const file = join(dir, 'Brand.svelte');
    await writeFile(file, '<div class="bg-surface-brand">x</div>\n');
    const manifest = join(dir, 'design.manifest.md');
    await writeFile(manifest, '## Token Overrides\n\n- `surface-brand`\n');

    // The unknown token is only a warning, so it never blocks by default — assert
    // the override path runs by gating warnings with --strict.
    feedStdin(event(file));
    expect(await runHook([], { strict: true, manifest: join(dir, 'absent.md') })).toBe(2);
    feedStdin(event(file));
    expect(await runHook([], { strict: true, manifest })).toBe(0);
  });
});
