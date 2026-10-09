import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conformanceChecks } from './server/adapters/conformance-core.js';

/**
 * The `@urbicon-ui/auth/server…` entries in processes without Vite — `bun test`,
 * a Bun script, a Node script — the way a consumer's seed script meets them.
 *
 * The subject is the packed tarball (`bun pm pack` applies `files`), installed
 * into a consumer outside the repo next to the package's peers, so this needs a
 * build first: `bun run build:packages`. The `$app/server` stubs and the
 * bunfig are read out of docs/AUTH.md § Outside Vite, fence by fence, and run
 * as they stand — the doc cannot show a stub this file does not run.
 */

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// All four peers, as a consumer has them: a server module that reached
// `@urbicon-ui/i18n` has to fail the way it does there, on its `.svelte` files,
// not as a package missing from this harness.
const PEERS = ['svelte', '@sveltejs/kit', '@urbicon-ui/i18n', '@urbicon-ui/blocks'];
const PASSWORD = 'correct horse battery staple';

/** The fence in AUTH.md whose first line names `file` (`// file` or `# file`). */
function documented(file: string): string {
  const markdown = readFileSync(join(PKG, 'docs/AUTH.md'), 'utf8');
  const fences = [...markdown.matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)]
    .map((match) => match[1] ?? '')
    .filter((body) => [`// ${file}`, `# ${file}`].includes(body.split('\n', 1)[0] ?? ''));
  if (fences.length !== 1) {
    throw new Error(`docs/AUTH.md: expected one fence headed "${file}", found ${fences.length}`);
  }
  return fences[0] ?? '';
}

/** Where Node's resolution from this package finds `name`, symlinks resolved. */
function installedDir(name: string): string {
  for (let dir = PKG; dir !== dirname(dir); dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
  }
  throw new Error(`peer ${name} is not installed above ${PKG}`);
}

/**
 * The first `node` on PATH that is Node. `bun --bun` — how CI runs this suite —
 * puts a `node` that is Bun in front of it.
 */
function realNode(): string {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    if (!existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['-p', 'process.versions.bun ?? ""'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === '') return candidate;
  }
  throw new Error('no Node.js on PATH, only Bun posing as one');
}

