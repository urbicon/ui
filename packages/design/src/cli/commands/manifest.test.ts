import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runContext } from './context.js';
import { runRecordDecision } from './record-decision.js';
import { runSyncManifest } from './sync-manifest.js';

describe('urbicon manifest commands', () => {
  let dir: string;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urbicon-manifest-'));
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('record-decision creates the manifest and appends an ADR', async () => {
    const manifest = join(dir, 'design.manifest.md');
    const code = await runRecordDecision([], {
      title: 'Tabs for settings',
      decision: 'Use Tab over Sidebar',
      manifest,
      date: '2026-06-21'
    });
    expect(code).toBe(0);

    const content = await readFile(manifest, 'utf-8');
    expect(content).toContain('Tabs for settings');
    expect(content).toContain('2026-06-21');
  });

  it('record-decision rejects a missing title (exit 2)', async () => {
    const code = await runRecordDecision([], {
      decision: 'x',
      manifest: join(dir, 'design.manifest.md')
    });
    expect(code).toBe(2);
  });

  it('record-decision refuses a non-.md manifest path (exit 2)', async () => {
    const code = await runRecordDecision([], {
      title: 't',
      decision: 'd',
      manifest: join(dir, 'notes.txt')
    });
    expect(code).toBe(2);
  });

  it('record-decision rejects a malformed --date (exit 2)', async () => {
    const code = await runRecordDecision([], {
      title: 't',
      decision: 'd',
      date: '21.06.2026',
      manifest: join(dir, 'design.manifest.md')
    });
    expect(code).toBe(2);
  });

  it('context reports a missing manifest gracefully (exit 0)', async () => {
    expect(await runContext([], { manifest: join(dir, 'none.md') })).toBe(0);
  });

  it('context reads back a recorded decision as JSON', async () => {
    const manifest = join(dir, 'design.manifest.md');
    await runRecordDecision([], { title: 'Decision A', decision: 'Do A', manifest });

    log.mockClear();
    await runContext([], { manifest, json: true });

    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { decisions: { title: string }[] };
    expect(parsed.decisions[0]?.title).toBe('Decision A');
  });

  it('context includes the sidecar validation history in its JSON', async () => {
    const manifest = join(dir, 'design.manifest.md');
    await runRecordDecision([], { title: 'A', decision: 'Do A', manifest });
    await writeFile(
      join(dir, 'design.manifest.history.ndjson'),
      `${JSON.stringify({
        date: '2026-06-21T00:00:00.000Z',
        files: 2,
        errors: 0,
        warnings: 0,
        infos: 1,
        correctness: 100,
        slop: 80
      })}\n`
    );

    log.mockClear();
    await runContext([], { manifest, json: true });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { history: { slop: number }[] };
    expect(parsed.history[0]?.slop).toBe(80);
  });

  it('sync-manifest indexes data-design-pattern markers', async () => {
    const src = join(dir, 'src');
    await mkdir(src, { recursive: true });
    await writeFile(join(src, '+page.svelte'), '<div data-design-pattern="dashboard">x</div>');

    const manifest = join(dir, 'design.manifest.md');
    const code = await runSyncManifest([], { src, manifest });
    expect(code).toBe(0);

    const content = await readFile(manifest, 'utf-8');
    expect(content).toContain('dashboard');
    expect(content).toContain('src/+page.svelte');
  });
});
