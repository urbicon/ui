import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
