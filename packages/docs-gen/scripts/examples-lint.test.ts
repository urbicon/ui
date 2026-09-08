import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end control for the pattern corpus of `examples-lint`. The gate's
 * failure mode is silence: a corpus that never reaches the host package, a
 * svelte-check that dies before it reads anything, and a run that compiles
 * nothing all print "every pattern fence type-checks". So this drives the real
 * script over a fixture corpus (`EXAMPLES_LINT_PATTERNS_DIR`) and asserts both
 * directions — a fence naming a component the library does not export comes
 * back red at its DOCUMENT line, and a fence that compiles comes back green
 * with the corpus named in the report.
 *
 * It runs the whole gate, so it costs a full gate run per case (~30 s each) and
 * is a Bun-test step of its own rather than part of the docs-gen vitest suite,
 * the way `scripts/consumer-css-check.test.ts` is. The cheap half — which
 * fences a document yields, and the line arithmetic — is unit-tested in
 * `tests/pattern-fences.test.ts`. Needs the workspace packages built.
 */
const DOCS_GEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(DOCS_GEN, 'tests/fixtures/pattern-fences');

function run(corpus: string) {
  const r = spawnSync('bun', ['scripts/examples-lint.ts'], {
    cwd: DOCS_GEN,
    encoding: 'utf8',
    env: { ...process.env, EXAMPLES_LINT_PATTERNS_DIR: join(FIXTURES, corpus) }
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** 1-based document line of the first line containing `needle`. */
function lineOf(corpus: string, file: string, needle: string): number {
  const lines = readFileSync(join(FIXTURES, corpus, file), 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`${file} has no line containing ${needle}`);
  return i + 1;
}

describe('examples-lint pattern corpus', () => {
  it('reports a fence importing a component the library does not export', () => {
    const { status, stdout, stderr } = run('red');

    expect(stdout).toContain('1 svelte fence(s)');
    expect(stderr).toContain("has no exported member 'NotAComponent'");
    expect(stderr).toContain('TS2305');
    // at the import's own line in the Markdown document, not in the temp file
    const line = lineOf('red', 'broken-pattern.md', 'NotAComponent');
    expect(stderr).toContain(`svelte fence #1 line ${line}:`);
    expect(status).toBe(1);
  }, 180_000);

  it('passes a fence that compiles, and names what it checked', () => {
    const { status, stdout } = run('green');

    expect(stdout).toContain('1 svelte fence(s)');
    expect(stdout).toContain('good-pattern.md svelte fence #1');
    expect(stdout).toContain('✔ every @example and every pattern fence type-checks');
    expect(status).toBe(0);
  }, 180_000);
});
