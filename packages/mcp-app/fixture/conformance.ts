/**
 * The dispatcher against the MCP conformance suite — `bun run test:conformance`.
 *
 * Builds the fixture view, starts the fixture server and runs each scenario of
 * `SCENARIOS` at 2026-07-28. The suite also checks every message against the
 * revision's JSON schema (`wire-schema-valid`). The scenarios are the ones that
 * test the protocol layer; the rest of the revision's requirement set
 * (`--requirements 2026-07-28`) asks for the everything server's own tools,
 * prompts, sampling and tasks, which a server built on this package has only
 * if its app writes them. A check that needs such a tool is excused, with its
 * reason, in `conformance-baseline.yml`; a check excused there that passes
 * fails the run, so the list cannot go stale.
 *
 * Imports the package by its name, so it runs `dist/` — the script builds first.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_PROTOCOL_VERSION } from '@urbicon-ui/mcp-app/server';
import { buildFixture } from './build.ts';
import { startFixtureServer } from './server.ts';

const SCENARIOS = [
  'server-stateless',
  'tools-list',
  'resources-list',
  'sep-2164-resource-not-found',
  'caching',
  'http-header-validation'
];

const BASELINE = fileURLToPath(new URL('./conformance-baseline.yml', import.meta.url));
const DIST = fileURLToPath(new URL('./dist/', import.meta.url));

function suiteBin(): string {
  const manifest = fileURLToPath(
    import.meta.resolve('@modelcontextprotocol/conformance/package.json')
  );
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { bin: Record<string, string> };
  const path = bin.conformance;
  if (!path) throw new Error('@modelcontextprotocol/conformance names no conformance bin.');
  return join(dirname(manifest), path);
}

await buildFixture(DIST);
const server = startFixtureServer({ dist: DIST });
// The suite writes results/ into its working directory; not into the repository.
const scratch = mkdtempSync(join(tmpdir(), 'mcp-app-conformance-'));
const failed: string[] = [];
try {
  for (const scenario of SCENARIOS) {
    console.log(`\n— ${scenario}`);
    // Asynchronous: the fixture server answers from this process's event loop.
    const run = Bun.spawn(
      [
        process.execPath,
        suiteBin(),
        'server',
        '--url',
        server.endpoint.url,
        '--scenario',
        scenario,
        '--spec-version',
        MCP_PROTOCOL_VERSION,
        '--expected-failures',
        BASELINE
      ],
      { cwd: scratch, stdout: 'inherit', stderr: 'inherit', env: { ...process.env, NO_COLOR: '1' } }
    );
    if ((await run.exited) !== 0) failed.push(scenario);
  }
} finally {
  server.stop();
  rmSync(scratch, { recursive: true, force: true });
}
if (failed.length > 0) {
  console.error(`\n✗ conformance: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\n✓ conformance: ${SCENARIOS.length} scenarios at ${MCP_PROTOCOL_VERSION}`);
