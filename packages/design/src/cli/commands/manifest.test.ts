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

  it('record-decision --supersedes marks both ends of the link', async () => {
    const manifest = join(dir, 'design.manifest.md');
    await runRecordDecision([], {
      title: 'Card padding sm',
      decision: 'Use p-2',
      date: '2026-06-01',
      manifest
    });
    const code = await runRecordDecision([], {
      title: 'Card padding lg',
      decision: 'Use p-6',
      date: '2026-06-20',
      supersedes: 'Card padding sm',
      manifest
    });
    expect(code).toBe(0);

    const content = await readFile(manifest, 'utf-8');
    expect(content).toContain('**Superseded by:** Card padding lg');
    expect(content).toContain('**Supersedes:** Card padding sm');
    // The retracted decision stays on record.
    expect(content).toContain('Use p-2');
  });

  it('record-decision rejects --supersedes for a title nobody recorded (exit 2, no write)', async () => {
    const manifest = join(dir, 'design.manifest.md');
    await runRecordDecision([], {
      title: 'Card padding sm',
      decision: 'Use p-2',
      manifest
    });
    const before = await readFile(manifest, 'utf-8');

    const code = await runRecordDecision([], {
      title: 'Card padding lg',
      decision: 'Use p-6',
      supersedes: 'Cart padding sm',
      manifest
    });
    expect(code).toBe(2);
    // Nothing was written — the new ADR must not claim to replace a phantom.
    expect(await readFile(manifest, 'utf-8')).toBe(before);
  });

  it('record-decision keeps the log ordered by date, not by arrival', async () => {
    const manifest = join(dir, 'design.manifest.md');
    const recorded: [string, string][] = [
      ['newest', '2026-06-20'],
      ['oldest', '2026-06-01'],
      ['middle', '2026-06-10']
    ];
    for (const [title, date] of recorded) {
      await runRecordDecision([], { title, decision: `do ${title}`, date, manifest });
    }
    const headings = [...(await readFile(manifest, 'utf-8')).matchAll(/^### .+ — (.+)$/gm)].map(
      (m) => m[1]
    );
    expect(headings).toEqual(['newest', 'middle', 'oldest']);
  });

  it('context drops a superseded decision from the active list', async () => {
    const manifest = join(dir, 'design.manifest.md');
    await runRecordDecision([], { title: 'A', decision: 'Do A', date: '2026-06-01', manifest });
    await runRecordDecision([], {
      title: 'B',
      decision: 'Do B',
      date: '2026-06-20',
      supersedes: 'A',
      manifest
    });

    log.mockClear();
    await runContext([], { manifest });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const active = out.slice(out.indexOf('## Design Decisions'), out.indexOf('**Superseded'));
    expect(active).toContain('- **2026-06-20 — B**');
    expect(active).not.toContain('- **2026-06-01 — A**');
    expect(out).toContain('~~**2026-06-01 — A**~~');
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
        craft: 80
      })}\n`
    );

    log.mockClear();
    await runContext([], { manifest, json: true });
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    const parsed = JSON.parse(out) as { history: { craft: number }[] };
    expect(parsed.history[0]?.craft).toBe(80);
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
