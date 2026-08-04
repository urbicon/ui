#!/usr/bin/env bun
/**
 * icons-lint — enforces the Urbicon UI icon design language.
 *
 * The hard, machine-checkable invariants from docs/ICON-DESIGN.md live here.
 * Errors fail the build (exit 1); warnings surface judgement calls (off-grid
 * organic paths, dense paths) and only fail under `--strict`.
 *
 * Run: `bun run icons:lint`  ·  strict: `bun run icons:lint --strict`
 *
 * Scope: every `*.svg` in packages/blocks/src/lib/icons/svg/ plus the
 * registry integrity that keeps an icon reachable (svg ↔ .svelte ↔
 * DEFAULT_ICONS ↔ ICON_METADATA ↔ IconName ↔ index.ts export).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m'
};

const ICONS_DIR = join(import.meta.dir, '../src/lib/icons');
const SVG_DIR = join(ICONS_DIR, 'svg');

// ── Design-language constants (single source of truth, mirrored in the spec) ──
const REQUIRED_ROOT: ReadonlyArray<readonly [string, RegExp]> = [
  ['viewBox', /viewBox="0 0 24 24"/],
  ['fill', /fill="none"/],
  ['stroke', /stroke="currentColor"/],
  ['stroke-width', /stroke-width="2"/],
  ['stroke-linecap', /stroke-linecap="round"/],
  ['stroke-linejoin', /stroke-linejoin="round"/],
  ['xmlns', /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/]
];
const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'g']);
const RECT_RADII = new Set([0, 0.5, 1.5, 2.5]); // discrete container steps; plus capsule = short/2
const AXIS_ATTRS = [
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height'
];
const POINT_BUDGET = 20; // coordinate pairs in a single <path d>; gears etc. may exceed (warn)
const GRID = 0.5;
const CAPSULE_TOLERANCE = 0.06;

// Pre-compiled regexes (hoisted out of hot loops).
const RE_SVG_OPEN = /<svg[^>]*>/;
const RE_SVG_CLOSE = /<\/svg>\s*$/;
const RE_ELEMENT = /<([a-zA-Z]+)([^>]*?)\/?>/g;
const RE_ATTR = /([a-zA-Z][\w-]*)="([^"]*)"/g;
const RE_PATH_D = /\bd="([^"]*)"/g;
const RE_NUM = /-?\d*\.?\d+/g;
const RE_SPACED_CMD_A = /[A-Za-z]\s+-?\d/;
const RE_SPACED_CMD_B = /\s[A-Za-z]\s/;
const RE_DEFAULT_BLOCK = /DEFAULT_ICONS:\s*IconSet\s*=\s*\{([\s\S]*?)\n\};/;
const RE_META_BLOCK = /ICON_METADATA:[^=]*=\s*\{([\s\S]*)\n\};/;
const RE_DEFAULT_ENTRY = /^ {2}([a-zA-Z][a-zA-Z0-9]*):\s*(\w+Icon)\b/gm;
const RE_META_KEY = /^ {2}([a-zA-Z][a-zA-Z0-9]*):\s*\{/gm;
const RE_UNION_BLOCK = /export type IconName\s*=([\s\S]*?);/;
const RE_QUOTED = /'([a-zA-Z][a-zA-Z0-9]*)'/g;
const RE_EXPORT = /export \{ default as (\w+Icon) \}/g;

const onGrid = (n: number): boolean => Number.isInteger(n / GRID);
const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
const camelToPascal = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const parseAttrs = (s: string): Map<string, string> => {
  const map = new Map<string, string>();
  for (const a of s.matchAll(RE_ATTR)) map.set(a[1], a[2]);
  return map;
};

type Finding = { icon: string; rule: string; detail: string };
const errors: Finding[] = [];
const warns: Finding[] = [];
const err = (icon: string, rule: string, detail: string): void => {
  errors.push({ icon, rule, detail });
};
const warn = (icon: string, rule: string, detail: string): void => {
  warns.push({ icon, rule, detail });
};

// ── Per-file geometry checks ─────────────────────────────────────────────────
function lintSvg(file: string, raw: string): void {
  const icon = file.replace('.svg', '');
  const root = raw.match(RE_SVG_OPEN)?.[0] ?? '';
  for (const [name, re] of REQUIRED_ROOT) {
    if (!re.test(root)) err(icon, 'root-attr', `<svg> is missing or wrong: ${name}`);
  }

  const body = raw.replace(RE_SVG_OPEN, '').replace(RE_SVG_CLOSE, '');

  for (const m of body.matchAll(RE_ELEMENT)) {
    const tag = m[1];
    if (tag === 'svg') continue;
    if (!ALLOWED_TAGS.has(tag)) {
      warn(icon, 'element', `unusual element <${tag}> — prefer path/circle/rect/line`);
      continue;
    }
    const attrs = parseAttrs(m[2]);

    if (tag === 'g') {
      // grouping is only for a local transform (e.g. ruler's rotate); no styling
      if (!attrs.has('transform')) warn(icon, 'group', '<g> without transform — flatten it');
      if (attrs.has('fill') || attrs.has('stroke') || attrs.has('stroke-width'))
        err(icon, 'group', '<g> must not carry style');
      continue;
    }

    const fill = attrs.get('fill');
    if (fill && fill !== 'none')
      err(icon, 'fill', `<${tag}> uses fill="${fill}" — icons are pure stroke`);
    if (attrs.has('stroke'))
      err(icon, 'stroke', `<${tag}> overrides stroke — must inherit currentColor`);
    if (attrs.has('stroke-width'))
      err(icon, 'stroke-width', `<${tag}> overrides stroke-width — must inherit 2`);

    // axis-aligned coordinates must sit on the 0.5 grid
    for (const a of AXIS_ATTRS) {
      const v = attrs.get(a);
      if (v !== undefined && Number.isFinite(Number(v)) && !onGrid(Number(v)))
        err(icon, 'grid', `<${tag} ${a}="${v}"> is off the 0.5 grid`);
    }

    // rect corner radius: discrete step or capsule (short/2)
    if (tag === 'rect' && attrs.has('rx')) {
      const w = Number(attrs.get('width') ?? Number.NaN);
      const h = Number(attrs.get('height') ?? Number.NaN);
      const r = Number(attrs.get('rx'));
      const capsule = Number.isFinite(w) && Number.isFinite(h) ? Math.min(w, h) / 2 : Number.NaN;
      const ok =
        RECT_RADII.has(r) ||
        (Number.isFinite(capsule) && Math.abs(r - capsule) < CAPSULE_TOLERANCE);
      if (!ok)
        err(
          icon,
          'rx',
          `rect rx="${r}" on ${w}×${h} — use {0.5, 1.5, 2.5} (by size) or capsule rx=${capsule}`
        );
    }
  }

  // Path-level checks (warnings — organic shapes legitimately bend these)
  for (const d of body.matchAll(RE_PATH_D)) {
    const dStr = d[1];
    const nums = dStr.match(RE_NUM) ?? [];
    const pairs = Math.round(nums.length / 2);
    if (pairs > POINT_BUDGET)
      warn(icon, 'dense-path', `~${pairs} coordinate pairs in one path (>${POINT_BUDGET})`);
    if (RE_SPACED_CMD_A.test(dStr) || RE_SPACED_CMD_B.test(dStr))
      warn(icon, 'notation', 'spaced path command (e.g. "C 9 7") — prefer compact "C9 7"');
    // off-grid numbers in a path: tolerate the `.01` dot idiom; flag the rest
    const offGrid = [...new Set(nums.map(Number))].filter(
      (n) => Number.isFinite(n) && !onGrid(n) && Math.abs(n) !== 0.01
    );
    if (offGrid.length) warn(icon, 'grid-path', `off-grid path numbers: ${offGrid.join(' ')}`);
  }
}

// ── Cross-file registry integrity ────────────────────────────────────────────
// The chain that keeps an icon reachable is: svg ↔ <Name>Icon.svelte (which must
// import that svg) ↔ index.ts export ↔ a DEFAULT_ICONS value. The DEFAULT_ICONS
// *key* is the semantic IconName and may be an alias (e.g. `info: InfoCircleIcon`
// → info-circle.svg), so the registry is verified through the component, never by
// assuming key === filename. Keys must stay symmetric across the three tables.
function lintRegistry(svgNames: string[]): void {
  // Since the icon module split: DEFAULT_ICONS + ICON_METADATA live in
  // icon-registry.ts, the IconName union in icon-types.ts.
  const registry = readFileSync(join(ICONS_DIR, 'icon-registry.ts'), 'utf8');
  const types = readFileSync(join(ICONS_DIR, 'icon-types.ts'), 'utf8');
  const index = readFileSync(join(ICONS_DIR, 'index.ts'), 'utf8');

  const defaultBlock = registry.match(RE_DEFAULT_BLOCK)?.[1] ?? '';
  const metaBlock = registry.match(RE_META_BLOCK)?.[1] ?? '';
  const unionBlock = types.match(RE_UNION_BLOCK)?.[1] ?? '';
  const defaultMap = new Map(
    [...defaultBlock.matchAll(RE_DEFAULT_ENTRY)].map((m): [string, string] => [m[1], m[2]])
  );
  const metaKeys = new Set([...metaBlock.matchAll(RE_META_KEY)].map((m) => m[1]));
  const unionKeys = new Set([...unionBlock.matchAll(RE_QUOTED)].map((m) => m[1]));
  const exported = new Set([...index.matchAll(RE_EXPORT)].map((m) => m[1]));
  const referencedComponents = new Set(defaultMap.values());

  // 1) svg ↔ component file (must exist and import its own svg)
  for (const f of svgNames) {
    const kebab = f.replace('.svg', '');
    const pascal = `${camelToPascal(kebabToCamel(kebab))}Icon`;
    const sveltePath = join(ICONS_DIR, `${pascal}.svelte`);
    if (!existsSync(sveltePath)) {
      err(kebab, 'registry', `missing component ${pascal}.svelte`);
      continue;
    }
    const svelte = readFileSync(sveltePath, 'utf8');
    if (!svelte.includes(`./svg/${kebab}.svg?raw`))
      err(kebab, 'registry', `${pascal}.svelte does not import ./svg/${kebab}.svg?raw`);
    if (!exported.has(pascal)) err(kebab, 'registry', `${pascal} not exported from index.ts`);
    if (!referencedComponents.has(pascal))
      err(kebab, 'registry', `${pascal} unreachable — not a DEFAULT_ICONS value`);
  }

  // 2) three-way key symmetry: DEFAULT_ICONS ↔ ICON_METADATA ↔ IconName union
  const defaultKeys = new Set(defaultMap.keys());
  const sym = (a: Set<string>, an: string, b: Set<string>, bn: string): void => {
    for (const k of a) if (!b.has(k)) err(k, 'registry', `key in ${an} but missing from ${bn}`);
  };
  sym(defaultKeys, 'DEFAULT_ICONS', metaKeys, 'ICON_METADATA');
  sym(metaKeys, 'ICON_METADATA', defaultKeys, 'DEFAULT_ICONS');
  sym(defaultKeys, 'DEFAULT_ICONS', unionKeys, 'IconName');
  sym(unionKeys, 'IconName', defaultKeys, 'DEFAULT_ICONS');
}

// ── Documented counts ────────────────────────────────────────────────────────
/**
 * Four docs quote the set's size as information a reader acts on (how big is
 * this set / how far did it grow). Everywhere else the number was decoration —
 * "drags all N icons into the bundle" says nothing "the whole set" doesn't — and
 * those copies were deleted rather than maintained, because a number that no one
 * reads is a number that only goes stale.
 *
 * These four stay, bound to the count this linter already has in hand. That is
 * the whole justification for the check: it asks no new oracle and re-implements
 * no parser — it compares a prose claim against the directory it is a claim
 * about. A pattern that stops matching is an error too, so rewording the
 * sentence can't silently detach it from the truth.
 *
 * Deliberately absent: ICON-DESIGN.md's "315 icons when that measurement was
 * taken" — a historical statement about a past measurement, which must NOT track
 * the current count.
 */
