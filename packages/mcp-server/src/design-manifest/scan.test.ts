import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanMarkers } from './scan.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'uib-scan-'));
  const write = async (rel: string, body: string) => {
    const path = join(root, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body, 'utf-8');
  };
  await write('src/routes/dashboard/+page.svelte', '<div data-design-pattern="dashboard">…</div>');
  await write('src/routes/signup/+page.svelte', "<main data-design-pattern='form-page'>…</main>");
  await write('src/lib/Plain.svelte', '<div class="bg-surface-base">no marker</div>');
  // Must be skipped:
  await write('src/node_modules/pkg/Comp.svelte', '<div data-design-pattern="should-skip">…</div>');
  await write('dist/built.svelte', '<div data-design-pattern="should-skip">…</div>');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('scanMarkers', () => {
  it('finds markers and reports project-relative paths', async () => {
    const usages = await scanMarkers(join(root, 'src'), root);
    const patterns = usages.map((u) => u.pattern).sort();
    expect(patterns).toEqual(['dashboard', 'form-page']);
    expect(usages.find((u) => u.pattern === 'dashboard')?.file).toBe(
      'src/routes/dashboard/+page.svelte'
    );
  });

  it('skips node_modules and build output', async () => {
    const usages = await scanMarkers(root, root);
    expect(usages.some((u) => u.pattern === 'should-skip')).toBe(false);
  });

  it('handles both single- and double-quoted markers', async () => {
    const usages = await scanMarkers(join(root, 'src'), root);
    expect(usages.some((u) => u.pattern === 'form-page')).toBe(true);
  });

  it('returns empty for a non-existent directory', async () => {
    expect(await scanMarkers(join(root, 'does-not-exist'))).toEqual([]);
  });
});
