import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOCS_GEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = 'tests/fixtures/doc-fences';
// inside the gitignored default scratch dir; the script removes it on exit
const SCRATCH = 'packages/docs-gen/.doc-fences-lint/test';

function run(fixture: string, extra: string[] = []) {
  const doc = fixture.startsWith('/') ? fixture : `packages/docs-gen/${FIXTURES}/${fixture}`;
  const r = spawnSync(
    'bun',
    ['scripts/doc-fences-lint.ts', '--docs', doc, '--scratch', SCRATCH, ...extra],
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
    expect(stdout).toContain('resolved via packages/auth (');

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

  // ── the ways a harness goes green for the wrong reason ───────────────────

  it('is red when tsc reports an options error instead of checking (TS2688)', () => {
    // an unresolvable `types` entry: tsc lists the files, then computes no
    // semantic diagnostics at all — the proof line alone would say "green"
    const { status, stdout, stderr } = run('green.md', [
      '--compiler-options',
      '{"types":["node","nope"]}'
    ]);
    expect(status).toBe(1);
    expect(stdout).toContain('green.md — 1 fence(s) in the tsc program (--listFiles)');
    expect(stderr).toContain('green.md: harness error — tsc: TS2688');
    expect(stdout).not.toContain('✔');
  }, 60_000);

  it('is red when the run found no marked fence at all', () => {
    const { status, stderr } = run('unmarked.md');
    expect(status).toBe(1);
    expect(stderr).toContain('no marked fence in 1 document(s)');
  }, 60_000);

  it('rejects every line that looks like a marker but is not one', () => {
    const { status, stderr } = run('lookalike.md');
    expect(status).toBe(1);
    for (const needle of ['<!-- Typecheck -->', '<!-- typecheck stub', '<!-- typecheck --> and'])
      expect(stderr).toContain(
        `lookalike.md:${lineOf('lookalike.md', needle)}: looks like a typecheck marker but is not one`
      );
  }, 60_000);

  it('reads CRLF documents like LF ones, at the same document lines', () => {
    const dir = join(DOCS_GEN, '.doc-fences-lint/crlf');
    mkdirSync(dir, { recursive: true });
    const crlf = join(dir, 'red.md');
    writeFileSync(
      crlf,
      readFileSync(join(DOCS_GEN, FIXTURES, 'red.md'), 'utf8').replaceAll('\n', '\r\n')
    );
    try {
      const { status, stdout, stderr } = run(crlf);
      expect(status).toBe(1);
      expect(stdout).toContain('crlf/red.md — 3 fence(s) in the tsc program');
      expect(stderr).toContain(
        `crlf/red.md:${lineOf('red.md', 'export const repo: RefreshTokenRepository')} (fence #1, TS2740)`
      );
      expect(stderr).toContain(`crlf/red.md:${lineOf('red.md', 'durationMs')} (fence #3, TS2353)`);
      expect(stderr).toContain('✖ 3 finding(s)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('checks fences indented inside a list item, de-indented, at their document lines', () => {
    const { status, stdout, stderr } = run('indented.md');
    expect(status).toBe(1);
    expect(stdout).toContain('indented.md — 2 fence(s) in the tsc program');
    expect(stderr).toContain(
      `indented.md:${lineOf('indented.md', "'forty-two'")} (fence #2, TS2322)`
    );
    expect(stderr).toContain('✖ 1 finding(s)');
  }, 60_000);

  it('checks a fence whose info string carries more than the language', () => {
    const { status, stdout, stderr } = run('info-string.md');
    expect(status).toBe(1);
    expect(stdout).toContain('info-string.md — 1 fence(s) in the tsc program');
    expect(stderr).toContain(
      `info-string.md:${lineOf('info-string.md', 'secret: 42')} (fence #1, TS2322)`
    );
    expect(stderr).toContain('✖ 1 finding(s)');
  }, 60_000);

  it('rejects a fence that never closes', () => {
    const { status, stderr } = run('unclosed.md');
    expect(status).toBe(1);
    expect(stderr).toContain(
      `unclosed.md:${lineOf('unclosed.md', '```ts')}: fence opened here is never closed`
    );
  }, 60_000);
});
