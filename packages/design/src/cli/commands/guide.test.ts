import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runGuide } from './guide.js';

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

describe('runGuide', () => {
  it('lists all guides without a slug', async () => {
    const code = await runGuide([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('2 package guide(s)');
    expect(stdout()).toContain('Auth Reference  ·  auth');
    expect(stdout()).toContain('table-sticky');
    expect(stdout()).toContain('urbicon guide <slug>');
  });

  it('prints one guide by slug', async () => {
    const code = await runGuide(['auth'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# @urbicon-ui/auth');
    expect(stdout()).toContain('Zero-dependency authentication');
    expect(stdout()).not.toContain('Two scroll models');
  });

  it('fails clearly for an unknown slug, listing the available ones', async () => {
    const code = await runGuide(['bogus'], {});
    expect(code).toBe(1);
    expect(stderr()).toContain('not found');
    expect(stderr()).toContain('auth, table-sticky');
  });

  it('treats an unsafe slug as unknown, not a crash', async () => {
    const code = await runGuide(['../escape'], {});
    expect(code).toBe(1);
    expect(stderr()).toContain('not found');
  });

  it('emits a machine-readable list with --json', async () => {
    const code = await runGuide([], { json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout()) as { slug: string; title: string }[];
    expect(parsed.map((g) => g.slug)).toEqual(['auth', 'table-sticky']);
  });
});
