import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installStateFor, readConsumerDependencies } from './installed.js';

describe('installStateFor', () => {
  const urbiconCtx = new Set(['@urbicon-ui/blocks', '@urbicon-ui/design', 'svelte']);

  it('reports installed when the package is a dependency', () => {
    expect(installStateFor('@urbicon-ui/blocks', urbiconCtx)).toBe('installed');
  });

  it('reports missing when an urbicon package is absent but the project clearly uses urbicon', () => {
    expect(installStateFor('@urbicon-ui/table', urbiconCtx)).toBe('missing');
  });

  it('reports unknown — never missing — when there is no dependency signal at all', () => {
    expect(installStateFor('@urbicon-ui/table', null)).toBe('unknown');
  });

  it('reports unknown when no @urbicon-ui/* package is present (not a real consumer context)', () => {
    // A bunx-from-scratch run, or a project that doesn't use the library: don't
    // stamp a misleading "not installed" on every catalog entry.
    expect(installStateFor('@urbicon-ui/table', new Set(['svelte', 'vite']))).toBe('unknown');
  });
});

describe('readConsumerDependencies', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'urbicon-installed-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('collects names from every dependency field', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { '@urbicon-ui/blocks': '^6' },
        devDependencies: { '@urbicon-ui/design': '^6' },
        peerDependencies: { svelte: '^5' },
        optionalDependencies: { sharp: '^0' }
      })
    );
    const deps = readConsumerDependencies(dir);
    expect(deps).not.toBeNull();
    expect([...(deps ?? [])].sort()).toEqual([
      '@urbicon-ui/blocks',
      '@urbicon-ui/design',
      'sharp',
      'svelte'
    ]);
  });

  it('walks up to the nearest package.json from a nested cwd', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@urbicon-ui/blocks': '^6' } })
    );
    const nested = join(dir, 'src', 'routes');
    mkdirSync(nested, { recursive: true });
    expect(readConsumerDependencies(nested)?.has('@urbicon-ui/blocks')).toBe(true);
  });

  it('treats absent dependency fields as an empty set, not a failure', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'no-deps' }));
    const deps = readConsumerDependencies(dir);
    expect(deps).not.toBeNull();
    expect(deps?.size).toBe(0);
  });

  it('keeps walking past an unreadable/malformed package.json to a valid parent', () => {
    // A broken package.json in a subdir must not abort the search — the nearest
    // *valid* manifest up the tree still wins.
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@urbicon-ui/blocks': '^6' } })
    );
    const nested = join(dir, 'app');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'package.json'), '{ this is not json');
    expect(readConsumerDependencies(nested)?.has('@urbicon-ui/blocks')).toBe(true);
  });
});
