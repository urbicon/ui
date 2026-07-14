/**
 * Post-build step: harvest a static full-text index into `dist/search-index.json`.
 *
 * Runs after `vite build` because it reads the prerendered pages — the content
 * only exists once adapter-static has written them. It deliberately does not run
 * as a `+server.ts` endpoint: the deployment target is flat HTML with no
 * server-side runtime, and harvesting source instead of output would reindex
 * component code rather than the rendered prose.
 *
 * The API surface is read from the generated `api.ts` modules instead of the
 * HTML. See `harvest.ts` for why the HTML cannot supply it.
 *
 * Usage: bun scripts/build-search-index.ts [--dist <dir>] [--routes <dir>] [--out <file>]
 */

import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Glob } from 'bun';
import type { SearchRecord } from '../src/lib/search';
import { type HarvestableApi, harvestApi, harvestHtml, mergeRecords } from './harvest';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 && process.argv[at + 1]
    ? resolve(process.argv[at + 1])
    : resolve(appRoot, fallback);
}

const distDir = flag('dist', 'dist');
const routesDir = flag('routes', 'src/routes');
const outFile = flag('out', 'dist/search-index.json');

/** `dist/blocks/primitives/checkbox.html` → `/blocks/primitives/checkbox`; `dist/index.html` → `/`. */
function routeFromHtml(relPath: string): string {
  const withoutExt = relPath.replace(/\.html$/, '');
  const route = withoutExt === 'index' ? '' : withoutExt.replace(/\/index$/, '');
  return `/${route}`.replace(/\/$/, '') || '/';
}

/** `src/routes/blocks/primitives/checkbox/api.ts` → `/blocks/primitives/checkbox`. */
function routeFromApi(relPath: string): string {
  return `/${relPath.replace(/\/api\.ts$/, '')}`;
}

/** Pages that carry no indexable prose: the offline shell and the redirect stubs. */
const SKIP_HTML = new Set(['404.html']);

async function harvestProse(): Promise<SearchRecord[]> {
  const records: SearchRecord[] = [];
  let pages = 0;
  for await (const rel of new Glob('**/*.html').scan(distDir)) {
    if (SKIP_HTML.has(rel)) continue;
    const html = await Bun.file(join(distDir, rel)).text();
    const harvested = harvestHtml(html, routeFromHtml(rel));
    if (harvested.length > 0) pages++;
    records.push(...harvested);
  }
  console.log(`  prose: ${records.length} records from ${pages} pages`);
  return records;
}

async function harvestApiSurface(): Promise<{ records: SearchRecord[]; props: number }> {
  const records: SearchRecord[] = [];
  let props = 0;
  for await (const rel of new Glob('**/api.ts').scan(routesDir)) {
    const module = (await import(join(routesDir, rel))) as { componentData?: HarvestableApi };
    const data = module.componentData;
    if (!data) {
      throw new Error(`${rel} does not export \`componentData\` — the generated shape changed.`);
    }
    props += data.props?.length ?? 0;
    records.push(...harvestApi(data, routeFromApi(rel)));
  }
  console.log(`  api: ${records.length} records covering ${props} props`);
  return { records, props };
}

/**
 * A silently-empty index is the failure this script exists to prevent: it would
 * ship a search box that finds nothing while every build stays green. Every
 * harvest yielding nothing is therefore fatal, not a fallback.
 */
function assertHarvested(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`\n✗ search index: ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log(`Building search index from ${relative(process.cwd(), distDir)}/`);

  const distExists = await Bun.file(join(distDir, 'index.html')).exists();
  assertHarvested(distExists, `no prerendered pages at ${distDir} — run \`vite build\` first.`);

  const prose = await harvestProse();
  assertHarvested(prose.length > 0, 'harvested 0 prose sections from the prerendered HTML.');

  const { records: api, props } = await harvestApiSurface();
  assertHarvested(props > 0, 'the api.ts modules yielded 0 props — run `docs:gen:all` first.');

  const records = mergeRecords(prose, api);
  const json = JSON.stringify(records);
  await Bun.write(outFile, json);

  const raw = Buffer.byteLength(json);
  const gz = gzipSync(json).byteLength;
  console.log(
    `✓ ${records.length} records → ${relative(process.cwd(), outFile)} ` +
      `(${(raw / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzipped)`
  );
}

await main();
