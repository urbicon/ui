#!/usr/bin/env bun
/**
 * bundle-size.ts — Per-component minified + tree-shaken bundle size report.
 *
 * Simulates a real consumer: for every component group (one directory under
 * dist/primitives|components, e.g. Tab + TabItem + TabPanel) it builds a tiny
 * virtual app entry that imports just that group from '@urbicon-ui/blocks'
 * (resolved through node_modules like a consumer would, so the package.json
 * `exports` + `sideEffects` semantics apply), bundles it with Vite +
 * vite-plugin-svelte, minifies, and measures raw + gzip bytes.
 *
 * Svelte itself (svelte, svelte/*) is externalized — the reported numbers are
 * the NET cost of the library code (component + shared internals + barrel
 * side-effects), i.e. what a consumer app pays on top of the Svelte runtime it
 * bundles anyway. Two context rows are measured separately:
 *   - "barrel side-effect floor": `import '@urbicon-ui/blocks'` alone — what a
 *     barrel import pays before any component is used. Currently 0 under
 *     rolldown-vite (side-effect modules like dist/i18n/index.js get dropped;
 *     translations still arrive via the direct imports of the components that
 *     use them — verified: Dialog bundles en+de). If this ever grows, a `net
 *     gz` column appears that subtracts it (gzip is not additive; approximate).
 *   - the Svelte runtime share, derived once from a Button build WITH svelte
 *     bundled (informational only, not part of any component number).
 *
 * Usage:
 *   bun scripts/bundle-size.ts                    # full report (Δ vs baseline if present)
 *   bun scripts/bundle-size.ts --filter button    # only groups matching a substring
 *   bun scripts/bundle-size.ts --update-baseline  # write bundle-size.baseline.json
 *   bun scripts/bundle-size.ts --check            # CI gate: fail on gz growth > max(256 B, 3 %)
 *   bun scripts/bundle-size.ts --json             # machine-readable report on stdout
 *   bun scripts/bundle-size.ts --concurrency 4    # parallel builds (default 4)
 *   bun scripts/bundle-size.ts --filter button --breakdown
 *                                                 # per-source-module byte attribution
 *                                                 # (sourcemap-based; answers "what
 *                                                 # exactly makes this big?")
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
const BLOCKS_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(BLOCKS_ROOT, '../..');
const DIST = join(BLOCKS_ROOT, 'dist');
const BASELINE_PATH = join(BLOCKS_ROOT, 'bundle-size.baseline.json');

const VIRTUAL_ID = 'virtual:bundle-size-entry';

// CI gate tolerance: fail only when gzip grows by BOTH more than these.
const TOLERANCE_BYTES = 256;
const TOLERANCE_RATIO = 0.03;

interface Group {
  name: string;
  exports: string[];
  kind: 'primitive' | 'component' | 'system';
}

interface Size {
  min: number;
  gz: number;
}

interface Measurement extends Size {
  name: string;
  kind: Group['kind'];
  exports: string[];
  /** Demand-loaded (dynamic-import-only) chunk bytes — excluded from min/gz. */
  lazy: Size;
  /** min bytes per source module (only populated with --breakdown). */
  bySource?: Map<string, number>;
}

interface Baseline {
  note: string;
  toolchain: { svelte: string; vite: string };
  // `lazy` is absent in baselines written before demand-loaded chunks existed
  // (read tolerantly as 0/0); every new write records it uniformly.
  sizes: Record<string, Size & { lazy?: Size }>;
}

// --- CLI ---------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    filter: { type: 'string', multiple: true },
    'update-baseline': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    // Debugging aid: write each measured bundle to <dir>/<name>.js so a
    // suspicious size can be inspected (what exactly got pulled in?).
    dump: { type: 'string' },
    // Per-source-module byte attribution via sourcemap (use with --filter).
    breakdown: { type: 'boolean', default: false }
  }
});

// --- Discovery ---------------------------------------------------------------

