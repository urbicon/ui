#!/usr/bin/env bun
/**
 * bundle-size.ts — Per-component minified + tree-shaken bundle size report,
 * across every package that ships components (blocks, table, auth).
 *
 * Simulates a real consumer: for every component group (one directory under a
 * package's dist, e.g. Tab + TabItem + TabPanel) it builds a tiny virtual app
 * entry that imports just that group from its package (resolved through
 * node_modules like a consumer would, so the package.json `exports` +
 * `sideEffects` semantics apply), bundles it with Vite + vite-plugin-svelte,
 * minifies, and measures raw + gzip bytes.
 *
 * Two things are subtracted, and the difference between them matters:
 *
 *   - **Svelte** (svelte, svelte/*) is externalized, so no component is billed
 *     for the runtime the consumer's app bundles anyway.
 *   - **The foundation** — the tv() variant engine plus the provider context —
 *     is measured as its own entry, and every group is measured a second time
 *     ON TOP of it. The difference is the `net` column: a `Separator`, one line
 *     on screen, measures 5.1 KB gz solo but adds 0.6 KB to a project already
 *     using the library. That is the only number a reader can act on, and it is
 *     what the docs surfaces quote.
 *
 * `net` is a real second build rather than `gz − foundation`, because not every
 * component carries the whole foundation: `Sparkline` and `FormField` never
 * touch the tv() engine, and subtracting it wholesale printed them as costing
 * nothing at all. Solo `gz` stays the baseline and gate metric, so a regression
 * cannot hide behind a foundation that moved.
 *
 * A third row is informational only: the Svelte runtime share, derived once
 * from a Button build WITH svelte bundled.
 *
 * Usage:
 *   bun scripts/bundle-size.ts                    # full report (Δ vs baseline if present)
 *   bun scripts/bundle-size.ts --filter button    # only groups matching a substring
 *   bun scripts/bundle-size.ts --package auth     # only one package (blocks|table|auth)
 *   bun scripts/bundle-size.ts --update-baseline  # write bundle-size.baseline.json
 *   bun scripts/bundle-size.ts --check            # CI gate: fail on gz growth > max(256 B, 3 %)
 *   bun scripts/bundle-size.ts --json             # machine-readable report on stdout
 *   bun scripts/bundle-size.ts --concurrency 4    # parallel builds (default 4)
 *   bun scripts/bundle-size.ts --filter button --breakdown
 *                                                 # per-source-module byte attribution
 *                                                 # (sourcemap-based; answers "what
 *                                                 # exactly makes this big?")
 *   bun scripts/bundle-size.ts --entry Button,Input,Dialog
 *                                                 # ONE combined bundle — the marginal-cost
 *                                                 # workflow: cost(set∪X) − cost(set) is what
 *                                                 # X really adds to an app. Prefix with a
 *                                                 # package for the others: auth:LoginPage.
 *
 * The tool doubles as a tree-shaking regression guard: a component that starts
 * dragging the full icon registry (the `getIcon()` anti-pattern) or another
 * barrel jumps by an order of magnitude and fails `--check` immediately.
 * CSS is out of scope (Tailwind generates it consumer-side).
 *
 * Chunk accounting: min/gzip (and the baseline/--check gate) count only the
 * chunks statically reachable from the entry — what the consumer pays on page
 * load. Chunks reachable only via dynamic import() (e.g. the mint built-in
 * set behind `mintRegistry.apply`'s demand-load) are priced on use, not on
 * load; they are reported in a separate `lazy gz` column and gated separately
 * in --check (the baseline records them per component under `lazy`), so they
 * stay visible and cannot silently grow without polluting the load-cost
 * headline.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BASELINE_PATH = join(REPO_ROOT, 'bundle-size.baseline.json');

const VIRTUAL_ID = 'virtual:bundle-size-entry';

// CI gate tolerance: fail only when gzip grows by BOTH more than these.
const TOLERANCE_BYTES = 256;
const TOLERANCE_RATIO = 0.03;

/**
 * What every component build contains before it contains anything of its own:
 * the tv() engine (~13.6 KB min on its own) and the provider context. Measured
 * as an entry rather than assumed, so the number follows the code.
 *
 * `tv` is the honest handle on the engine — importing a component to establish
 * the floor would fold that component's own weight into it.
 */
const FOUNDATION_EXPORTS = ['tv', 'BlocksProvider'];

