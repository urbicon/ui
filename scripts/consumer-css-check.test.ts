import { afterEach, describe, expect, it } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Scanner } from '@tailwindcss/oxide';
import { auditPackage, emitting, installTree, type Tree } from './consumer-css-check';

/**
 * Positive controls for the consumer-CSS gate, against its own oracle. The
 * gate's failure mode is silence — a scanner that reads nothing, a `@source`
 * that resolves to nowhere, or a filter that drops everything all print
 * "every shipped class covered" — so every block asserts both directions on
 * the same unpacked tree: the shipped state passes AND a reproduced defect is
 * reported by name and file.
 *
 * Each test packs its own tree (~0.7 s) rather than restoring a shared one;
 * the mutations below are what the tests are about.
 *
 * The last block is no control of this gate; its comment says why it lives here.
 */

const trees: Tree[] = [];
const scratch: string[] = [];
async function tree(): Promise<Tree> {
  const t = await installTree();
  trees.push(t);
  return t;
}
afterEach(() => {
  for (const t of trees.splice(0)) rmSync(t.dir, { recursive: true, force: true });
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * A `packages/` holding one package published outside `@urbicon-ui/`, the shape
 * of the `urbicon` bin shim: no place in the scoped tree, so `installTree` skips
 * it — unless it ships `.svelte`, whose classes no stylesheet would then compile
 * (case 1 of the gate's header) and which the skip would hide.
 */
function unscopedPackages(withSvelte: boolean): string {
  const packagesDir = mkdtempSync(join(tmpdir(), 'consumer-css-packages-'));
  scratch.push(packagesDir);
  const pkg = join(packagesDir, 'shim');
  mkdirSync(join(pkg, 'bin'), { recursive: true });
  writeFileSync(join(pkg, 'bin', 'x.js'), '');
  if (withSvelte) writeFileSync(join(pkg, 'a.svelte'), '<div class="bg-fuchsia-500"></div>\n');
  writeFileSync(
    join(pkg, 'package.json'),
    JSON.stringify({ name: 'unscoped-shim', version: '0.0.0', files: ['bin', 'a.svelte'] })
  );
  return packagesDir;
}

const stylesheetOf = (t: Tree, name: string) =>
  join(t.dir, 'node_modules', '@urbicon-ui', name, 'dist', 'style', 'index.css');

/** Rewrite one shipped stylesheet's `@source '..'` to `lines`, loudly. */
function rewriteSource(t: Tree, name: string, lines: string[]) {
  const path = stylesheetOf(t, name);
  const css = readFileSync(path, 'utf-8');
  const line = "@source '..';";
  if (!css.includes(line)) throw new Error(`${name}: stylesheet no longer declares ${line}`);
  writeFileSync(path, css.replace(line, lines.join('\n')));
}

/** The `@source` lines both packages shipped before #314. */
function restorePre314(t: Tree) {
  rewriteSource(t, 'table', ["@source '../variants';"]);
  rewriteSource(t, 'blocks', ["@source '../primitives';", "@source '../components';"]);
}

/**
 * Append a class to a shipped file, so the tree carries the case under test.
 *
 * One class per package, never a shared one: the consumer entry imports every
 * peer stylesheet, so a class planted in blocks is emitted for table's audit
 * too and the table half would pass or fail on a blocks edit.
 */
function plant(t: Tree, pkg: string, cls: string, ...segments: string[]): string {
  const file = join(t.dir, 'node_modules', '@urbicon-ui', pkg, 'dist', ...segments);
  writeFileSync(file, `${readFileSync(file, 'utf-8')}\n<div class="${cls}"></div>\n`);
  return `dist/${segments.join('/')}`;
}

describe('consumer-css-check', () => {
  it('reads every variants/ class as covered and a class absent from the repo as not', async () => {
    const t = await tree();
    const report = await auditPackage(t, 'table');
    expect(report.stylesheet).toBe(true);
    expect(report.sources).toContain('node_modules/@urbicon-ui/table/dist/style/..');

    // The classes the tv() configs hold, read by the same scanner the gate
    // uses — not a hand-picked pair that would still pass over an empty set.
    const variantsDir = join(t.dir, 'node_modules', '@urbicon-ui', 'table', 'dist', 'variants');
    const scanner = new Scanner({});
    const fromVariants = new Set<string>();
    for (const file of readdirSync(variantsDir).filter((f) => f.endsWith('.js'))) {
      const content = readFileSync(join(variantsDir, file), 'utf-8');
      for (const c of scanner.scanFiles([{ content, extension: 'js' }])) fromVariants.add(c);
    }
    const realClasses = await emitting(t, report.entry, [...fromVariants]);
    expect(realClasses.length).toBeGreaterThan(100);
    for (const cls of realClasses) expect(report.covered, `${cls} from variants/`).toContain(cls);

    // Absent from the repo, so nothing scans them — and each would emit a rule,
    // so the filter would keep them: the rig is not blanket-true.
    const absent = ['bg-fuchsia-500', 'border-separate', 'table-auto'];
    for (const cls of absent) expect(report.covered).not.toContain(cls);
    expect(await emitting(t, report.entry, absent)).toEqual(absent);
  });

  it('reports a class planted into shipped markup once the stylesheet stops reaching it', async () => {
    const t = await tree();
    const file = join(
      t.dir,
      'node_modules',
      '@urbicon-ui',
      'table',
      'dist',
      'core',
      'TableRow.svelte'
    );
    writeFileSync(file, `${readFileSync(file, 'utf-8')}\n<div class="bg-fuchsia-500"></div>\n`);

    // Shipped state: `@source '..'` covers the planted file by construction —
    // that is #314's fix — so the class is present, not uncovered.
    const shipped = await auditPackage(t, 'table');
    expect(shipped.present.get('bg-fuchsia-500')).toEqual(['dist/core/TableRow.svelte']);
    expect(shipped.uncovered.map((f) => f.cls)).not.toContain('bg-fuchsia-500');

    // Narrowed stylesheet: the same file falls outside the scan and the gate
    // names the class and the file.
    rewriteSource(t, 'table', ["@source '../variants';"]);
    const narrowed = await auditPackage(t, 'table');
    expect(narrowed.uncovered).toContainEqual({
      cls: 'bg-fuchsia-500',
      files: ['dist/core/TableRow.svelte']
    });
  });

  it('reproduces the #314 finding from the pre-#314 @source lines', async () => {
    const t = await tree();
    restorePre314(t);

    // #314 is a DIRECTORY property in both packages: the old `@source` lines
    // named some of each package's directories, so markup anywhere else
    // reached no scan. Both halves plant their own case rather than name
    // shipped classes — a class list goes red the day a refactor moves or
    // drops one of the names, which is a repair reported as a regression, and
    // it stops proving anything about the directory it came from.
    const inTableCore = plant(t, 'table', 'bg-fuchsia-500', 'core', 'TableRow.svelte');
    const inBlocksInternal = plant(
      t,
      'blocks',
      'bg-lime-400',
      'internal',
      'core',
      'CoreSpinner.svelte'
    );

    const table = await auditPackage(t, 'table');
    expect(table.sources).toContain('node_modules/@urbicon-ui/table/dist/style/../variants');
    expect(table.uncovered).toContainEqual({ cls: 'bg-fuchsia-500', files: [inTableCore] });

    const blocks = await auditPackage(t, 'blocks');
    expect(blocks.uncovered).toContainEqual({ cls: 'bg-lime-400', files: [inBlocksInternal] });

    // And the shipped markup outside those directories is reported the same
    // way, by class and by file — the half that would go silent if the audit
    // only ever saw what this test plants. Measured 2026-08: table 16
    // findings over 7 files, blocks 2 (`[animation-duration:1s]` in
    // internal/core, `isolate` in system/attachments).
    const planted = new Set(['bg-fuchsia-500', 'bg-lime-400']);
    for (const report of [table, blocks]) {
      const shipped = report.uncovered.filter((f) => !planted.has(f.cls));
      expect(shipped.length, `${report.name} reports only what the test planted`).toBeGreaterThan(
        0
      );
      for (const finding of shipped) {
        expect(finding.files.length, `${finding.cls} must name its file`).toBeGreaterThan(0);
      }
    }
  });

  it('reports a package that ships styled markup but exports no stylesheet', async () => {
    const t = await tree();
    const manifestPath = join(t.dir, 'node_modules', '@urbicon-ui', 'table', 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    delete manifest.exports['./style/index.css'];
    writeFileSync(manifestPath, JSON.stringify(manifest));

    // The entry is what a consumer of such a package can import: its peers'
    // stylesheets, which scan only their own dist.
    const report = await auditPackage(t, 'table');
    expect(report.stylesheet).toBe(false);
    expect(report.entry).toContain("@import '@urbicon-ui/blocks/style/index.css';");
    expect(report.entry).not.toContain('@urbicon-ui/table');
    expect(report.uncovered.map((f) => f.cls)).toContain('table-fixed');

    // And the other direction: markup without a single class needs no
    // stylesheet, and is not reported for lacking one.
    const i18n = await auditPackage(t, 'i18n');
    expect(i18n.stylesheet).toBe(false);
    expect(i18n.files).toBeGreaterThan(0);
    expect(i18n.uncovered).toEqual([]);
  });

  it('refuses an unscoped package that ships .svelte, by name', async () => {
    const at = mkdtempSync(join(tmpdir(), 'consumer-css-'));
    scratch.push(at);
    await expect(installTree(at, unscopedPackages(true))).rejects.toThrow(
      'shim ships .svelte outside @urbicon-ui/: unscoped-shim'
    );
  });

  it('skips an unscoped package that ships none', async () => {
    const at = mkdtempSync(join(tmpdir(), 'consumer-css-'));
    scratch.push(at);
    const t = await installTree(at, unscopedPackages(false));
    expect(t.installed).toEqual([]);
    expect(t.audited).toEqual([]);
  });
});

/**
 * Not a control of the CSS gate: the one check here that runs the shipped
 * JavaScript. It needs what the gate needs — the packed tarballs, installed —
 * and this is where that tree is built and CI already runs it after the build.
 *
 * A tool handler or a `bun test` suite imports the A2UI engine without the
 * Svelte compiler, so the subpath must load in plain Bun and Node. The package
 * root cannot (it evaluates runes modules and `.svelte` files on import), and
 * the probe has to see that, or a probe that never reached the import would
 * pass too: same tree, same probe, with `svelte` resolvable, so the root fails
 * for the Svelte reason and not for a missing package.
 */
describe('@urbicon-ui/blocks/a2ui without the Svelte compiler', () => {
  const PROBE = [
    'const m = await import(process.argv[2]);',
    'const prompt = `${m.a2uiSystemPrompt()}\\n\\n${m.a2uiMcpAppTransportSection()}`;',
    'const issues = m.validateA2uiPayload({ messages: [',
    "  { version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: 'x' } }",
    ']});',
    'const payload = new m.A2uiToolInputStabilizer().complete({ messages: [] });',
    'console.log(JSON.stringify({ prompt: prompt.length, codes: issues.map((i) => i.code), payload }));'
  ].join('\n');
  const RUNTIMES = [process.execPath, 'node'];

  function run(t: Tree, runtime: string, specifier: string) {
    const probe = join(t.dir, 'probe.mjs');
    writeFileSync(probe, PROBE);
    const result = Bun.spawnSync([runtime, probe, specifier], { cwd: t.dir });
    return {
      code: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString()
    };
  }

  it('loads and runs the subpath from the tarball; the package root does not load', async () => {
    const t = await tree();

    // No `svelte` in the tree yet: the subpath imports none of it.
    for (const runtime of RUNTIMES) {
      const { code, stdout, stderr } = run(t, runtime, '@urbicon-ui/blocks/a2ui');
      expect(code, `${runtime}: ${stderr}`).toBe(0);
      const out = JSON.parse(stdout);
      expect(out.prompt).toBeGreaterThan(10_000);
      expect(out.codes).toEqual(['MISSING_ROOT']);
      expect(out.payload).toEqual([]);
    }

    const svelte = dirname(createRequire(import.meta.url).resolve('svelte/package.json'));
    symlinkSync(svelte, join(t.dir, 'node_modules', 'svelte'));
    for (const runtime of RUNTIMES) {
      const { code, stderr } = run(t, runtime, '@urbicon-ui/blocks');
      expect(code, runtime).not.toBe(0);
      expect(stderr, runtime).toMatch(/\$state is not defined|Unknown file extension "\.svelte"/);
    }
  });
});
