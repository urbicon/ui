import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOCS_GEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = 'tests/fixtures/doc-fences';
// inside the gitignored default scratch dir; the script removes it on exit
const SCRATCH = 'packages/docs-gen/.doc-fences-lint/test';

function run(fixture: string) {
  const r = spawnSync(
    'bun',
    [
      'scripts/doc-fences-lint.ts',
      '--docs',
      `packages/docs-gen/${FIXTURES}/${fixture}`,
      '--scratch',
      SCRATCH
    ],
    { cwd: DOCS_GEN, encoding: 'utf8' }
  );
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** 1-based document line of the first line containing `needle`. */
function lineOf(fixture: string, needle: string): number {
  const lines = readFileSync(join(DOCS_GEN, FIXTURES, fixture), 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`${fixture} has no line containing ${needle}`);
  return i + 1;
}

/**
 * Positive control for the gate: a document whose marked fences are broken in
 * the ways the gate exists for must come back red, with the document line —
 * otherwise a harness whose `include` silently stopped matching its files
 * would pass everything.
 */
describe('doc-fences-lint', () => {
  it('reports a broken fence at its document line, and only marked fences', () => {
    const { status, stdout, stderr } = run('red.md');
    expect(status).toBe(1);
    // the --listFiles proof names every marked fence, not the unmarked fourth
    expect(stdout).toContain('red.md — 3 fence(s) in the tsc program (--listFiles)');
    expect(stdout).toContain('resolved via packages/auth/dist');

    const missingMethods = lineOf('red.md', 'export const repo: RefreshTokenRepository');
    expect(stderr).toContain(`red.md:${missingMethods} (fence #1, TS2740)`);
    expect(stderr).toMatch(/missing the following properties from type 'RefreshTokenRepository'/);

    const envImport = lineOf('red.md', "import { env } from '$env/static/private'");
    expect(stderr).toContain(`red.md:${envImport} (fence #2, TS2305)`);

    const wrongKey = lineOf('red.md', 'durationMs');
    expect(stderr).toContain(`red.md:${wrongKey} (fence #3, TS2353)`);

    expect(stderr).not.toContain('fence #4');
    expect(stderr).toContain('✖ 3 finding(s)');
  }, 60_000);

  it('passes a fence that compiles against the built packages', () => {
    const { status, stdout, stderr } = run('green.md');
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('green.md — 1 fence(s) in the tsc program (--listFiles)');
    expect(stdout).toContain('✔ every marked fence compiles');
  }, 60_000);

  it('rejects a marker that is not directly above a ts fence', () => {
    const { status, stderr } = run('misplaced-marker.md');
    expect(status).toBe(1);
    expect(stderr).toContain(
      'misplaced-marker.md:3: <!-- typecheck --> must sit on the line directly above'
    );
  }, 60_000);
});