interface PackageSpec {
  /** Report prefix and baseline field; matches the docs catalogue's package short name. */
  key: string;
  /** What a consumer writes in the import. */
  specifier: string;
  /** Built package root, holding `dist/`. */
  root: string;
  /** Directories under `dist/` scanned for component groups, with the kind they yield. */
  sections: ReadonlyArray<readonly [string, Group['kind']]>;
  /**
   * Groups the directory scan cannot find, because the package does not ship
   * one directory per component. Kept minimal — the catalogue check reports
   * anything a package ships and this file forgot.
   */
  explicit?: ReadonlyArray<{ name: string; exports: string[]; kind: Group['kind'] }>;
}

const PACKAGES: PackageSpec[] = [
  {
    key: 'blocks',
    specifier: '@urbicon-ui/blocks',
    root: join(REPO_ROOT, 'packages', 'blocks'),
    sections: [
      ['primitives', 'primitive'],
      ['components', 'component']
    ]
  },
  {
    key: 'table',
    specifier: '@urbicon-ui/table',
    root: join(REPO_ROOT, 'packages', 'table'),
    // No per-component directories: `dist/core/table/index.js` is `export {}`
    // and the barrel also exports the parts Table is assembled from (TableRow,
    // HeaderMenu, …), which are not components a consumer picks.
    sections: [],
    explicit: [{ name: 'Table', exports: ['Table'], kind: 'component' }]
  },
  {
    key: 'auth',
    specifier: '@urbicon-ui/auth',
    root: join(REPO_ROOT, 'packages', 'auth'),
    sections: [['client/components', 'component']]
  }
];

interface Group {
  name: string;
  exports: string[];
  kind: 'primitive' | 'component' | 'system';
  /** Which package the entry imports from. */
  pkg: PackageSpec;
}

interface Size {
  min: number;
  gz: number;
}

interface Measurement extends Size {
  name: string;
  kind: Group['kind'];
  exports: string[];
  /** Package short name (`blocks` | `table` | `auth`). */
  pkg: string;
  /**
   * Marginal cost over the foundation — `cost(foundation ∪ group) −
   * cost(foundation)`, a real second build rather than a subtraction. It has
   * to be measured: a component that never touches the tv() engine (Sparkline,
   * FormField) does not carry the whole foundation, and subtracting it wholesale
   * printed those as costing 0.
   */
  net: Size;
  /** Demand-loaded (dynamic-import-only) chunk bytes — excluded from min/gz. */
  lazy: Size;
  /** min bytes per source module (only populated with --breakdown). */
  bySource?: Map<string, number>;
}

interface Baseline {
  note: string;
  toolchain: { svelte: string; vite: string };
  /**
   * The shared floor every component build contains. Recorded so the `net`
   * numbers stay reconstructable from the file alone, and so a foundation
   * that moves is visible rather than smeared across every row.
   */
  foundation?: Size;
  // `lazy` is absent in baselines written before demand-loaded chunks existed
  // (read tolerantly as 0/0); every new write records it uniformly. `net`,
  // `pkg` and `exports` likewise post-date the single-package era.
  sizes: Record<
    string,
    Size & {
      lazy?: Size;
      net?: Size;
      pkg?: string;
      /**
       * Every component this row's number covers. A group shares its code, so
       * one measurement is the honest answer for all of them — and it is how a
       * consumer looks up a component the catalogue lists but the baseline
       * does not key by name (the Guide surfaces, `DateRangePicker`).
       */
      exports?: string[];
    }
  >;
}

/** The marginal cost of `combined` over the foundation it was built on top of. */
function marginalOf(combined: Size, foundation: Size): Size {
  return {
    min: Math.max(0, combined.min - foundation.min),
    gz: Math.max(0, combined.gz - foundation.gz)
  };
}

// --- CLI ---------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    filter: { type: 'string', multiple: true },
    package: { type: 'string', multiple: true },
    'update-baseline': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    // Debugging aid: write each measured bundle to <dir>/<name>.js so a
    // suspicious size can be inspected (what exactly got pulled in?).
    dump: { type: 'string' },
    // Per-source-module byte attribution via sourcemap (use with --filter).
    breakdown: { type: 'boolean', default: false },
    // Ad-hoc combined entry: measure ONE bundle importing the given exports
    // together (comma-separated, e.g. --entry Button,Input,Dialog). This is
    // how marginal cost is measured — cost(A∪B) − cost(B) — since solo rows
    // double-count the shared floor (tv() engine, provider context) that a
    // real app pays once. No baseline interaction, composes with --breakdown.
    entry: { type: 'string' }
  }
});

