import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext } from './context.js';
import { runInit } from './init.js';

/**
 * The context-block staleness note: `context` is step 1 of the design loop, so
 * it is the one place an agent reliably learns that the init block predates the
 * installed CLI — and can fix it by re-running `init`. Runs in a temp cwd
 * because the check scans the working directory for AGENTS.md / CLAUDE.md.
 * (The manifest-summary behaviour of `context` is covered in manifest.test.ts.)
 */
describe('runContext — context-block staleness', () => {
  let dir: string;
  let originalCwd: string;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'urbicon-context-'));
    process.chdir(dir);
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const logged = (): string => log.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');

  const block = (marker: string): string =>
    `${marker} — managed block -->\n## Urbicon UI\n<!-- urbicon:end -->\n`;

  it('stays quiet when no context block exists', async () => {
    expect(await runContext([], {})).toBe(0);
    expect(logged()).not.toContain('context block');
  });

  it('flags a block stamped by an older version', async () => {
    await writeFile(join(dir, 'AGENTS.md'), block('<!-- urbicon:start v0.0.1'));
    await runContext([], {});
    expect(logged()).toContain('written by urbicon v0.0.1');
    expect(logged()).toContain('urbicon init');
  });

  it('flags an unstamped block whose body differs from the template', async () => {
    await writeFile(join(dir, 'AGENTS.md'), block('<!-- urbicon:start'));
    await runContext([], {});
    expect(logged()).toContain("no longer matches the installed CLI's template");
  });

  it('stays quiet when init just wrote the block', async () => {
    await runInit([], {}); // stamps the real installed version
    log.mockClear();
    await runContext([], {});
    expect(logged()).not.toContain('⚠');
  });

  it('stays quiet on a verbatim, unstamped paste of the current template', async () => {
    // The template header explicitly invites hand-pasting — a byte-for-byte copy
    // of the current template is current, stamp or no stamp. Staleness is content,
    // not provenance.
    const template = await readFile(
      new URL('../../../templates/AGENTS.md', import.meta.url),
      'utf-8'
    );
    await writeFile(join(dir, 'AGENTS.md'), template);
    await runContext([], {});
    expect(logged()).not.toContain('⚠');
  });

  it('flags a current-version stamp whose body was edited inside the markers', async () => {
    await runInit([], {});
    const path = join(dir, 'AGENTS.md');
    const edited = (await readFile(path, 'utf-8')).replace(
      '**Read the intent**',
      '**Skip the intent**'
    );
    await writeFile(path, edited);
    log.mockClear();
    await runContext([], {});
    expect(logged()).toContain("no longer matches the installed CLI's template");
  });

  it('finds the block in CLAUDE.md too', async () => {
    await writeFile(join(dir, 'CLAUDE.md'), block('<!-- urbicon:start v0.0.1'));
    await runContext([], {});
    expect(logged()).toContain('CLAUDE.md context block');
  });

  it('exposes the state in --json as contextBlock', async () => {
    await writeFile(join(dir, 'AGENTS.md'), block('<!-- urbicon:start v0.0.1'));
    log.mockClear();
    await runContext([], { json: true });
    const parsed = JSON.parse(logged()) as {
      contextBlock: { file: string; version: string | null; stale: boolean };
    };
    expect(parsed.contextBlock.file).toBe('AGENTS.md');
    expect(parsed.contextBlock.version).toBe('0.0.1');
    expect(parsed.contextBlock.stale).toBe(true);
  });
});
