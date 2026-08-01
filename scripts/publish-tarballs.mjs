#!/usr/bin/env node
/**
 * Uploads the tarballs the gate job packed. Runs in the credential-bearing job,
 * so it deliberately does as little as possible: read a manifest, ask npm
 * whether each version already exists, upload the ones that do not. No install,
 * no build, no dependency code.
 *
 * Authentication is npm trusted publishing (OIDC) — the npm CLI detects the
 * Actions OIDC environment on its own, given `id-token: write` on the job and a
 * trusted publisher configured for the package on npmjs.com. There is no token
 * to pass. `NODE_AUTH_TOKEN` is only consulted as the transitional fallback,
 * and only when trusted publishing is not switched on.
 *
 * Guards, in order of how much they can cost:
 *   - `NPM_TRUSTED_PUBLISHING` must be `true`, or nothing is uploaded. Until
 *     that repository variable is set, Buny remains the publisher and this job
 *     is a rehearsal; two publishers for one tag would be two sources of truth.
 *   - `DRY_RUN` stops before the upload but still exercises auth and npm's own
 *     tarball validation.
 *   - An already-published name@version is skipped, so re-running a flaky tag
 *     is idempotent.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.cwd(), 'release-tarballs');
const manifestPath = resolve(dir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`::error::${manifestPath} not found — did the gate job upload its artifact?`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest) || manifest.length === 0) {
  console.error('::error::manifest is empty');
  process.exit(1);
}

const trusted = process.env.TRUSTED === 'true';
const hasToken = !!process.env.NODE_AUTH_TOKEN;
// `workflow_dispatch` sends the string 'false'; a tag push sends nothing at all,
// and a tag push is the real thing.
const dryRun = process.env.DRY_RUN === 'true';

console.log(`trusted publishing: ${trusted ? 'on' : 'off'}`);
console.log(`token fallback:     ${hasToken ? 'available' : 'none'}`);
console.log(`dry run:            ${dryRun}`);
console.log(`packages:           ${manifest.map((m) => `${m.name}@${m.version}`).join(', ')}\n`);

if (!trusted && !hasToken) {
  console.log(
    '::notice::Neither NPM_TRUSTED_PUBLISHING nor NPM_TOKEN is set — packages were built, ' +
      'packed and validated, but not published. Buny remains the publisher for this tag.'
  );
  process.exit(0);
}

const npm = (args, opts = {}) =>
  execFileSync('npm', args, { stdio: 'pipe', encoding: 'utf8', ...opts });

let published = 0;
let skipped = 0;

for (const { name, version, file } of manifest) {
  const tgz = resolve(dir, file);
  if (!existsSync(tgz)) {
    console.error(`::error::${file} listed in the manifest but missing from the artifact`);
    process.exit(1);
  }

  try {
    npm(['view', `${name}@${version}`, 'version']);
    console.log(`skip    ${name}@${version} — already published`);
    skipped++;
    continue;
  } catch {
    // `npm view` exits non-zero for an unpublished version: that is the signal
    // to publish, not an error. A registry outage would surface on the publish
    // call right after, which is the one that must not be swallowed.
  }

  const args = ['publish', tgz, '--access', 'public'];
  if (dryRun) args.push('--dry-run');

  console.log(`::group::${dryRun ? 'dry-run' : 'publish'} ${name}@${version}`);
  try {
    console.log(npm(args, { stdio: 'inherit' }) ?? '');
  } catch (err) {
    console.log('::endgroup::');
    console.error(`::error::publishing ${name}@${version} failed: ${err.message}`);
    process.exit(1);
  }
  console.log('::endgroup::');
  published++;
}

console.log(
  `\n${dryRun ? 'would publish' : 'published'} ${published}, skipped ${skipped} already-published`
);
