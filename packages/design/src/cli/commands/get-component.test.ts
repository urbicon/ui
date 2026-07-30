import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runGetComponent } from './get-component.js';

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

describe('runGetComponent', () => {
  it('prints the full llm.txt by default', async () => {
    const code = await runGetComponent(['button'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# Button');
    expect(stdout()).toContain('### API');
  });

  it('slices a named section with --section', async () => {
    const code = await runGetComponent(['button'], { section: 'api' });
    expect(code).toBe(0);
    expect(stdout()).toContain('### API');
    expect(stdout()).toContain('| intent | string | primary |');
    expect(stdout()).not.toContain('### Examples');
  });

  it('requires a slug', async () => {
    const code = await runGetComponent([], {});
    expect(code).toBe(2);
    expect(stderr()).toContain('slug');
  });

  it('rejects an unknown section as a usage error', async () => {
    const code = await runGetComponent(['button'], { section: 'bogus' });
    expect(code).toBe(2);
    expect(stderr()).toContain('--section must be one of');
  });

  it('fails clearly for an unknown component', async () => {
    const code = await runGetComponent(['nonexistent'], {});
    expect(code).toBe(1);
    expect(stderr()).toContain('not found');
  });

  it('resolves the component name a caller has in their code (`Button` → `button`)', async () => {
    // The name in the source — and in `urbicon find`'s own output — is PascalCase;
    // passing it used to fail with "Invalid component slug".
    const code = await runGetComponent(['Button'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# Button');
    // …and says which component it landed on, so the caller learns the slug.
    expect(stderr()).toContain('is the `button` component');
  });

  it('still fails for a name that is in no catalog entry', async () => {
    expect(await runGetComponent(['NotAComponent'], {})).toBe(1);
    expect(stderr()).toContain('not found');
  });
});
