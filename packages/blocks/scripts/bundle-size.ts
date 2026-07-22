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
 *
 * The tool doubles as a tree-shaking regression guard: a component that starts
 * dragging the full icon registry (the `getIcon()` anti-pattern) or another
 * barrel jumps by an order of magnitude and fails `--check` immediately.
 * CSS is out of scope (Tailwind generates it consumer-side).
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
}

interface Baseline {
  note: string;
  toolchain: { svelte: string; vite: string };
  sizes: Record<string, Size>;
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
    dump: { type: 'string' }
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

// --- Measurement -------------------------------------------------------------

/** Build `code` as an app entry against the packaged library; sum minified JS bytes. */
async function measure(code: string, { bundleSvelte = false, dumpName = '' } = {}): Promise<Size> {
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
      rollupOptions: {
        input: VIRTUAL_ID,
        // Net-of-Svelte is the headline number: the runtime is shared across
        // the consumer's whole app, components should not be billed for it.
        external: [...(bundleSvelte ? [] : [/^svelte(\/|$)/]), /^@sveltejs\/kit(\/|$)/, /^\$app\//]
      }
    }
  });

  const outputs = Array.isArray(result) ? result : [result];
  let min = 0;
  let gz = 0;
  const chunks: string[] = [];
  for (const out of outputs) {
    if (!('output' in out)) continue;
    for (const item of out.output) {
      if (item.type !== 'chunk') continue; // CSS/assets: out of scope
      if (item.code.trim() === '') continue; // fully tree-shaken — no gzip-header phantom bytes
      min += Buffer.byteLength(item.code);
      gz += gzipSync(item.code, { level: 9 }).length;
      chunks.push(item.code);
    }
  }
  if (args.dump && dumpName) {
    mkdirSync(args.dump, { recursive: true });
    writeFileSync(join(args.dump, `${dumpName}.js`), chunks.join('\n// ---- next chunk ----\n'));
  }
  return { min, gz };
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
          barrel,
          svelteRuntimeGz,
          components: sorted
        },
        null,
        2
      )
    );
  } else {
    // The net column only earns its place once the barrel floor is non-zero
    // (a side-effect module that every barrel import would pay for).
    const showNet = barrel.gz > 0;
    const nameWidth = Math.max(...sorted.map((m) => m.name.length), 9) + 2;
    const netHead = showNet ? ` ${pad('net gz*', 10, true)}` : '';
    console.log('');
    console.log(
      `${pad('Component', nameWidth)} ${pad('min', 10, true)} ${pad('gzip', 10, true)}${netHead} ${pad('Δ gz vs baseline', 18, true)}`
    );
    for (const m of sorted) {
      const netCol = showNet ? ` ${pad(kb(Math.max(0, m.gz - barrel.gz)), 10, true)}` : '';
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
        `${pad(m.name, nameWidth)} ${pad(kb(m.min), 10, true)} ${pad(kb(m.gz), 10, true)}${netCol} ${pad(delta, 18, true)}`
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
    console.log(
      `Measured in ${seconds}s. Svelte ${versionOf('svelte')}, Vite ${versionOf('vite')}.`
    );
  }

  // --- Baseline handling -----------------------------------------------------

  if (args['update-baseline']) {
    const sizes: Record<string, Size> = { __barrel__: barrel };
    // Full (unfiltered) runs replace the baseline; filtered runs patch into it.
    if (filters.length > 0 && baseline)
      Object.assign(sizes, baseline.sizes, { __barrel__: barrel });
    for (const m of measurements) sizes[m.name] = { min: m.min, gz: m.gz };
    const next: Baseline = {
      note: 'Generated by scripts/bundle-size.ts (--update-baseline). Net-of-Svelte, minified; gz = gzip -9.',
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
