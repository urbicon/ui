#!/usr/bin/env bun
/**
 * Packs every publishable package into `release-tarballs/` and writes a
 * manifest naming them in publish order.
 *
 * Runs in the release workflow's GATE job, where the workspace exists. The
 * publish job then needs neither a checkout of the tree nor `node_modules` —
 * which is the point of the split: the job that holds the publishing
 * credential runs no dependency code.
 *
 * Every assertion here fires BEFORE anything irreversible happens. `npm
 * publish` cannot be undone, so a tarball that is wrong in a way we already
 * know how to detect must never reach it:
 *
 *   - LICENSE present. v6.26.1 shipped without it, because the copy step was
 *     never asserted on the packed result.
 *   - No build-cache artefacts. A `files: ["dist"]` whitelist ships whatever
 *     else lands in `dist/` — `tsc`'s incremental `.tsbuildinfo` did, until
 *     the type-check configs dropped `composite` (2026-08-02). The cache is
 *     machine-dependent, so a tarball carrying it is not reproducible.
 *   - No `workspace:` / `catalog:` specifiers left in the manifest. `bun pm
 *     pack` resolves them; npm would leave them verbatim and ship ranges no
 *     consumer can install.
 *   - Name and version readable from the packed manifest, not from the source
 *     tree — the manifest is what consumers get.
 */
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { RELEASE_PACKAGES } from './release-packages.mjs';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'release-tarballs');
const rootLicense = await Bun.file(join(root, 'LICENSE')).text();

/** `ONLY=packages/shared-types` limits the run to one package (canary path). */
const only = process.env.ONLY?.trim();
const packages = only ? RELEASE_PACKAGES.filter((p) => p === only) : RELEASE_PACKAGES;

if (only && packages.length === 0) {
  console.error(`ONLY='${only}' matches no package. Known:\n  ${RELEASE_PACKAGES.join('\n  ')}`);
  process.exit(1);
}

async function sh(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  if (code !== 0) throw new Error(`${cmd.join(' ')} failed (${code})\n${stderr}`);
  return stdout;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const manifest: { name: string; version: string; file: string }[] = [];

for (const dir of packages) {
  const abs = join(root, dir);
  if (!existsSync(join(abs, 'package.json'))) {
    console.error(`::error::${dir}/package.json not found`);
    process.exit(1);
  }

  // The license text ships in every tarball; each package lists LICENSE in its
  // `files` whitelist and tracks its own copy of the root file. This used to
  // copy the root LICENSE in at pack time, from when those copies were
  // transient — assert what that copy guaranteed rather than writing into a
  // tracked tree.
  const licensePath = join(abs, 'LICENSE');
  if (!existsSync(licensePath)) {
    console.error(
      `::error::${dir}/LICENSE not found — every published package tracks its own copy`
    );
    process.exit(1);
  }
  if ((await Bun.file(licensePath).text()) !== rootLicense) {
    console.error(`::error::${dir}/LICENSE has drifted from the root LICENSE`);
    process.exit(1);
  }

  // `bun pm pack`, not `npm pack`: it resolves `workspace:` / `catalog:`
  // specifiers to concrete versions at pack time.
  await sh(['bun', 'pm', 'pack', '--destination', outDir], abs);

  const pkg = await Bun.file(join(abs, 'package.json')).json();
  const name: string = pkg.name;
  const version: string = pkg.version;
  const file = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
  const tgz = join(outDir, file);

  if (!existsSync(tgz)) {
    console.error(`::error::expected tarball ${file} not found for ${name}`);
    process.exit(1);
  }

  const listing = await sh(['tar', '-tzf', tgz], root);
  const entries = listing.split('\n').filter(Boolean);
  if (!entries.includes('package/LICENSE')) {
    console.error(`::error::${name} tarball is missing LICENSE`);
    process.exit(1);
  }

  const junk = entries.filter((e) => /\.tsbuildinfo$|(^|\/)\.DS_Store$/.test(e));
  if (junk.length > 0) {
    console.error(
      `::error::${name} tarball carries build-cache artefacts:\n  ${junk.join('\n  ')}`
    );
    process.exit(1);
  }

  const packed = await sh(['tar', '-xzOf', tgz, 'package/package.json'], root);
  if (/"(workspace|catalog):/.test(packed)) {
    console.error(`::error::${name} manifest still contains workspace:/catalog: specifiers`);
    process.exit(1);
  }
  const packedPkg = JSON.parse(packed);
  if (packedPkg.name !== name || packedPkg.version !== version) {
    console.error(
      `::error::${dir} packs as ${packedPkg.name}@${packedPkg.version}, expected ${name}@${version}`
    );
    process.exit(1);
  }

  manifest.push({ name, version, file });
  console.log(`packed ${name}@${version} → ${file}`);
}

await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${manifest.length} package(s) packed into release-tarballs/`);
