#!/usr/bin/env bun
/**
 * Bundles the MCP server into a self-contained `mcp-dist/` — the artifact the
 * deploy workflow ships to the host.
 *
 * WHY A BUNDLE. The server used to run straight from the source tree
 * (`bun run packages/mcp-server/src/index.ts`) inside a full release checkout,
 * which meant the host had to carry the whole workspace — 756 MB per release,
 * 551 MB of it `node_modules`, for a process that needs 3 MB of code and text.
 * Worse, its systemd unit derived its working directory from the docs site's
 * `static` symlink (`readlink` + strip `/apps/docs/dist`), so the site and the
 * server could not be deployed independently: moving one broke the other on its
 * next restart.
 *
 * TWO PARTS, AND THE SECOND IS EASY TO FORGET. The code bundles, but the server
 * also READS content at runtime — `getCatalogPath()`, `getGuidePath()` and the
 * rest of `@urbicon-ui/design-content` resolve real files off disk. Bundling
 * alone would produce a server that starts fine and then answers every tool
 * call with ENOENT. So `content/` ships beside the bundle, and the unit points
 * `URBICON_CONTENT_DIR` at it (an override `content-loader.ts` already
 * supports, which is why no path patching is needed).
 *
 * `content/` is itself a build artifact — docs-gen emits it, and it is
 * git-ignored. This script therefore asserts it exists and is populated rather
 * than assuming: a `mcp-dist` built before `docs:gen:all` would be a server
 * with no knowledge in it, and that failure is silent at start-up.
 *
 * The `bundle.sha256` written at the end is what lets the deploy skip a restart
 * when nothing about the server changed — most pushes touch neither its code
 * nor the catalogue, and a restart drops every open MCP session.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entry = join(root, 'packages/mcp-server/src/index.ts');
const contentSrc = join(root, 'packages/design-content/content');
const outDir = join(root, 'mcp-dist');
const bundleFile = join(outDir, 'server.js');

/**
 * The artifacts every loader in `src/data/` resolves against. Listed by name
 * rather than counted, so a docs-gen run that drops one fails here with the
 * missing name instead of on the host at request time.
 */
const REQUIRED_CONTENT = [
  'component-catalog.json',
  'icons.json',
  'guides',
  'verbs',
  'design-system'
];

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!existsSync(entry)) fail(`MCP entry point not found: ${relative(root, entry)}`);

if (!existsSync(contentSrc)) {
  fail(
    `design-content/content is missing — run \`bun run docs:gen:all\` first.\n` +
      `  It is a git-ignored build artifact, so a fresh checkout never has it.`
  );
}

for (const name of REQUIRED_CONTENT) {
  if (!existsSync(join(contentSrc, name))) {
    fail(`design-content/content/${name} is missing — the docs-gen run was incomplete.`);
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const built = await Bun.build({
  entrypoints: [entry],
  outdir: outDir,
  target: 'bun',
  naming: 'server.js'
});

if (!built.success) {
  for (const log of built.logs) console.error(log);
  fail('bun build failed');
}

const bundleSize = (await stat(bundleFile)).size;
// A bundle that lost its dependency graph still "succeeds" — it is just tiny.
// The real one is ~1.2 MB; anything under 100 KB means the SDK, zod or
// design-engine did not come along.
if (bundleSize < 100_000) {
  fail(`server.js is only ${bundleSize} B — the dependency graph did not bundle.`);
}

await cp(contentSrc, join(outDir, 'content'), { recursive: true });

/** Every file under `dir`, repo-relative and sorted — a stable hash input. */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

const files = await walk(outDir);
const digest = createHash('sha256');
for (const file of files) {
  digest.update(relative(outDir, file));
  digest.update(
    createHash('sha256')
      .update(await Bun.file(file).bytes())
      .digest()
  );
}
const hash = digest.digest('hex');

await writeFile(join(outDir, 'bundle.sha256'), `${hash}\n`, 'utf-8');

const contentFiles = files.filter((f) => f.includes(`${outDir}/content/`)).length;
console.log(`mcp-dist ready`);
console.log(`  server.js  ${(bundleSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`  content/   ${contentFiles} files`);
console.log(`  sha256     ${hash.slice(0, 16)}…`);