const REPO_ROOT = join(import.meta.dir, '../../..');
const COUNT_CLAIMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['packages/blocks/README.md', /(\d+) hand-rolled SVG icons/],
  ['docs/ARCHITECTURE.md', /icon set \((\d+) icons\)/],
  ['docs/README.md', /how the set grew from 156 to (\d+)/],
  ['docs/ICON-ROADMAP.md', /\*\*156 icons to the current set of (\d+)\*\*/]
];

function lintDocumentedCounts(actual: number): void {
  for (const [file, re] of COUNT_CLAIMS) {
    const path = join(REPO_ROOT, file);
    if (!existsSync(path)) {
      err(file, 'count-claim', 'file listed in COUNT_CLAIMS does not exist');
      continue;
    }
    const match = readFileSync(path, 'utf8').match(re);
    if (!match) {
      err(file, 'count-claim', `no icon-count claim matching ${re} — entry is stale`);
      continue;
    }
    if (Number(match[1]) !== actual) {
      err(file, 'count-claim', `claims ${match[1]} icons, the set has ${actual}`);
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
const groupByIcon = (findings: Finding[]): Map<string, Finding[]> => {
  const byIcon = new Map<string, Finding[]>();
  for (const f of findings) {
    const bucket = byIcon.get(f.icon);
    if (bucket) bucket.push(f);
    else byIcon.set(f.icon, [f]);
  }
  return byIcon;
};

const printGroup = (findings: Finding[], colour: string): void => {
  for (const [icon, fs] of groupByIcon(findings)) {
    console.log(`  ${colour}${icon}${c.reset}`);
    for (const f of fs) console.log(`    ${c.gray}${f.rule}:${c.reset} ${f.detail}`);
  }
};

// ── Run ──────────────────────────────────────────────────────────────────────
const strict = process.argv.includes('--strict');
const svgFiles = readdirSync(SVG_DIR)
  .filter((f) => f.endsWith('.svg'))
  .sort();

for (const f of svgFiles) lintSvg(f, readFileSync(join(SVG_DIR, f), 'utf8'));
lintRegistry(svgFiles);
lintDocumentedCounts(svgFiles.length);

console.log(`\n${c.bold}icons-lint${c.reset} ${c.gray}· ${svgFiles.length} icons${c.reset}\n`);

if (warns.length) {
  console.log(
    `${c.yellow}${c.bold}Warnings (${warns.length})${c.reset} ${c.gray}— judgement calls${c.reset}`
  );
  printGroup(warns, c.yellow);
  console.log('');
}

if (errors.length) {
  console.log(`${c.red}${c.bold}Errors (${errors.length})${c.reset} ${c.gray}— must fix${c.reset}`);
  printGroup(errors, c.red);
  console.log(`\n${c.red}✖ ${errors.length} error(s)${c.reset}\n`);
  process.exit(1);
}

if (strict && warns.length) {
  console.log(`${c.red}✖ ${warns.length} warning(s) under --strict${c.reset}\n`);
  process.exit(1);
}

const tail = warns.length ? `${c.gray} (${warns.length} warnings)${c.reset}` : '';
console.log(`${c.green}✓ all ${svgFiles.length} icons conform${c.reset}${tail}\n`);
