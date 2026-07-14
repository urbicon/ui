#!/usr/bin/env bun
/**
 * types-guard — asserts every published module ships its declaration file.
 *
 * TypeScript's declaration emit can fail for a single file while the packaging
 * step still exits 0: `svelte-package` reports the error and then simply omits
 * that file's `.d.ts`. The build stays green, the package still publishes, and
 * consumers degrade *silently* — a `*Props extends …VariantProps` whose
 * `.variants.d.ts` vanished loses every variant prop, with no error on our side.
 * That is not hypothetical: 2026-07-09 all nine `packages/docs/**\/*.variants.d.ts`
 * were dropped (TS2883 — `tv()`'s return type wasn't nameable because `TVConfig`
 * wasn't exported), which buried the docs-app check gate under 274 phantom errors.
 *
 * This gate turns that silent drop into a red build: for every package that
 * *promises* declarations (a `.d.ts` in `types`/`typings`/`exports`), every
 * published `.js` and `.svelte` module under its build output must have the
 * declaration sibling next to it.
 *
 * Run: `bun run types:guard` (after `bun run build:packages` — it reads dist/).
 *
 * Scope: every workspace package, discovered from the root `workspaces` globs.
 * Packages that ship no declarations (source-distributed, or a bundled CLI) are
 * skipped; test/fixture output and anything package.json `files` excludes is not
 * published, so it is not checked.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m'
};

const ROOT = join(import.meta.dir, '..');

// Never published, so a dropped declaration there harms nobody. Directory names
// are matched per path segment (not globbed) so both spellings of an exclusion
// — `dist/**/.svelte-kit` and `dist/**/.svelte-kit/**` — are covered.
const IGNORED_DIRS = new Set(['__fixtures__', '.svelte-kit', 'node_modules']);
const RE_TEST_FILE = /\.(?:test|spec)\./;

type Finding = { pkg: string; file: string; expected: string; foundAs?: string };

const errors: Finding[] = [];
let checkedPackages = 0;
let checkedModules = 0;
const skipped: string[] = [];

// ── package.json helpers ─────────────────────────────────────────────────────

/** Every `types` path a package.json promises: top-level + any `exports` condition. */
const collectTypesPaths = (pkg: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const key of ['types', 'typings'] as const) {
    const v = pkg[key];
    if (typeof v === 'string') out.push(v);
  }
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'types' && typeof v === 'string') out.push(v);
      else walk(v);
    }
  };
  walk(pkg.exports);
  return out;
};

