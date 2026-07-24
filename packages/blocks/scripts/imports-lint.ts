#!/usr/bin/env bun
/**
 * imports-lint — guards cross-component imports inside blocks.
 *
 * Rule: a public component (a directory under src/lib/primitives/<Name>/ or
 * src/lib/components/<Name>/) must not import a Svelte component from ANOTHER
 * public component directory unless the edge is listed in the ALLOWLIST below,
 * each entry with a one-line justification. Every NEW edge is therefore a
 * deliberate, justified decision instead of a silent bundle regression.
 *
 * What counts as an edge (and what does not):
 *   - direct relative imports (`../Button/Button.svelte`, `{ Collapsible } from
 *     '../Collapsible'`) and barrel imports (`{ Button } from '$lib'` /
 *     '$lib/primitives' / '..' / '../..') whose imported names are public
 *     PascalCase components — variants functions, contexts and other
 *     lowercase exports never count.
 *   - NOT an edge: imports within the same component directory (Menu →
 *     MenuItem), icon imports ($lib/icons/*, names ending in `Icon`),
 *     type-only imports, `__fixtures__/` + `*.test.*` files, and anything
 *     under src/lib/internal/** (extraction target — always allowed).
 *
 * A non-allowlisted edge and a stale allowlist entry (edge no longer in the
 * code) are both errors (exit 1) — the stale check forces the list to shrink
 * as edges disappear.
 *
 * The core-extraction wave onto src/lib/internal/core/* has landed: trivial
 * embedded controls (close ×, remove ×, loading spinners, unstyled nav
 * buttons) now compose CoreIconButton/CoreSpinner instead of a public
 * component. Every remaining entry below is a deliberate long-term
 * composition (is-a relationships, overlay surfaces, real styled variants);
 * the list may still SHRINK, never grow silently.
 *
 * Run: `bun run imports:lint`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

// ── Allowlist — every entry is a deliberate, justified cross-component edge ──
const ALLOWLIST: ReadonlyArray<readonly [edge: string, why: string]> = [
  // primitives → primitives
  // (Button→Spinner, Badge→Button, Dialog→Button, Drawer→Button, Toaster→Spinner
  //  removed: their embedded spinner / close-× / remove-× now compose the
  //  behaviour-only cores in src/lib/internal/core/* instead of a public
  //  component — see that dir.)
  ['PaginationItem -> Button', 'is-a button — props forwarded'],
  ['Menu -> Button', 'default trigger when none is provided'],
  ['Menu -> Popover', 'positioning surface for the menu list'],
  ['ConfirmDialog -> Dialog', 'essential composition — a confirm IS a dialog'],
  ['ConfirmDialog -> Button', 'essential composition — confirm/cancel actions'],
  ['AccordionItem -> Collapsible', 'expand/collapse mechanics'],
  // components → primitives/components
  ['CurrencyInput -> Input', 'is-an input with currency formatting'],
  ['NumberInput -> Input', 'is-an input with number semantics'],
  ['CopyButton -> Button', 'is-a button that copies text to the clipboard'],
  ['AvatarGroup -> Avatar', 'stacks the avatars (+ overflow chip) it composes'],
  ['DatePicker -> Input', 'text entry field for the picked date'],
  ['DatePicker -> Popover', 'calendar overlay surface'],
  ['DatePicker -> Calendar', 'date grid inside the popover'],
  ['DateRangePicker -> Input', 'text entry field for the picked range'],
  ['DateRangePicker -> Popover', 'calendar overlay surface'],
  ['DateRangePicker -> Calendar', 'date grid inside the popover'],
  ['CommandPalette -> Dialog', 'modal shell'],
  ['CommandPalette -> Separator', 'divider between result groups'],
  ['SidebarLayout -> Sidebar', 'the layout arranges the sidebar'],
  ['LocaleSwitcher -> Select', 'is-a select over the available locales'],
  // (FileUpload→Spinner, PlannerHeader→Button, CalendarHeader→Button,
  //  CalendarMiniMonth→Button removed: nav buttons / busy spinners now compose
  //  the internal cores — see src/lib/internal/core/.)
  ['FileUpload -> Progress', 'per-file upload progress'],
  ['PlannerHeader -> Tooltip', 'nav button hints'],
  ['Guide -> Button', 'panel action buttons'],
  ['CalendarHeader -> Tooltip', 'nav button hints'],
  ['CalendarHeader -> Popover', 'view/date picker overlay'],
  ['CalendarHeader -> SegmentGroup', 'view switcher'],
  ['CalendarHeader -> SegmentItem', 'view switcher items'],
  ['CalendarEventItem -> Badge', 'event chip'],
  ['CalendarDayView -> Badge', 'event chip'],
  ['CalendarDay -> Popover', 'day-cell overflow overlay'],
  ['CalendarTimeEvent -> Popover', 'event details overlay'],
  ['CalendarEventList -> Button', 'deliberate text-variant Button — stays public'],
  ['AreaChart -> ChartFrame', 'shared chart chrome (frame, axes, legend)'],
  ['LineChart -> ChartFrame', 'shared chart chrome (frame, axes, legend)'],
  ['BarChart -> ChartFrame', 'shared chart chrome (frame, axes, legend)'],
  // Chat family → outside components (family-internal imports — ChatMessage →
  // StreamingMarkdown, MdBlock → CodeBlock … — are same-dir, never edges)
  ['ChatMessage -> Alert', 'error/aborted surface with retry action'],
  ['ChatMessage -> Avatar', 'role avatar in the bubble layout'],
  ['ChatMessage -> Button', 'deliberate text-variant retry Button — stays public'],
  ['ChatMessage -> Skeleton', 'streaming placeholder before the first tokens'],
  ['ChatMessage -> Tooltip', 'copy/regenerate action hints'],
  ['ChatMessageList -> Badge', 'new-message counter on the jump pill'],
  ['ChatMessageList -> EmptyState', 'default empty-conversation state'],
  ['CitationChip -> Popover', 'citation details overlay surface'],
  ['ReasoningDisclosure -> Collapsible', 'expand/collapse mechanics'],
  ['ToolCallCard -> Collapsible', 'expand/collapse mechanics (card variant)'],
  ['ToolCallCard -> Badge', 'tool status badge — real styled intent variants'],
  // A2UIView dispatcher — essential composition, renders the trusted A2UI catalog
  ['A2UINode -> Button', 'essential composition — renders the trusted catalog (Button)'],
  ['A2UINode -> Card', 'essential composition — renders the trusted catalog (Card)'],
  ['A2UINode -> Checkbox', 'essential composition — renders the trusted catalog (CheckBox)'],
  ['A2UINode -> DatePicker', 'essential composition — renders the trusted catalog (DateTimeInput)'],
  ['A2UINode -> Input', 'essential composition — renders the trusted catalog (TextField)'],
  ['A2UINode -> RadioGroup', 'essential composition — renders the trusted catalog (ChoicePicker)'],
  ['A2UINode -> RadioItem', 'essential composition — renders the trusted catalog (ChoicePicker)'],
  ['A2UINode -> Separator', 'essential composition — renders the trusted catalog (Divider)'],
  ['A2UINode -> Skeleton', 'essential composition — streaming placeholder for pending refs'],
  ['A2UINode -> Slider', 'essential composition — renders the trusted catalog (Slider)'],
  ['A2UINode -> TimeInput', 'essential composition — renders the trusted catalog (DateTimeInput)'],
  [
    'A2UINode -> Textarea',
    'essential composition — renders the trusted catalog (TextField longText)'
  ],
  ['A2UIView -> Alert', 'envelope-level error summary surface']
];

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

const PKG = resolve(import.meta.dir, '..');
const LIB = join(PKG, 'src/lib');
const GROUPS = ['primitives', 'components'] as const;

// Sanity floors — a collapse means directory/glob drift, not a clean run.
// Kept close to the actual counts (58/104/~255 at calibration): a regression
// to the pre-family flat scanner would drop ~40 family-subdir files, which a
// loose floor would silently accept (review finding, P3 wave). Raise these as
// the library grows.
const MIN_DIRS = 55;
const MIN_PUBLIC = 95;
const MIN_FILES = 230;

const HINT = 'compose via src/lib/internal/core/* or add an allowlist entry with justification';

type Finding = { where: string; detail: string };
const errors: Finding[] = [];

// ── Public component set: dir names + their index.ts `default as` exports ────
const RE_DEFAULT_AS = /export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*'\.\/[\w.-]+\.svelte'/g;

/** component name → owning dir id ('primitives/Button'). */
const publicOwner = new Map<string, string>();
/** dir id → set of files to scan. */
const dirFiles = new Map<string, string[]>();