// --- Discovery ---------------------------------------------------------------

function readSvelteExports(indexPath: string): string[] {
  if (!existsSync(indexPath)) return [];
  const source = readFileSync(indexPath, 'utf8');
  return [...source.matchAll(/export \{ default as (\w+) \} from '\.\/[\w.]+\.svelte'/g)].map(
    (m) => m[1]
  );
}

/** One measurable group per component directory (Tab = Tab + TabItem + TabPanel). */
function discoverGroups(packages: PackageSpec[]): Group[] {
  const groups: Group[] = [];
  for (const pkg of packages) {
    const dist = join(pkg.root, 'dist');
    for (const [dir, kind] of pkg.sections) {
      for (const entry of readdirSync(join(dist, dir), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const exports = readSvelteExports(join(dist, dir, entry.name, 'index.js'));
        if (exports.length > 0) {
          groups.push({ name: entry.name, exports, kind, pkg });
          continue;
        }
        // Family directory (e.g. components/Chat): no direct .svelte exports at
        // the top, but member directories that are components in their own
        // right — measure each member as its own group.
        for (const sub of readdirSync(join(dist, dir, entry.name), { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          const subExports = readSvelteExports(join(dist, dir, entry.name, sub.name, 'index.js'));
          if (subExports.length > 0) {
            groups.push({ name: sub.name, exports: subExports, kind, pkg });
          }
        }
      }
    }
    for (const g of pkg.explicit ?? []) groups.push({ ...g, exports: [...g.exports], pkg });
  }

  const blocks = packages.find((p) => p.key === 'blocks');
  if (blocks) {
    // System surfaces worth tracking alongside the component groups: the
    // provider, the dynamic <Icon name="…"> (expected heavy: full registry)
    // and one representative static icon (the tree-shaken per-icon cost).
    groups.push({
      name: 'BlocksProvider',
      exports: ['BlocksProvider'],
      kind: 'system',
      pkg: blocks
    });
    groups.push({ name: 'Icon', exports: ['Icon'], kind: 'system', pkg: blocks });
    groups.push({ name: 'CheckIcon', exports: ['CheckIcon'], kind: 'system', pkg: blocks });
    // A2UIView opted into the Urbicon catalog: the delta over the base A2UIView
    // group is the opt-in dispatcher + its 27 mapped primitives. Tracking both
    // guards the tree-shaking boundary — the base A2UIView group must not grow
    // (no urbicon/ leak into the Basic path).
    groups.push({
      name: 'A2UIViewUrbicon',
      exports: ['A2UIView', 'urbiconA2uiCatalog'],
      kind: 'system',
      pkg: blocks
    });
  }

  // One baseline spans three packages, and it is keyed by name because that is
  // what the docs surfaces look a component up by. A collision would make one
  // package silently overwrite the other's number.
  const seen = new Map<string, string>();
  for (const g of groups) {
    const previous = seen.get(g.name);
    if (previous) {
      console.error(
        `Name collision: "${g.name}" ships in both ${previous} and ${g.pkg.key}. The baseline ` +
          `is keyed by name — give one of them a distinct group name before measuring.`
      );
      process.exit(1);
    }
    seen.set(g.name, g.pkg.key);
  }
  return groups;
}

/**
 * Components the catalogue ships but this script never measured — the exact
 * hole that left 24 of 98 landing rows without a number. Silent when docs-gen
 * has not run (`_catalog.json` is a git-ignored artefact).
 *
 * A component counts as measured when it is a group of its own OR one of a
 * group's exports: the nine Guide surfaces ship as one `Guide` group and
 * `DateRangePicker` inside `DatePicker`, because they share most of their code
 * and measuring them apart would bill that share once per sibling.
 */
function unmeasuredCatalogEntries(groups: Group[]): string[] {
  const measured = new Set(groups.flatMap((g) => [g.name, ...g.exports]));
  const missing: string[] = [];
  for (const pkg of PACKAGES) {
    const path = join(REPO_ROOT, 'apps', 'docs', 'static', pkg.key, '_catalog.json');
    if (!existsSync(path)) continue;
    const catalog = JSON.parse(readFileSync(path, 'utf8')) as Array<{ name: string }>;
    for (const entry of catalog) {
      if (!measured.has(entry.name)) missing.push(`${pkg.key}:${entry.name}`);
    }
  }
  return missing;
}

// --- Sourcemap attribution (--breakdown) -------------------------------------

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64: Record<string, number> = Object.fromEntries([...B64_CHARS].map((c, i) => [c, i]));

/** Decode one sourcemap VLQ segment ("AACA" → [0, 0, 1, 0]). */
function decodeSegment(seg: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const ch of seg) {
    const digit = B64[ch];
    value |= (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

/**
 * Attribute a chunk's minified bytes to their source modules: each mapping
 * segment owns the generated columns up to the next segment (or line end).
 * Columns are UTF-16 units, bytes are UTF-8 — close enough for a breakdown.
 */
function attributeBySource(
  code: string,
  map: { sources: string[]; mappings: string },
  into: Map<string, number>
): void {
  const codeLines = code.split('\n');
  const mappingLines = map.mappings.split(';');
  let srcIdx = 0; // persists across segments and lines per spec
  for (let li = 0; li < mappingLines.length; li++) {
    const lineLen = codeLines[li]?.length ?? 0;
    const points: Array<{ col: number; src: string }> = [];
    let genCol = 0;
    for (const seg of mappingLines[li].split(',')) {
      if (seg === '') continue;
      const fields = decodeSegment(seg);
      genCol += fields[0];
      if (fields.length >= 4) {
        srcIdx += fields[1];
        points.push({ col: genCol, src: map.sources[srcIdx] ?? '<unknown>' });
      } else {
        points.push({ col: genCol, src: '<unmapped>' });
      }
    }
    if (points.length === 0) {
      if (lineLen > 0) into.set('<unmapped>', (into.get('<unmapped>') ?? 0) + lineLen);
      continue;
    }
    if (points[0].col > 0) into.set('<unmapped>', (into.get('<unmapped>') ?? 0) + points[0].col);
    for (let i = 0; i < points.length; i++) {
      const end = i + 1 < points.length ? points[i + 1].col : lineLen;
      const bytes = Math.max(0, end - points[i].col);
      if (bytes > 0) into.set(points[i].src, (into.get(points[i].src) ?? 0) + bytes);
    }
  }
}

/** Shorten a sourcemap source path to something readable in the report. */
function shortSource(source: string): string {
  const markers = ['/packages/', '/node_modules/'];
  for (const marker of markers) {
    const at = source.lastIndexOf(marker);
    if (at !== -1) return source.slice(at + 1);
  }
  return source.replace(/^(\.\.\/)+/, '');
}

// --- Measurement -------------------------------------------------------------

/** Build `code` as an app entry against the packaged library; sum minified JS bytes. */
async function measure(
  code: string,
  { bundleSvelte = false, dumpName = '' } = {}
): Promise<Size & { lazy: Size; bySource?: Map<string, number> }> {
  const result = await build({
    configFile: false,
    root: REPO_ROOT,
    logLevel: 'error',
    clearScreen: false,
    plugins: [
      {
        name: 'bundle-size-virtual-entry',
        resolveId(id: string) {
          if (id === VIRTUAL_ID) return `\0${VIRTUAL_ID}`;
        },
        load(id: string) {
          if (id === `\0${VIRTUAL_ID}`) return code;
        }
      },
      // dist/ ships preprocessed .svelte — no svelte.config.js needed here.
      svelte({ configFile: false })
    ],
    build: {
      write: false,
      modulePreload: false,
      reportCompressedSize: false,
      sourcemap: args.breakdown,
      rollupOptions: {
        input: VIRTUAL_ID,
        // Net-of-Svelte is the headline number: the runtime is shared across
        // the consumer's whole app, components should not be billed for it.
        external: [...(bundleSvelte ? [] : [/^svelte(\/|$)/]), /^@sveltejs\/kit(\/|$)/, /^\$app\//]
      }
    }
  });

  const outputs = Array.isArray(result) ? result : [result];
  interface MeasuredChunk {
    fileName: string;
    isEntry: boolean;
    imports: string[];
    code: string;
    map: { sources: string[]; mappings: string } | null;
  }
  const chunks: MeasuredChunk[] = [];
  for (const out of outputs) {
    if (!('output' in out)) continue;
    for (const item of out.output) {
      if (item.type !== 'chunk') continue; // CSS/assets: out of scope
      // Strip the sourceMappingURL footer --breakdown adds, so its numbers
      // stay byte-identical with plain runs (and the baseline).
      const chunkCode = item.code.replace(/\n?\/\/# sourceMappingURL=\S*\s*$/, '');
      if (chunkCode.trim() === '') continue; // fully tree-shaken — no gzip-header phantom bytes
      chunks.push({
        fileName: item.fileName,
        isEntry: item.isEntry,
        imports: item.imports,
        code: chunkCode,
        map: item.map
      });
    }
  }

  // Initial = chunks statically reachable from the entry (walk `imports`, the
  // static edges). Everything else is only reachable via dynamic import() —
  // demand-loaded at runtime, paid on first use rather than on page load, so
  // it is summed separately and kept out of the headline (and the baseline).
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const reachable = new Set<string>();
  const stack = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (reachable.has(name)) continue;
    reachable.add(name);
    const chunk = byName.get(name);
    if (chunk) stack.push(...chunk.imports);
  }

  let min = 0;
  let gz = 0;
  const lazy: Size = { min: 0, gz: 0 };
  const dumped: string[] = [];
  const bySource = args.breakdown ? new Map<string, number>() : undefined;
  for (const chunk of chunks) {
    const bytes = Buffer.byteLength(chunk.code);
    const gzBytes = gzipSync(chunk.code, { level: 9 }).length;
    if (reachable.has(chunk.fileName)) {
      min += bytes;
      gz += gzBytes;
      if (bySource && chunk.map) attributeBySource(chunk.code, chunk.map, bySource);
      dumped.push(chunk.code);
    } else {
      lazy.min += bytes;
      lazy.gz += gzBytes;
      dumped.push(`// ---- demand-loaded chunk (${chunk.fileName}) ----\n${chunk.code}`);
    }
  }
  if (args.dump && dumpName) {
    mkdirSync(args.dump, { recursive: true });
    writeFileSync(join(args.dump, `${dumpName}.js`), dumped.join('\n// ---- next chunk ----\n'));
  }
  return { min, gz, lazy, bySource };
}

function entryFor(exports: string[], specifier = '@urbicon-ui/blocks'): string {
  // console.log keeps the imports alive; app builds drop unused entry exports.
  return `import { ${exports.join(', ')} } from '${specifier}';\nconsole.log(${exports.join(', ')});\n`;
}

/**
 * An entry importing a group *together with* the foundation, so the difference
 * against the foundation alone is the group's real marginal cost.
 *
 * Both halves may come from different packages (an auth page on top of the
 * blocks foundation), hence two import lines. Names already in the foundation
 * are dropped rather than imported twice — `BlocksProvider` is measured as a
 * group of its own, and a duplicate import is a syntax error.
 */
function entryWithFoundation(exports: string[], specifier: string): string {
  const own = exports.filter((e) => !FOUNDATION_EXPORTS.includes(e));
  const lines = [`import { ${FOUNDATION_EXPORTS.join(', ')} } from '@urbicon-ui/blocks';`];
  if (own.length > 0) lines.push(`import { ${own.join(', ')} } from '${specifier}';`);
  return `${lines.join('\n')}\nconsole.log(${[...FOUNDATION_EXPORTS, ...own].join(', ')});\n`;
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

// --- Formatting --------------------------------------------------------------

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Aggregated, shortened, size-sorted per-module attribution of a measurement. */
function breakdownOf(m: Measurement): Array<[string, number]> {
  if (!m.bySource) return [];
  const agg = new Map<string, number>();
  for (const [src, bytes] of m.bySource) {
    const key = shortSource(src);
    agg.set(key, (agg.get(key) ?? 0) + bytes);
  }
  return [...agg.entries()].sort((a, b) => b[1] - a[1]);
}

function pad(s: string, width: number, right = false): string {
  return right ? s.padStart(width) : s.padEnd(width);
}

function versionOf(pkg: string): string {
  try {
    const raw = readFileSync(join(REPO_ROOT, 'node_modules', pkg, 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  const wanted = (args.package ?? []).flatMap((p) => p.split(',')).map((p) => p.toLowerCase());
  const unknown = wanted.filter((w) => !PACKAGES.some((p) => p.key === w));
  if (unknown.length > 0) {
    console.error(
      `Unknown --package ${unknown.join(', ')}. Known: ${PACKAGES.map((p) => p.key).join(', ')}.`
    );
    process.exit(1);
  }
  const packages = wanted.length > 0 ? PACKAGES.filter((p) => wanted.includes(p.key)) : PACKAGES;

  for (const pkg of packages) {
    if (!existsSync(join(pkg.root, 'dist', 'index.js'))) {
      console.error(`${pkg.specifier}: dist/index.js missing — run \`bun run build\` first.`);
      process.exit(1);
    }
  }

  // Ad-hoc combined measurement (marginal-cost workflows) — measure and exit.
  // `auth:LoginPage` picks the package; a bare name means blocks.
  if (args.entry) {
    const parts = args.entry
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      console.error('--entry needs at least one export name.');
      process.exit(1);
    }
    const keys = new Set(parts.map((p) => (p.includes(':') ? p.split(':')[0] : 'blocks')));
    if (keys.size > 1) {
      console.error(
        `--entry builds ONE bundle, so all names must share a package (got ${[...keys].join(', ')}).`
      );
      process.exit(1);
    }
    const key = [...keys][0];
    const spec = PACKAGES.find((p) => p.key === key);
    if (!spec) {
      console.error(
        `Unknown package "${key}" in --entry. Known: ${PACKAGES.map((p) => p.key).join(', ')}.`
      );
      process.exit(1);
    }
    const exports = parts.map((p) => (p.includes(':') ? p.slice(p.indexOf(':') + 1) : p));
    const size = await measure(entryFor(exports, spec.specifier), { dumpName: 'entry' });
    const m: Measurement = {
      name: exports.join('+'),
      kind: 'system',
      exports,
      pkg: spec.key,
      ...size
    };
    console.log(
      `${m.name}: ${kb(m.min)} min  ${kb(m.gz)} gz` +
        (m.lazy.gz > 0 ? `  (+ ${kb(m.lazy.gz)} gz demand-loaded)` : '')
    );
    if (args.breakdown) {
      for (const [src, bytes] of breakdownOf(m).slice(0, 25)) {
        console.log(
          `  ${pad(kb(bytes), 9, true)}  ${(((bytes / m.min) * 100).toFixed(1)).padStart(5)} %  ${src}`
        );
      }
    }
    return;
  }

  const filters = (args.filter ?? []).flatMap((f) => f.split(',')).map((f) => f.toLowerCase());
  const concurrency = Math.max(1, Number.parseInt(args.concurrency ?? '4', 10) || 4);

  const allGroups = discoverGroups(packages);
  let groups = allGroups;
  if (filters.length > 0) {
    // Matches exports too, so `--filter daterange` reaches the DatePicker group
    // that holds it rather than reporting "no match" for a shipped component.
    groups = groups.filter((g) =>
      filters.some((f) => [g.name, ...g.exports].some((n) => n.toLowerCase().includes(f)))
    );
    if (groups.length === 0) {
      console.error(`No component group matches --filter ${filters.join(',')}`);
      process.exit(1);
    }
  }

  const started = performance.now();
  console.error(`Measuring ${groups.length} component groups (concurrency ${concurrency})…`);

  // The floor every component build carries before it carries anything of its
  // own — subtracted into the `net` column, which is the number the docs quote.
  const foundation = await measure(entryFor(FOUNDATION_EXPORTS), { dumpName: '__foundation__' });

  const measurements = await pool(groups, concurrency, async (group): Promise<Measurement> => {
    // Two builds: the solo cost (baseline + gate metric) and the same group on
    // top of the foundation, whose difference is what the docs quote.
    const [size, combined] = await Promise.all([
      measure(entryFor(group.exports, group.pkg.specifier), { dumpName: group.name }),
      measure(entryWithFoundation(group.exports, group.pkg.specifier))
    ]);
    const net = marginalOf(combined, foundation);
    console.error(
      `  ✓ ${pad(group.name, 20)} ${pad(kb(size.min), 9, true)} min  ${pad(kb(size.gz), 9, true)} gz  ${pad(kb(net.gz), 9, true)} net`
    );
    return {
      name: group.name,
      kind: group.kind,
      exports: group.exports,
      pkg: group.pkg.key,
      net,
      ...size
    };
  });

  // Context: Svelte runtime share, from one representative build WITH svelte.
  const button = measurements.find((m) => m.name === 'Button');
  let svelteRuntimeGz: number | null = null;
  if (button) {
    const withSvelte = await measure(entryFor(button.exports), { bundleSvelte: true });
    svelteRuntimeGz = Math.max(0, withSvelte.gz - button.gz);
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const baseline: Baseline | null = existsSync(BASELINE_PATH)
    ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline)
    : null;

  const sorted = [...measurements].sort((a, b) => b.gz - a.gz);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          toolchain: { svelte: versionOf('svelte'), vite: versionOf('vite') },
          foundation: { min: foundation.min, gz: foundation.gz },
          svelteRuntimeGz,
          components: sorted.map((m) => ({
            name: m.name,
            kind: m.kind,
            pkg: m.pkg,
            exports: m.exports,
            min: m.min,
            gz: m.gz,
            net: m.net,
            lazy: m.lazy,
            ...(args.breakdown ? { breakdown: Object.fromEntries(breakdownOf(m)) } : {})
          }))
        },
        null,
        2
      )
    );
  } else {
    // Demand-loaded column only when some group actually splits off a chunk.
    const showLazy = sorted.some((m) => m.lazy.gz > 0);
    const showPkg = new Set(sorted.map((m) => m.pkg)).size > 1;
    const nameWidth = Math.max(...sorted.map((m) => m.name.length), 9) + 2;
    const pkgHead = showPkg ? ` ${pad('pkg', 7)}` : '';
    const lazyHead = showLazy ? ` ${pad('lazy gz†', 10, true)}` : '';
    console.log('');
    console.log(
      `${pad('Component', nameWidth)}${pkgHead} ${pad('min', 10, true)} ${pad('gzip', 10, true)} ${pad('net gz*', 10, true)}${lazyHead} ${pad('Δ gz vs baseline', 18, true)}`
    );
    for (const m of sorted) {
      const pkgCol = showPkg ? ` ${pad(m.pkg, 7)}` : '';
      const netCol = ` ${pad(kb(m.net.gz), 10, true)}`;
      const lazyCol = showLazy ? ` ${pad(m.lazy.gz > 0 ? kb(m.lazy.gz) : '—', 10, true)}` : '';
      const base = baseline?.sizes[m.name];
      let delta = base ? '' : 'new';
      if (base) {
        const d = m.gz - base.gz;
        const pct = base.gz > 0 ? ((d / base.gz) * 100).toFixed(1) : '0.0';
        delta =
          d === 0
            ? '±0'
            : `${d > 0 ? '+' : '−'}${kb(Math.abs(d))} (${d > 0 ? '+' : '−'}${Math.abs(Number(pct))} %)`;
      }
      console.log(
        `${pad(m.name, nameWidth)}${pkgCol} ${pad(kb(m.min), 10, true)} ${pad(kb(m.gz), 10, true)}${netCol}${lazyCol} ${pad(delta, 18, true)}`
      );
    }
    console.log('');
    console.log(
      `Foundation (tv() engine + provider context, in every build exactly once): ${kb(foundation.min)} min  ${kb(foundation.gz)} gz`
    );
    if (svelteRuntimeGz !== null) {
      console.log(`Svelte runtime (external, paid once per app): ~${kb(svelteRuntimeGz)} gz`);
    }
    console.log(
      `* net gz = cost(foundation + component) − cost(foundation), measured — what the component adds to a project already using the library`
    );
    const missing = unmeasuredCatalogEntries(allGroups);
    if (missing.length > 0) {
      console.log(
        `\n⚠ ${missing.length} catalogue component(s) unmeasured — every surface quoting bytes shows "—" for them:\n  ${missing.join(', ')}`
      );
    }
    if (showLazy) {
      console.log(
        `† demand-loaded via dynamic import() (e.g. the mint built-in set) — fetched on first use, not on page load; excluded from min/gzip and the baseline`
      );
    }
    console.log(
      `Measured in ${seconds}s. Svelte ${versionOf('svelte')}, Vite ${versionOf('vite')}.`
    );

    if (args.breakdown) {
      for (const m of sorted) {
        const entries = breakdownOf(m);
        if (entries.length === 0) continue;
        console.log(`\n${m.name} — minified bytes by source module:`);
        const top = entries.slice(0, 20);
        for (const [src, bytes] of top) {
          const pct = ((bytes / m.min) * 100).toFixed(1).padStart(5);
          console.log(`  ${pad(kb(bytes), 9, true)}  ${pct} %  ${src}`);
        }
        if (entries.length > top.length) {
          const rest = entries.slice(top.length).reduce((sum, [, b]) => sum + b, 0);
          const pct = ((rest / m.min) * 100).toFixed(1).padStart(5);
          console.log(
            `  ${pad(kb(rest), 9, true)}  ${pct} %  (${entries.length - top.length} more modules)`
          );
        }
      }
    }
  }

  // --- Baseline handling -----------------------------------------------------

  if (args['update-baseline']) {
    // Uniform entry shape for every row — no field beyond these ever leaks in.
    type Entry = Size & { lazy: Size; net: Size; pkg?: string; exports?: string[] };
    const entry = (
      s: Size & { net: Size; lazy?: Size; pkg?: string; exports?: string[] }
    ): Entry => ({
      min: s.min,
      gz: s.gz,
      net: s.net,
      lazy: { min: s.lazy?.min ?? 0, gz: s.lazy?.gz ?? 0 },
      ...(s.pkg ? { pkg: s.pkg } : {}),
      ...(s.exports ? { exports: s.exports } : {})
    });
    const sizes: Record<string, Entry> = {};
    // Full (unfiltered) runs replace the baseline; filtered runs patch into it.
    // A filtered run also leaves other packages' rows alone — the same reason.
    if ((filters.length > 0 || packages.length < PACKAGES.length) && baseline) {
      const stale: string[] = [];
      for (const [name, s] of Object.entries(baseline.sizes)) {
        // `net` is measured, never recomputed — a row carried over from a
        // baseline that predates it cannot be filled in from `gz` alone.
        if (!s.net) {
          stale.push(name);
          continue;
        }
        sizes[name] = entry({ ...s, net: s.net });
      }
      if (stale.length > 0) {
        console.error(
          `${stale.length} row(s) predate the \`net\` column and were dropped rather than guessed ` +
            `(${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', …' : ''}). Run without --filter/--package to restore them.`
        );
      }
    }
    for (const m of measurements) sizes[m.name] = entry(m);
    const next: Baseline = {
      note: 'Generated by scripts/bundle-size.ts (--update-baseline). Net-of-Svelte, minified; gz = gzip -9. min/gz cover initial (statically reachable) chunks and are the gate metric; net = cost(foundation + component) − cost(foundation), measured, and is what the docs surfaces quote; lazy = demand-loaded dynamic-import chunks, gated separately.',
      toolchain: { svelte: versionOf('svelte'), vite: versionOf('vite') },
      foundation: { min: foundation.min, gz: foundation.gz },
      sizes: Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b)))
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.error(`Baseline written: ${BASELINE_PATH}`);
    return;
  }

  if (args.check) {
    if (!baseline) {
      console.error('No baseline found — run with --update-baseline first.');
      process.exit(1);
    }
    const failures: string[] = [];
    for (const m of measurements) {
      const base = baseline.sizes[m.name];
      if (!base) {
        failures.push(`${m.name}: not in baseline — run --update-baseline to record it.`);
        continue;
      }
      const growth = m.gz - base.gz;
      if (growth > Math.max(TOLERANCE_BYTES, base.gz * TOLERANCE_RATIO)) {
        failures.push(
          `${m.name}: ${kb(base.gz)} → ${kb(m.gz)} gz (+${kb(growth)}). Tree-shaking regression? If intentional, run --update-baseline.`
        );
      }
      // Demand-loaded chunks are not load-time cost, but silent unbounded
      // growth would still be a regression — gate them on their own budget.
      const baseLazyGz = base.lazy?.gz ?? 0;
      const lazyGrowth = m.lazy.gz - baseLazyGz;
      if (lazyGrowth > Math.max(TOLERANCE_BYTES, baseLazyGz * TOLERANCE_RATIO)) {
        failures.push(
          `${m.name}: lazy chunk ${kb(baseLazyGz)} → ${kb(m.lazy.gz)} gz (+${kb(lazyGrowth)}). Demand-loaded set growing? If intentional, run --update-baseline.`
        );
      }
    }
    if (failures.length > 0) {
      console.error(`\nBundle-size check FAILED (${failures.length}):`);
      for (const f of failures) console.error(`  ✗ ${f}`);
      process.exit(1);
    }
    console.error('\nBundle-size check passed.');
  }
}

await main();