function run(command: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 120_000
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

/** The probe's one JSON line; throws with the whole output when it never got that far. */
function probeResult(output: string): Record<string, unknown> {
  const line = output.split('\n').find((l) => l.startsWith('{"runtime"'));
  if (!line) throw new Error(`the probe printed no result:\n${output}`);
  return JSON.parse(line);
}

let consumer: string;
let serverEntries: string[];

beforeAll(() => {
  if (!existsSync(join(PKG, 'dist/server/index.js'))) {
    throw new Error('packages/auth/dist is missing — run `bun run build:packages` first');
  }
  consumer = mkdtempSync(join(tmpdir(), 'auth-outside-vite-'));
  const packed = run('bun', ['pm', 'pack', '--destination', consumer], PKG);
  const tarball = readdirSync(consumer).find((f) => f.endsWith('.tgz'));
  if (packed.status !== 0 || !tarball) throw new Error(`bun pm pack failed:\n${packed.output}`);

  const auth = join(consumer, 'node_modules/@urbicon-ui/auth');
  mkdirSync(auth, { recursive: true });
  const unpacked = run(
    'tar',
    ['-xzf', join(consumer, tarball), '-C', auth, '--strip-components=1'],
    consumer
  );
  if (unpacked.status !== 0) throw new Error(`unpacking failed:\n${unpacked.output}`);
  for (const peer of PEERS) {
    mkdirSync(dirname(join(consumer, 'node_modules', peer)), { recursive: true });
    symlinkSync(installedDir(peer), join(consumer, 'node_modules', peer), 'dir');
  }

  // Every server entry the tarball exports, except the vitest-wired conformance
  // entry: it imports `vitest` by design, and a plain process has no runner.
  const manifest = JSON.parse(readFileSync(join(auth, 'package.json'), 'utf8'));
  serverEntries = Object.keys(manifest.exports)
    .filter((key) => key.startsWith('./server') && key !== './server/adapters/conformance')
    .map((key) => `@urbicon-ui/auth${key.slice(1)}`);

  for (const file of ['app-server-stub.ts', 'app-server-stub.mjs', 'bunfig.toml']) {
    writeFileSync(join(consumer, file), documented(file));
  }
  writeFileSync(
    join(consumer, 'probe.mjs'),
    `const entries = ${JSON.stringify(serverEntries)};
for (const entry of entries) await import(entry);
const { hashPassword, verifyPassword } = await import('@urbicon-ui/auth/server');
const verified = await verifyPassword(${JSON.stringify(PASSWORD)}, await hashPassword(${JSON.stringify(PASSWORD)}));
console.log(JSON.stringify({ runtime: process.versions.bun ? 'bun' : 'node', entries: entries.length, verified }));
`
  );
  // Test-owned, not documented: asks Node's loader which modules it loaded.
  writeFileSync(
    join(consumer, 'record-loads.mjs'),
    `import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
const loaded = [];
registerHooks({ load: (url, context, nextLoad) => (loaded.push(url), nextLoad(url, context)) });
process.on('exit', () => writeFileSync(process.env.AUTH_LOADS_FILE, JSON.stringify(loaded)));
`
  );
  writeFileSync(
    join(consumer, 'probe.test.ts'),
    `import { describe, expect, it } from 'bun:test';
import { hashPassword, verifyPassword } from '@urbicon-ui/auth/server';
import { describeRepositoryConformance } from '@urbicon-ui/auth/server/adapters/conformance-core';
import { createInMemoryRepos } from '@urbicon-ui/auth/server/adapters/in-memory';

it('hashes and verifies a password', async () => {
  expect(await verifyPassword('${PASSWORD}', await hashPassword('${PASSWORD}'))).toBe(true);
});

describeRepositoryConformance(
  'in-memory',
  {
    role: 'USER',
    capabilities: {
      refreshToken: true,
      passkey: true,
      notification: true,
      pushSubscription: true,
      notificationPreference: true,
      backupCode: true,
      federatedAccount: true
    },
    setup: () => createInMemoryRepos()
  },
  { runner: { describe, it, expect } }
);
`
  );
}, 120_000);

afterAll(() => {
  if (consumer) rmSync(consumer, { recursive: true, force: true });
});

describe('the server entries outside Vite', () => {
  it('fail to load without a stub: the server-only marker is still in place', () => {
    const { status, output } = run('bun', ['./probe.mjs'], consumer);
    expect(status).not.toBe(0);
    expect(output).toContain(`Cannot find module '$app/server'`);
  });

  it('run under bun test with the documented preload, conformance kit included', () => {
    const { status, output } = run('bun', ['test', './probe.test.ts'], consumer);
    expect(status, output).toBe(0);
    expect(output).toMatch(/^\s*0 fail$/m);
    // The hash test plus every conformance check: the probe declares all
    // capabilities, so none of them may be missing or skipped.
    const passed = Number(output.match(/^\s*(\d+) pass$/m)?.[1]);
    expect(passed, output).toBe(conformanceChecks.length + 1);
  }, 120_000);

  it('run as a Bun script with the documented preload', () => {
    const { status, output } = run(
      'bun',
      ['--preload', './app-server-stub.ts', './probe.mjs'],
      consumer
    );
    expect(status, output).toBe(0);
    expect(probeResult(output)).toMatchObject({
      runtime: 'bun',
      entries: serverEntries.length,
      verified: true
    });
  }, 120_000);

  it('run as a Node script with the documented hook, and load no Svelte module', () => {
    const loads = join(consumer, 'loads.json');
    const { status, output } = run(
      realNode(),
      ['--import', './app-server-stub.mjs', '--import', './record-loads.mjs', './probe.mjs'],
      consumer,
      { AUTH_LOADS_FILE: loads }
    );
    expect(status, output).toBe(0);
    expect(probeResult(output)).toMatchObject({
      runtime: 'node',
      entries: serverEntries.length,
      verified: true
    });

    const loaded: string[] = JSON.parse(readFileSync(loads, 'utf8'));
    // The recorder saw the package at all — an empty list would pass the line below.
    expect(loaded.some((url) => url.endsWith('/dist/server/server-only.js'))).toBe(true);
    expect(loaded.filter((url) => /\.svelte(\.[jt]s)?$/.test(url))).toEqual([]);
  }, 120_000);
});