/**
 * All scannable source files under a component dir, family subdirs included.
 * Skips fixtures plus locally generated trees (nested node_modules /
 * .svelte-kit from per-package tooling runs) — those are git-ignored, so
 * scanning them would make filesScanned machine-dependent and open a latent
 * phantom-edge surface (review finding, P3 wave).
 */
function collectComponentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== '__fixtures__' && entry !== 'node_modules' && !entry.startsWith('.')) {
        out.push(...collectComponentFiles(p));
      }
    } else if (
      (entry.endsWith('.svelte') || entry.endsWith('.ts')) &&
      !entry.includes('.test.') &&
      !entry.includes('.spec.')
    ) {
      out.push(p);
    }
  }
  return out;
}

for (const group of GROUPS) {
  const groupDir = join(LIB, group);
  for (const entry of readdirSync(groupDir).sort()) {
    const dirPath = join(groupDir, entry);
    if (!statSync(dirPath).isDirectory() || entry === '__fixtures__') continue;
    const dirId = `${group}/${entry}`;
    const files = collectComponentFiles(dirPath);
    dirFiles.set(dirId, files);
    publicOwner.set(entry, dirId);
    // Family dirs (Chat/ChatMessage/…) nest member components one level down.
    // Every index.ts in the tree contributes its `default as` names and each
    // PascalCase subdirectory names a member — all owned by the SAME dir id,
    // so family-internal imports are never edges, while a member's import of
    // an outside component still is.
    for (const file of files) {
      if (basename(file) !== 'index.ts') continue;
      const index = readFileSync(file, 'utf8');
      for (const m of index.matchAll(RE_DEFAULT_AS)) publicOwner.set(m[1], dirId);
    }
    // Register every PascalCase directory segment on the collected paths (any
    // depth), so a member without its own `default as` export still resolves
    // to the family for bare-name barrel imports.
    for (const file of files) {
      for (const seg of relative(dirPath, dirname(file)).split('/')) {
        if (/^[A-Z]/.test(seg)) publicOwner.set(seg, dirId);
      }
    }
  }
}