const stripDot = (p: string): string => p.replace(/^\.\//, '');

/**
 * The build-output directories a package emits declarations into, derived from
 * the `types` paths it promises (`./dist/index.d.ts` → `dist`). A package whose
 * `types` point at `.ts` sources (design-engine, design-content) ships no build
 * output and is not this gate's business; nor is one with no `types` at all
 * (design's bundled CLI, mcp-server).
 */
const declarationRoots = (pkg: Record<string, unknown>): string[] => {
  const decls = collectTypesPaths(pkg).filter((t) => t.endsWith('.d.ts'));
  const roots = new Set(decls.map((t) => stripDot(t).split('/')[0]));
  // A dot means the first segment is the declaration file itself (`./index.d.ts`),
  // i.e. a flat package with no build-output directory to walk.
  return [...roots].filter((r) => !r.includes('.'));
};

/** `files` negations (`!dist/**\/*.test.*`) — npm excludes them, so we do too. */
const fileExclusions = (pkg: Record<string, unknown>): Bun.Glob[] => {
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  return files
    .filter((f): f is string => typeof f === 'string' && f.startsWith('!'))
    .map((f) => new Bun.Glob(f.slice(1)));
};

const isExcluded = (rel: string, exclusions: Bun.Glob[]): boolean => {
  const segments = rel.split('/');
  if (segments.some((s) => IGNORED_DIRS.has(s))) return true;
  if (RE_TEST_FILE.test(segments[segments.length - 1])) return true;
  return exclusions.some((g) => g.match(rel));
};

/** `Foo.svelte` → `Foo.svelte.d.ts`; `foo.js` → `foo.d.ts` (incl. `foo.svelte.js`). */
const expectedDeclaration = (rel: string): string =>
  rel.endsWith('.svelte') ? `${rel}.d.ts` : `${rel.slice(0, -'.js'.length)}.d.ts`;

/**
 * Case-exact directory listings.
 *
 * Deliberately not `existsSync`: macOS/APFS is case-insensitive, so it happily
 * resolves `apireference.variants.d.ts` to an on-disk `ApiReference.variants.d.ts`
 * — while Linux (CI, and plenty of consumers) does not. Matching the real dirent
 * keeps a local run honest instead of green-here/red-in-CI, and it catches a
 * case-only rename that an incremental macOS build leaves stale (APFS is
 * case-*preserving*: rewriting the file keeps the original dirent's spelling).
 */
const dirCache = new Map<string, Set<string>>();
const entriesOf = (dir: string): Set<string> => {
  const hit = dirCache.get(dir);
  if (hit) return hit;
  const set = new Set<string>(existsSync(dir) ? readdirSync(dir) : []);
  dirCache.set(dir, set);
  return set;
};

// ── Discovery ────────────────────────────────────────────────────────────────

const rootPkg = JSON.parse(await Bun.file(join(ROOT, 'package.json')).text()) as {
  workspaces?: string[] | { packages?: string[] };
};
const globs = Array.isArray(rootPkg.workspaces)
  ? rootPkg.workspaces
  : (rootPkg.workspaces?.packages ?? []);

if (globs.length === 0) {
  console.error(`${c.red}✖ no workspace globs in the root package.json${c.reset}`);
  process.exit(1);
}

const packageDirs = new Set<string>();
for (const pattern of globs) {
  for (const rel of new Bun.Glob(`${pattern}/package.json`).scanSync({
    cwd: ROOT,
    onlyFiles: true
  })) {
    packageDirs.add(rel.slice(0, -'/package.json'.length));
  }
}

// ── Check ────────────────────────────────────────────────────────────────────

for (const dir of [...packageDirs].sort()) {
  const pkgDir = join(ROOT, dir);
  const pkg = JSON.parse(await Bun.file(join(pkgDir, 'package.json')).text()) as Record<
    string,
    unknown
  >;
  const name = typeof pkg.name === 'string' ? pkg.name : dir;
  const roots = declarationRoots(pkg);

  if (roots.length === 0) {
    skipped.push(name);
    continue;
  }

  const exclusions = fileExclusions(pkg);
  let sawRoot = false;

  for (const root of roots) {
    const rootDir = join(pkgDir, root);
    if (!existsSync(rootDir)) {
      // The package promises `<root>/**.d.ts` but never emitted it. Running the
      // gate on an unbuilt tree is a usage error, not a passing check — say so.
      console.error(
        `${c.red}✖ ${name}: declared types under ${c.bold}${root}/${c.reset}${c.red}, but ${dir}/${root} does not exist.${c.reset}\n` +
          `  ${c.gray}Build first: bun run build:packages${c.reset}`
      );
      process.exit(1);
    }
    if (!statSync(rootDir).isDirectory()) continue;
    sawRoot = true;

    for (const rel of new Bun.Glob(`${root}/**/*.{js,svelte}`).scanSync({
      cwd: pkgDir,
      onlyFiles: true
    })) {
      if (isExcluded(rel, exclusions)) continue;
      checkedModules++;
      const expected = expectedDeclaration(rel);
      const entries = entriesOf(join(pkgDir, dirname(expected)));
      const base = expected.slice(expected.lastIndexOf('/') + 1);
      if (entries.has(base)) continue;
      const foundAs = [...entries].find((e) => e.toLowerCase() === base.toLowerCase());
      errors.push({ pkg: name, file: rel, expected, foundAs });
    }
  }

  if (sawRoot) checkedPackages++;
  else skipped.push(name);
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log(
  `\n${c.bold}types-guard${c.reset} ${c.gray}· ${checkedPackages} package(s) · ${checkedModules} published module(s)${c.reset}`
);
if (skipped.length) {
  console.log(`${c.gray}  skipped (ship no declarations): ${skipped.join(', ')}${c.reset}`);
}
console.log('');

if (errors.length) {
  console.log(
    `${c.red}${c.bold}Missing declarations (${errors.length})${c.reset} ${c.gray}— these modules would publish untyped${c.reset}`
  );
  const byPkg = new Map<string, Finding[]>();
  for (const f of errors) {
    const bucket = byPkg.get(f.pkg);
    if (bucket) bucket.push(f);
    else byPkg.set(f.pkg, [f]);
  }
  for (const [pkg, fs] of byPkg) {
    console.log(`  ${c.red}${pkg}${c.reset}`);
    for (const f of fs) {
      const detail = f.foundAs
        ? `${c.gray}→ expected ${f.expected.slice(f.expected.lastIndexOf('/') + 1)}, found ${c.yellow}${f.foundAs}${c.reset}${c.gray} (case mismatch)${c.reset}`
        : `${c.gray}→ no ${f.expected}${c.reset}`;
      console.log(`    ${f.file} ${detail}`);
    }
  }

  if (errors.some((f) => f.foundAs)) {
    console.log(
      `\n${c.yellow}Case mismatch:${c.reset} the declaration exists but is spelled differently.\n` +
        `${c.gray}Case-insensitive macOS resolves it anyway; Linux (CI, consumers) does not.\n` +
        `Usually a stale dist after a case-only rename — APFS keeps the old dirent's spelling\n` +
        `when the file is rewritten. Fix: clean rebuild (bun run clean && bun run build:packages).${c.reset}`
    );
  }
  if (errors.some((f) => !f.foundAs)) {
    console.log(
      `\n${c.yellow}Missing entirely:${c.reset} TypeScript could not emit a declaration for that file\n` +
        `${c.gray}and svelte-package skipped it while still exiting 0 — usually a non-portable inferred\n` +
        `type (TS2883/TS4023: "has or is using name X from external module but cannot be named").\n` +
        `Fix: export the offending type from its package (e.g. TVConfig from @urbicon-ui/blocks)\n` +
        `or annotate the export explicitly, then rebuild. Re-run the real build and read its log —\n` +
        `the underlying TS error is printed there, above the (exit-0) success line.${c.reset}`
    );
  }
  console.log(`\n${c.red}✖ ${errors.length} module(s) shipped without declarations${c.reset}\n`);
  process.exit(1);
}

console.log(`${c.green}✓ all ${checkedModules} published modules have declarations${c.reset}\n`);