/** One measurable group per component directory (Tab = Tab + TabItem + TabPanel). */
function discoverGroups(): Group[] {
  const groups: Group[] = [];
  const sections = [
    ['primitives', 'primitive'],
    ['components', 'component']
  ] as const;
  for (const [dir, kind] of sections) {
    for (const entry of readdirSync(join(DIST, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = join(DIST, dir, entry.name, 'index.js');
      if (!existsSync(indexPath)) continue;
      const source = readFileSync(indexPath, 'utf8');
      const exports = [
        ...source.matchAll(/export \{ default as (\w+) \} from '\.\/[\w.]+\.svelte'/g)
      ].map((m) => m[1]);
      if (exports.length > 0) groups.push({ name: entry.name, exports, kind });
    }
  }
  // System surfaces worth tracking alongside the component groups: the
  // provider, the dynamic <Icon name="…"> (expected heavy: full registry)
  // and one representative static icon (the tree-shaken per-icon cost).
  groups.push({ name: 'BlocksProvider', exports: ['BlocksProvider'], kind: 'system' });
  groups.push({ name: 'Icon', exports: ['Icon'], kind: 'system' });
  groups.push({ name: 'CheckIcon', exports: ['CheckIcon'], kind: 'system' });
  return groups;
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

function entryFor(exports: string[]): string {
  // console.log keeps the imports alive; app builds drop unused entry exports.
  return `import { ${exports.join(', ')} } from '@urbicon-ui/blocks';\nconsole.log(${exports.join(', ')});\n`;
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
  if (!existsSync(join(DIST, 'index.js'))) {
    console.error('dist/index.js missing — run `bun run build` in packages/blocks first.');
    process.exit(1);
  }

  const filters = (args.filter ?? []).flatMap((f) => f.split(',')).map((f) => f.toLowerCase());
  const concurrency = Math.max(1, Number.parseInt(args.concurrency ?? '4', 10) || 4);

  let groups = discoverGroups();
  if (filters.length > 0) {
    groups = groups.filter((g) => filters.some((f) => g.name.toLowerCase().includes(f)));
    if (groups.length === 0) {
      console.error(`No component group matches --filter ${filters.join(',')}`);
      process.exit(1);
    }
  }

  const started = performance.now();
  console.error(`Measuring ${groups.length} component groups (concurrency ${concurrency})…`);

  // The fixed floor every barrel import pays (side-effect modules only).
  const barrel = await measure(`import '@urbicon-ui/blocks';\n`, { dumpName: '__barrel__' });

  const measurements = await pool(groups, concurrency, async (group): Promise<Measurement> => {
    const size = await measure(entryFor(group.exports), { dumpName: group.name });
    console.error(
      `  ✓ ${pad(group.name, 16)} ${pad(kb(size.min), 9, true)} min  ${pad(kb(size.gz), 9, true)} gz`
    );
    return { name: group.name, kind: group.kind, exports: group.exports, ...size };
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
          barrel: { min: barrel.min, gz: barrel.gz },
          svelteRuntimeGz,
          components: sorted.map((m) => ({
            name: m.name,
            kind: m.kind,
            exports: m.exports,
            min: m.min,
            gz: m.gz,
            lazy: m.lazy,
            ...(args.breakdown ? { breakdown: Object.fromEntries(breakdownOf(m)) } : {})
          }))
        },
        null,
        2
      )
    );
  } else {
    // The net column only earns its place once the barrel floor is non-zero
    // (a side-effect module that every barrel import would pay for).
    const showNet = barrel.gz > 0;
    // Demand-loaded column only when some group actually splits off a chunk.
    const showLazy = sorted.some((m) => m.lazy.gz > 0);
    const nameWidth = Math.max(...sorted.map((m) => m.name.length), 9) + 2;
    const netHead = showNet ? ` ${pad('net gz*', 10, true)}` : '';
    const lazyHead = showLazy ? ` ${pad('lazy gz†', 10, true)}` : '';
    console.log('');
    console.log(
      `${pad('Component', nameWidth)} ${pad('min', 10, true)} ${pad('gzip', 10, true)}${netHead}${lazyHead} ${pad('Δ gz vs baseline', 18, true)}`
    );
    for (const m of sorted) {
      const netCol = showNet ? ` ${pad(kb(Math.max(0, m.gz - barrel.gz)), 10, true)}` : '';
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
        `${pad(m.name, nameWidth)} ${pad(kb(m.min), 10, true)} ${pad(kb(m.gz), 10, true)}${netCol}${lazyCol} ${pad(delta, 18, true)}`
      );
    }
    console.log('');
    console.log(
      `Barrel side-effect floor (bare \`import '@urbicon-ui/blocks'\`): ${kb(barrel.gz)} gz`
    );
    if (svelteRuntimeGz !== null) {
      console.log(`Svelte runtime (external, paid once per app): ~${kb(svelteRuntimeGz)} gz`);
    }
    if (showNet) {
      console.log(`* net gz ≈ gzip − barrel floor (gzip is not additive; approximation)`);
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
    // Uniform entry shape ({ min, gz, lazy }) for every row, __barrel__
    // included — no field beyond these three ever leaks into the baseline.
    const entry = (s: Size & { lazy?: Size }): Size & { lazy: Size } => ({
      min: s.min,
      gz: s.gz,
      lazy: { min: s.lazy?.min ?? 0, gz: s.lazy?.gz ?? 0 }
    });
    const sizes: Record<string, Size & { lazy: Size }> = {};
    // Full (unfiltered) runs replace the baseline; filtered runs patch into it.
    if (filters.length > 0 && baseline) {
      for (const [name, s] of Object.entries(baseline.sizes)) sizes[name] = entry(s);
    }
    sizes.__barrel__ = entry(barrel);
    for (const m of measurements) sizes[m.name] = entry(m);
    const next: Baseline = {
      note: 'Generated by scripts/bundle-size.ts (--update-baseline). Net-of-Svelte, minified; gz = gzip -9. min/gz cover initial (statically reachable) chunks; lazy = demand-loaded dynamic-import chunks, gated separately.',
      toolchain: { svelte: versionOf('svelte'), vite: versionOf('vite') },
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
