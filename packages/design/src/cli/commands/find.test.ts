import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOSEST_NOTE } from '@urbicon-ui/design-engine/search';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runFind } from './find.js';

// Point the content reader at the hermetic fixture bundle (no docs:gen / real bundle
// needed). Set before any command runs — `ensureContentDir` honours it when present.
process.env.URBICON_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
  'content'
);

let out: string[];
let err: string[];

beforeEach(() => {
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
    out.push(String(m));
  });
  vi.spyOn(console, 'error').mockImplementation((m?: unknown) => {
    err.push(String(m));
  });
});
afterEach(() => vi.restoreAllMocks());

const stdout = (): string => out.join('\n');
const stderr = (): string => err.join('\n');

describe('runFind', () => {
  it('ranks an exact match first and prints a scannable entry', async () => {
    const code = await runFind(['button'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('Button  ·  button');
    expect(stdout()).toContain('Click to trigger an action.');
  });

  it('truncates a multi-line description to its first line', async () => {
    await runFind(['button'], {});
    expect(stdout()).not.toContain('Second paragraph');
  });

  it('emits JSON catalog entries with --json', async () => {
    const code = await runFind(['button'], { json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout());
    expect(parsed[0].slug).toBe('button');
  });

  it('lists the whole catalog when given no query', async () => {
    const code = await runFind([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('button');
    expect(stdout()).toContain('badge');
  });

  it('filters by --tag', async () => {
    await runFind([], { tag: 'display' });
    expect(stdout()).toContain('badge');
    expect(stdout()).not.toContain('Button  ·  button');
  });

  it('reports no matches without failing — find is a query, not a gate', async () => {
    const code = await runFind(['zzzznotacomponent'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('No components match');
    // Nothing scored at all, so there is nothing to offer as a near miss.
    expect(stdout()).not.toContain('Closest');
  });

  it('reports no match for a word that only starts a longer one, and names the near miss', async () => {
    // "stat" starts Badge's "status" and is not it — the shape of #444, where
    // `find rating` answered Separator through "sepa·rating".
    const code = await runFind(['stat'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('No components match "stat"');
    expect(stdout()).not.toContain('component(s) matching');
    expect(stdout()).toContain('Closest (weak): Badge (badge)');
    // The same sentence the MCP tool prints — one constant, so they cannot drift.
    expect(stdout()).toContain(CLOSEST_NOTE);
  });

  it('keeps a name fragment out of the matches and in the closest list', async () => {
    await runFind(['butt'], {});
    expect(stdout()).toContain('No components match "butt"');
    expect(stdout()).toContain('Closest (weak): Button (button)');
  });

  it('prints the closest block next to matches when a weak entry outscores them', async () => {
    // "intent" is an exact prop name on Button and lands for 1 point; "badg" only
    // sits inside Badge's name and scores 3 without landing. Before #446's second
    // round the higher-scoring entry was invisible.
    const code = await runFind(['badg', 'intent'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('component(s) matching');
    expect(stdout()).toContain('Closest (weak): Badge (badge)');
    expect(stdout()).toContain(CLOSEST_NOTE);
  });

  it('prints [] for a no-match query even when the text surface lists near misses', async () => {
    const code = await runFind(['stat', 'metric', 'kpi'], { json: true });
    expect(code).toBe(0);
    expect(JSON.parse(stdout())).toEqual([]);
  });

  it('keeps matches first and unflagged when both are present', async () => {
    await runFind(['badg', 'intent'], { json: true });
    const parsed = JSON.parse(stdout());
    expect(parsed.map((c: { slug: string }) => c.slug)).toEqual(['button', 'badge']);
    expect(parsed[0].weak).toBeUndefined();
    expect(parsed[1].weak).toBe(true);
  });

  it('prints [] for a query that scored nothing at all', async () => {
    const code = await runFind(['rating'], { json: true });
    expect(code).toBe(0);
    expect(JSON.parse(stdout())).toEqual([]);
  });

  it('rejects a non-numeric --limit as a usage error', async () => {
    const code = await runFind(['button'], { limit: 'abc' });
    expect(code).toBe(2);
    expect(stderr()).toContain('--limit');
  });

  it('rejects a --tag outside the catalog, listing the real ones', async () => {
    // A tag is a closed set: "No components tagged X" reads exactly like a real
    // tag that happens to be empty, so a made-up one has to fail.
    const code = await runFind([], { tag: 'nonsense' });
    expect(code).toBe(2);
    expect(stderr()).toContain('unknown --tag "nonsense"');
    expect(stderr()).toContain('display');
  });

  it('honours --limit without a query — it used to list everything', async () => {
    const code = await runFind([], { limit: '1' });
    expect(code).toBe(0);
    expect(stdout()).toContain('1 component(s) (--limit 1; 1 more)');
  });

  it('lists everything when no --limit is passed', async () => {
    await runFind([], {});
    expect(stdout()).toContain('2 component(s)');
    expect(stdout()).not.toContain('--limit');
  });
});