// ── Import scanning ──────────────────────────────────────────────────────────
// Comments are blanked (newline-preserving) so commented-out imports don't
// register. The clause may not contain quotes/semicolons, which keeps the
// non-greedy match from swallowing unrelated code.
const RE_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const RE_LINE_COMMENT = /\/\/[^\n]*/g;
const RE_STATEMENT = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?([^'";]*?)\s+from\s+'([^']+)'/g;

const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Original (pre-`as`) non-type names of a `{ … }` named-import clause. */
function namedOriginals(braced: string): string[] {
  return braced
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('type '))
    .map((s) => s.split(/\s+as\s+/)[0].trim())
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
}

type Edge = { source: string; target: string; where: string };
const edges: Edge[] = [];
let filesScanned = 0;

for (const [dirId, files] of dirFiles) {
  for (const file of files) {
    filesScanned++;
    const raw = readFileSync(file, 'utf8');
    const text = raw.replace(RE_BLOCK_COMMENT, blank).replace(RE_LINE_COMMENT, blank);
    const sourceName = basename(file).replace(/\.(svelte|ts)$/, '');

    for (const m of text.matchAll(RE_STATEMENT)) {
      const [, keyword, typeOnly, clause, spec] = m;
      if (typeOnly) continue; // (c) type-only imports never count
      // the match starts at the preceding newline/';' — locate the keyword itself
      const at = (m.index ?? 0) + m[0].indexOf(keyword);
      const where = `${relative(PKG, file)}:${lineOf(text, at)}`;

      // Resolve the specifier to a path under src/lib (or skip externals).
      let target: string;
      if (spec === '$lib') target = LIB;
      else if (spec.startsWith('$lib/')) target = join(LIB, spec.slice('$lib/'.length));
      else if (spec.startsWith('.')) target = resolve(dirname(file), spec);
      else continue; // bare module specifier — external
      const rel = relative(LIB, target).replaceAll('\\', '/');
      if (rel.startsWith('..')) continue; // escaped src/lib

      // (f) internal is the extraction target — always allowed. (b) icons too.
      if (rel === 'internal' || rel.startsWith('internal/')) continue;
      if (rel === 'icons' || rel.startsWith('icons/')) continue;

      const componentPath = rel.match(/^(primitives|components)\/([^/]+)(?:\/(.*))?$/);
      const isGlobalBarrel = rel === '' || rel === 'index' || rel === 'index.ts';
      const isGroupBarrel = /^(primitives|components)(\/index(\.ts)?)?$/.test(rel);

      if (componentPath && !isGroupBarrel) {
        const [, group, dirName, sub] = componentPath;
        const targetDirId = `${group}/${dirName}`;
        if (targetDirId === dirId) continue; // (a) same component directory
        if (sub?.endsWith('.svelte')) {
          // Direct file import of a component from another public directory.
          edges.push({ source: sourceName, target: basename(sub, '.svelte'), where });
          continue;
        }
        // Directory barrel / .ts module of another component directory:
        // only public PascalCase components count (d) — never variants/contexts.
        collectNamedEdges(clause, sourceName, dirId, where);
      } else if (isGlobalBarrel || isGroupBarrel) {
        collectNamedEdges(clause, sourceName, dirId, where);
      }
      // everything else under src/lib (utils, provider, style, date, …) — no edge
    }
  }
}

function collectNamedEdges(
  clause: string,
  source: string,
  sourceDirId: string,
  where: string
): void {
  if (/(^|\s)\*/.test(clause)) {
    errors.push({
      where,
      detail: `namespace import/re-export from a component barrel defeats the guard — import names explicitly`
    });
    return;
  }
  const braced = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
  for (const name of namedOriginals(braced)) {
    if (name.endsWith('Icon')) continue; // (b) icons
    const owner = publicOwner.get(name);
    if (owner === undefined) continue; // (d) not a public component export
    if (owner === sourceDirId) continue; // (a) own barrel round-trip
    edges.push({ source, target: name, where });
  }
}

// ── Sanity floors ────────────────────────────────────────────────────────────
if (dirFiles.size < MIN_DIRS || publicOwner.size < MIN_PUBLIC || filesScanned < MIN_FILES) {
  console.error(
    `✖ imports-lint scanned ${dirFiles.size} dirs / ${publicOwner.size} public names / ${filesScanned} files ` +
      `(floors: ${MIN_DIRS}/${MIN_PUBLIC}/${MIN_FILES}) — directory or parser drift, the guard would run blind.`
  );
  process.exit(1);
}

// ── Allowlist matching ───────────────────────────────────────────────────────
const allowed = new Map(ALLOWLIST);
if (allowed.size !== ALLOWLIST.length) {
  errors.push({ where: 'ALLOWLIST', detail: 'duplicate allowlist entry — deduplicate the list' });
}

const seenEdges = new Set<string>();
for (const e of edges) {
  const key = `${e.source} -> ${e.target}`;
  seenEdges.add(key);
  if (!allowed.has(key)) {
    errors.push({ where: e.where, detail: `cross-component edge '${key}' — ${HINT}` });
  }
}
for (const [key] of ALLOWLIST) {
  if (!seenEdges.has(key)) {
    errors.push({ where: 'ALLOWLIST', detail: `stale allowlist entry '${key}' — remove it` });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(
  `\n${c.bold}imports-lint${c.reset} ${c.gray}· ${dirFiles.size} component dirs, ` +
    `${publicOwner.size} public names, ${filesScanned} files${c.reset}\n`
);

if (errors.length) {
  console.log(`${c.red}${c.bold}Errors (${errors.length})${c.reset} ${c.gray}— must fix${c.reset}`);
  for (const f of errors) {
    console.log(`  ${c.red}${f.where}${c.reset}`);
    console.log(`    ${f.detail}`);
  }
  console.log(`\n${c.red}✖ ${errors.length} error(s)${c.reset}\n`);
  process.exit(1);
}

console.log(
  `${c.green}✓ ${edges.length} cross-component edges checked ` +
    `(${seenEdges.size} distinct), all allowlisted (${ALLOWLIST.length} entries)${c.reset}\n`
);
