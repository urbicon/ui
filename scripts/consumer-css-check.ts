#!/usr/bin/env bun
/**
 * consumer-css-check — is every Tailwind class in the markup a package ships
 * compiled by the stylesheet that package ships? Asked of Tailwind itself.
 *
 * The state this reports was made unrepresentable inside a package by #314:
 * every shipped stylesheet declares `@source '..'`, which is the whole library
 * whether the file sits at `src/lib/style` or `dist/style`. Two things cannot
 * be made unrepresentable and only ever show in a consumer's build:
 *
 *   1. A package that ships `.svelte` but exports no stylesheet at all. Its
 *      peers' stylesheets scan only their own `dist`, so any class the package
 *      is alone in using is compiled by nobody.
 *   2. A regression of the `@source` line. `apps/docs` cannot notice one: it
 *      scans the whole of every `src/lib` on top and is not a consumer.
 *
 * So this gate builds the consumer. For every published package whose tarball
 * carries a `.svelte` file (`bun pm pack` decides — the packer, not a model of
 * `files`), the tarball is unpacked into a git-free `node_modules/@urbicon-ui/…`
 * tree with `tailwindcss` symlinked beside it. Then, with Tailwind's own APIs
 * and no class detection of our own:
 *
 *   - `compile()` on the consumer entry (`@import 'tailwindcss'` + the
 *     package's `./style/index.css`) returns the `@source` entries it resolved.
 *     A `Scanner` over exactly those is **covered** — what a consumer compiles.
 *   - A `Scanner` over the shipped `.svelte` files, one file at a time, is
 *     **present**, with the file each candidate came from. Only `.svelte`: a
 *     string in shipped `.js` that parses as a utility (`static`, `table` in
 *     i18n's locale resolver, `[auth:in-memory]` in an adapter) is a class to
 *     the scanner, and it would fail a package that has no use for a
 *     stylesheet. The class lists in `*.variants.js` sit in the folder of the
 *     `.svelte` that uses them, so a `@source` that misses one misses the
 *     other, and the `.svelte` reports it.
 *   - The difference goes through `candidatesToCss()` on a FRESH design system
 *     of the same entry, and only candidates Tailwind emits a rule for are
 *     reported. Fresh, because a compiler accumulates: `build([])` after
 *     `build(probe)` returns the probe again.
 *
 * The entry is the documented consumer's: the package's `@urbicon-ui/*` peers'
 * stylesheets first, then its own. A package without a `./style/index.css`
 * export is case 1 above and reported as such — its entry is the peers alone —
 * not as "0 covered".
 *
 * Measured 2026-08-26 on the five packages that ship `.svelte`: 1.2–1.6 s
 * total, of which packing and unpacking all 13 tarballs is 0.7–0.9 s and no
 * single audit exceeds 250 ms. Reproducing the pre-#314 `@source` lines on
 * the unpacked copies reports that finding back (16 of its 17 table classes —
 * the test file says which one a comment now covers).
 *
 * Run: `bun run consumer-css:check` (after `bun run build:packages` — it packs
 * `dist/`). Exit 1 on the first uncovered class.
 *
 * `@tailwindcss/node` and `@tailwindcss/oxide` resolve through the hoisted
 * workspace `node_modules`, as `vite` does for `scripts/bundle-size.ts`.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const ROOT = resolve(import.meta.dir, '..');
const SCOPE = '@urbicon-ui/';
const STYLE_EXPORT = './style/index.css';

/** A shipped-tarball install: `node_modules/@urbicon-ui/<name>` per package. */
export type Tree = {
  dir: string;
  /** Short names (`blocks`, `table`, …) of every installed package. */
  installed: string[];
  /** Short names of the packages whose tarball carries a `.svelte` file. */
  audited: string[];
};

export type Finding = { cls: string; files: string[] };

export type Report = {
  name: string;
  /** Whether the package exports `./style/index.css`. */
  stylesheet: boolean;
  /** The consumer entry CSS the coverage was computed from. */
  entry: string;
  /** The `@source` entries the entry resolved to, relative to the tree. */
  sources: string[];
  /** Shipped `.svelte` files scanned for `present`. */
  files: number;
  covered: Set<string>;
  present: Map<string, string[]>;
  /** Present, not covered, and Tailwind emits a rule for it. */
  uncovered: Finding[];
};

