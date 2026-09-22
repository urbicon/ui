#!/usr/bin/env node
/**
 * `urbicon` — the unscoped name for the CLI that ships in `@urbicon-ui/design`.
 *
 * `bunx urbicon …` resolves the local `node_modules/.bin/urbicon` where the design
 * package is installed, and fetches a package literally named `urbicon` where it is
 * not. This package is that name, so the second case runs the real CLI instead of a
 * 404 — and nobody else can publish under it. Nothing is built: this file ships as
 * written and forwards in-process.
 *
 * The entry comes from design's own `package.json` (`bin.urbicon`), never a hardcoded
 * `dist/cli.js` — the package cannot disagree with itself. That file runs
 * `main(process.argv.slice(2))` on import and reads no `process.argv[1]`, so argv and
 * exit codes are the CLI's own. Resolving `@urbicon-ui/design/package.json` is a deep
 * import; design has no `exports` map today, and one that omits `./package.json`
 * breaks exactly here — `bin.test.ts` asks for the same path and fails first.
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@urbicon-ui/design/package.json');
const entry = require(manifestPath).bin?.urbicon;
if (typeof entry !== 'string') {
  console.error('urbicon: @urbicon-ui/design declares no `bin.urbicon` — reinstall it');
  process.exit(2);
}
await import(pathToFileURL(resolve(dirname(manifestPath), entry)).href);
