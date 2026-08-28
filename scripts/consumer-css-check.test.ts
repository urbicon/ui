import { afterEach, describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
 */

const trees: Tree[] = [];
async function tree(): Promise<Tree> {
  const t = await installTree();
  trees.push(t);
  return t;
}
afterEach(() => {
  for (const t of trees.splice(0)) rmSync(t.dir, { recursive: true, force: true });
});

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
 * The table classes the #314 finding listed as uncovered by `../variants` —
 * 16 of its 17. `overflow-x-hidden` is still in `TableDesktop.svelte`, but a
 * comment in `variants/table.system.js` names it since #312, and the scanner
 * reads prose like markup, so `../variants` covers it now. Tailwind's answer,
 * not the gate's.
 */
const TABLE_314 = [
  'table-fixed',
  'outline-primary',
  'outline-2',
  'outline-offset-[-2px]',
  'border-primary/20',
  'animate-ping',
  'bg-success-subtle/30',
  'transition-[box-shadow,background-color]',
  'duration-1000',
  'duration-(--blocks-duration-fast)',
  'bg-surface-elevated/50',
  'max-w-32',
  'min-w-24',
  'h-auto!',
  'aria-disabled:active:scale-100',
  'aria-disabled:active:shadow-none'
];

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

    const table = await auditPackage(t, 'table');
    expect(table.sources).toContain('node_modules/@urbicon-ui/table/dist/style/../variants');
    const reported = new Map(table.uncovered.map((f) => [f.cls, f.files]));
    for (const cls of TABLE_314) {
      expect(reported.has(cls), `${cls} must be reported`).toBe(true);
      expect(reported.get(cls)?.length, `${cls} must name its file`).toBeGreaterThan(0);
    }

    // blocks' half of the finding: the week-number grid in internal/, which
    // neither `../primitives` nor `../components` reaches.
    const blocks = await auditPackage(t, 'blocks');
    expect(blocks.uncovered.map((f) => f.cls)).toContain(
      'grid-cols-[minmax(2rem,auto)_repeat(7,minmax(0,1fr))]'
    );
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
});