async function sh(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  if (code !== 0) throw new Error(`${cmd.join(' ')} failed (${code}) in ${cwd}\n${stderr}`);
  return stdout;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Pack every non-private workspace package and unpack the tarballs into
 * `<dir>/node_modules/@urbicon-ui/<name>`. Everything publishable is installed,
 * so a stylesheet's `@import` of a sibling resolves the way it does for a
 * consumer; only the packages that ship `.svelte` are audited.
 */
export async function installTree(
  at = mkdtempSync(join(tmpdir(), 'consumer-css-'))
): Promise<Tree> {
  // `compile()` reports real paths; on macOS the temp dir is reached through
  // the `/var` → `/private/var` link, so anything relative to `at` would
  // climb out of it.
  const dir = realpathSync(at);
  const tarballs = join(dir, 'tarballs');
  const scopeDir = join(dir, 'node_modules', SCOPE.slice(0, -1));
  mkdirSync(tarballs, { recursive: true });
  mkdirSync(scopeDir, { recursive: true });

  // The consumer's `@import 'tailwindcss'` — the workspace's copy, resolved
  // rather than assumed at a path.
  const tailwind = dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json'));
  symlinkSync(tailwind, join(dir, 'node_modules', 'tailwindcss'));

  const installed: string[] = [];
  const audited: string[] = [];
  for (const entry of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = join(ROOT, 'packages', entry.name);
    const manifestPath = join(pkgDir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (manifest.private === true) continue;
    const name = manifest.name as string;
    if (!name.startsWith(SCOPE))
      throw new Error(`${entry.name} is published outside ${SCOPE}: ${name}`);
    const short = name.slice(SCOPE.length);

    // `bun pm pack`, not a copy of dist/: the packer applies `files`, so test
    // and fixture output that never reaches a consumer is not scanned either.
    await sh(['bun', 'pm', 'pack', '--destination', tarballs], pkgDir);
    const tgz = join(
      tarballs,
      `${name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
    );
    if (!existsSync(tgz)) throw new Error(`expected ${tgz} after packing ${name}`);
    const listing = await sh(['tar', '-tzf', tgz], dir);
    const dest = join(scopeDir, short);
    mkdirSync(dest);
    await sh(['tar', '-xzf', tgz, '--strip-components=1', '-C', dest], dir);
    installed.push(short);
    if (listing.split('\n').some((file) => file.endsWith('.svelte'))) audited.push(short);
  }
  return { dir, installed: installed.sort(), audited: audited.sort() };
}

function exportsStylesheet(manifest: Record<string, unknown>): boolean {
  const exports = manifest.exports;
  return typeof exports === 'object' && exports !== null && STYLE_EXPORT in exports;
}

/**
 * The CSS a consumer of `name` writes, in the order every package README
 * shows it: the stylesheets of the package's `@urbicon-ui/*` dependencies and
 * peers first, its own last. The peers are not optional here — a package's own
 * stylesheet imports nothing (Tailwind emits an imported file once per
 * import, so `blocks` is left to the consumer), and without blocks' `@theme`
 * a colour utility such as `outline-primary` is not a rule at all, so it would
 * drop out of the report as "not emitting" rather than show up as uncovered.
 * A package without a stylesheet of its own gets the peers alone — all the
 * coverage such a package can have.
 */
function consumerEntry(tree: Tree, name: string, manifest: Record<string, unknown>): string {
  const lines = ["@import 'tailwindcss';"];
  const declared = {
    ...(manifest.dependencies as Record<string, string> | undefined),
    ...(manifest.peerDependencies as Record<string, string> | undefined)
  };
  for (const dep of Object.keys(declared)) {
    if (!dep.startsWith(SCOPE)) continue;
    const short = dep.slice(SCOPE.length);
    if (!tree.installed.includes(short))
      throw new Error(`${name} depends on ${dep}, which is not in the tree`);
    const depManifest = readJson(join(tree.dir, 'node_modules', dep, 'package.json'));
    if (exportsStylesheet(depManifest)) lines.push(`@import '${dep}${STYLE_EXPORT.slice(1)}';`);
  }
  if (exportsStylesheet(manifest)) lines.push(`@import '${SCOPE}${name}${STYLE_EXPORT.slice(1)}';`);
  return lines.join('\n');
}

/**
 * The candidates Tailwind emits a rule for under `entry`. A fresh design system
 * per call — see the header on why a reused compiler answers wrongly.
 */
export async function emitting(tree: Tree, entry: string, candidates: string[]): Promise<string[]> {
  const design = await __unstable__loadDesignSystem(entry, { base: tree.dir });
  const css = design.candidatesToCss(candidates);
  return candidates.filter((_, i) => css[i] !== null);
}

export async function auditPackage(tree: Tree, name: string): Promise<Report> {
  const pkgDir = join(tree.dir, 'node_modules', SCOPE + name);
  const manifest = readJson(join(pkgDir, 'package.json'));
  const entry = consumerEntry(tree, name, manifest);

  // `compile()` resolves the `@import`s and every `@source` they declare; the
  // Scanner over those entries is what `@tailwindcss/vite` scans for a consumer,
  // minus the consumer's own project root — which holds no library markup.
  const compiler = await compile(entry, { base: tree.dir, onDependency: () => {} });
  const covered = new Set(new Scanner({ sources: compiler.sources }).scan());

  const present = new Map<string, string[]>();
  const files = walk(pkgDir).filter((file) => file.endsWith('.svelte'));
  const scanner = new Scanner({});
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const candidate of scanner.scanFiles([{ content, extension: 'svelte' }])) {
      const at = present.get(candidate);
      if (at) at.push(relative(pkgDir, file));
      else present.set(candidate, [relative(pkgDir, file)]);
    }
  }

  const missing = [...present.keys()].filter((candidate) => !covered.has(candidate));
  const uncovered = (await emitting(tree, entry, missing)).map((cls) => ({
    cls,
    files: present.get(cls) as string[]
  }));

  return {
    name,
    stylesheet: exportsStylesheet(manifest),
    entry,
    sources: compiler.sources.map((s) => `${relative(tree.dir, s.base)}/${s.pattern}`),
    files: files.length,
    covered,
    present,
    uncovered
  };
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

async function main(): Promise<number> {
  const t0 = performance.now();
  const tree = await installTree();
  try {
    const tInstalled = performance.now();
    console.log(
      `${c.gray}packed ${tree.installed.length} packages into ${tree.dir} in ${Math.round(tInstalled - t0)} ms; ` +
        `auditing ${tree.audited.join(', ')}${c.reset}`
    );
    let failed = 0;
    for (const name of tree.audited) {
      const t1 = performance.now();
      const report = await auditPackage(tree, name);
      const ms = Math.round(performance.now() - t1);
      const stats = `${report.files} files, ${report.present.size} present, ${report.covered.size} covered, ${ms} ms`;
      if (report.uncovered.length === 0) {
        console.log(
          `${c.green}✓${c.reset} ${c.bold}${name}${c.reset} ${c.gray}— ${stats}${c.reset}`
        );
        continue;
      }
      failed += 1;
      const why = report.stylesheet
        ? `${report.uncovered.length} classes its stylesheet does not reach (sources: ${report.sources.join(', ')})`
        : `exports no ${STYLE_EXPORT}, and ${report.uncovered.length} classes in its markup are compiled by none of its peers'`;
      console.log(
        `${c.red}✗${c.reset} ${c.bold}${name}${c.reset} — ${why} ${c.gray}(${stats})${c.reset}`
      );
      for (const { cls, files } of report.uncovered) {
        console.log(`    ${cls} ${c.gray}← ${files.join(', ')}${c.reset}`);
      }
    }
    const total = Math.round(performance.now() - t0);
    if (failed > 0) {
      console.error(
        `${c.red}${c.bold}consumer-css-check: ${failed} of ${tree.audited.length} packages ship classes a consumer never compiles${c.reset} ${c.gray}(${total} ms)${c.reset}`
      );
      return 1;
    }
    console.log(
      `${c.green}${c.bold}consumer-css-check: ${tree.audited.length} packages, every shipped class covered${c.reset} ${c.gray}(${total} ms)${c.reset}`
    );
    return 0;
  } finally {
    rmSync(tree.dir, { recursive: true, force: true });
  }
}

if (import.meta.main) process.exit(await main());
