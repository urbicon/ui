#!/usr/bin/env bun
/**
 * examples-lint — type-checks the `@example` blocks of every *Props JSDoc.
 *
 * Why: `*Props` JSDoc is the single source for the MCP catalogue, `llm.txt`
 * and the docs site, so a wrong example is served to every consumer and every
 * agent at once. Nothing checked that those snippets compile — `TabProps`
 * documented `tabs={[{value, label}]}` for a prop typed `Snippet`, and a
 * `variant="underline"` that does not exist, for as long as the tag existed.
 *
 * How: every ```svelte block is written out as a real `.svelte` file under a
 * throwaway directory inside the package and handed to `svelte-check`. The
 * snippets are fragments, so the harness fills in what a fragment legitimately
 * leaves out:
 *   - PascalCase tags are imported from `$lib` (a tag the library does not
 *     export is either a typo — a finding — or a consumer placeholder, see
 *     PLACEHOLDERS below),
 *   - free identifiers (`activeTab`, `messages`, handlers) get a `$state<any>()`
 *     slot, collected from a first svelte-check pass, so `bind:` keeps working,
 *   - DOM globals a fragment shadows (`open`, `name`, `status`, …) get the same
 *     slot, since TS would otherwise resolve `bind:open={open}` to `window.open`.
 *
 * What it reports: only the codes that mean "this example uses an API that does
 * not exist or does not fit" (see REPORTED_CODES). Everything the fragment shape
 * itself causes — unresolved names, implicit `any` in a callback over an `any`
 * value, shorthand properties with no declaration — is NOT reported, because a
 * fragment is allowed to have those.
 *
 * Known limit, deliberately accepted: every filled-in identifier is `any`, so a
 * type error that only shows up through such a value is invisible here. The gate
 * catches wrong prop names, wrong enum values, missing required props and wrong
 * component names — the classes that actually drifted.
 *
 * Second corpus: the ```svelte fences of `design-system/patterns/*.md`. They are
 * copied verbatim into the content bundle and served by `urbicon pattern` /
 * `get_pattern`, and nothing else compiles them: `docs:fences:lint`'s corpus is
 * every `packages/<pkg>/README.md` and `packages/<pkg>/docs/*.md`, so it never
 * looks at `design-system/` under any info string.
 *
 * A pattern fence is a whole component, not a fragment, so it is written out
 * unchanged and every error svelte-check reports counts — no import splicing, no
 * `$state<any>()` slots, no REPORTED_CODES filter and no PLACEHOLDERS exemption.
 * It names the compound-API typo a real import turns into a property access
 * (`<Tab.Root>` → TS2339 on `Component<TabProps>`) and a tag the package does not
 * export (TS2305), each at its document line — both measured against a fence
 * carrying them.
 *
 * There is no PLACEHOLDERS list for this corpus by design: a pattern ships
 * verbatim to a consumer, so it has to compile against the library alone. A
 * fence that needs consumer context takes it as `{@render children()}` or a
 * named snippet, or leaves an `<!-- your ... -->` marker in the markup — never a
 * fake import of a component that does not exist, which is exactly the finding.
 *
 * What the compiler structurally does not see: an interactive element nested in
 * a component's children (`<a>` inside a `TabItem`) — a component boundary is
 * opaque to it — and a `?? 0` on a never-nullish `findIndex`; and svelte-check
 * runs at `--threshold error`, so a11y warnings do not count here either.
 *
 * The corpus is only checked if it reaches the host package, so the run counts
 * the fences it WROTE there and fails when that number is not the number it
 * parsed, or is zero — parsing alone is satisfied by a fence nothing compiles.
 * `EXAMPLES_LINT_PATTERNS_DIR` points the corpus at a fixture; the end-to-end
 * control in `examples-lint.test.ts` uses it.
 *
 * Run: `bun run examples:lint` (needs the workspace deps built).
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPatternFences, documentLine, fenceSpan } from './pattern-fences';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Every package whose `*Props` JSDoc ships examples to consumers. */
const PACKAGES = ['blocks', 'table', 'auth', 'docs'] as const;

/** Composition patterns — copied verbatim into the content bundle, served by `urbicon pattern`. */
const PATTERNS_DIR = process.env.EXAMPLES_LINT_PATTERNS_DIR ?? join(REPO, 'design-system/patterns');
/**
 * Whose svelte-check judges the pattern fences. `blocks`, because both things
 * a pattern imports resolve there without a stub: `@sveltejs/kit` is a
 * devDependency, so `$app/state` / `$app/navigation` are ambient after
 * `svelte-kit sync`, and `@urbicon-ui/blocks` reaches the built `dist/`
 * through the workspace link — the consumer's view, not `$lib`.
 */
const PATTERNS_HOST: (typeof PACKAGES)[number] = 'blocks';

/**
 * Components an example references as *consumer* context — they are not library
 * exports and are not meant to be. Every entry must be used by at least one
 * example; a stale one is an error, so the list shrinks with the examples.
 */
const PLACEHOLDERS: ReadonlyArray<readonly [name: string, why: string]> = [
  ['App', 'GuideProvider example wraps the consumer app root'],
  ['FeatureCard', "Scroller examples show the consumer's own card in the row"],
  ['MealCard', 'Planner example renders a consumer-defined entry card'],
  ['PhaseSummary', 'JourneyTimeline example renders consumer content per node'],
  ['SettingsForm', 'Collapsible example wraps a consumer form'],
  ['WeatherResult', "ToolCallCard example renders the consumer's tool result"]
];

/** Diagnostic codes that mean the example itself is wrong. */
const REPORTED_CODES = new Set<number | string>([
  2322, // Type X is not assignable to type Y — wrong prop type / enum value
  2353, // Object literal may only specify known properties
  2559, // Type has no properties in common with
  2561, // Object literal … did you mean to write X?
  2739, // Type is missing the following properties (required props)
  2741, // Property X is missing in type (required prop)
  2724, // has no exported member named X. Did you mean Y?
  2820 // Type X is not assignable to Y. Did you mean Z?
]);

/** svelte compiler errors that mean the snippet is not valid Svelte at all. */
const REPORTED_SVELTE = /^(?!.*bind_invalid_value)/;

interface Example {
  file: string;
  source: string;
  /** How a finding names the snippet: `Tab @example #2`, `svelte fence #1`. */
  label: string;
  /**
   * Set for a pattern fence: written verbatim, every diagnostic reported, and
   * diagnostic lines mapped back onto the document from this opening-fence line.
   */
  pattern?: { openLine: number };
}

function walkIndexFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('__'))
      continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkIndexFiles(path, out);
    else if (entry.name === 'index.ts') out.push(path);
  }
  return out;
}

const GLOBALS =
  /\b(open|close|name|status|files|event|top|self|origin|parent|length|history|location|focus|blur|print|scroll|frames|screen)\b/g;

/**
 * Component names `blocks` exports. The other packages document examples that
 * compose blocks components (a table cell rendering a `<Badge>`, a docs example
 * with a `<Button>`), so their harness has to import those from the package
 * that owns them — otherwise every such tag reads as an unknown component.
 */
function blocksExports(): Set<string> {
  const names = new Set<string>();
  for (const file of walkIndexFiles(join(REPO, 'packages/blocks/src/lib'))) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/export\s*\{\s*default\s+as\s+(\w+)\s*\}/g)) names.add(m[1]);
    for (const m of text.matchAll(/export\s*\{([^}]*)\}\s*from/g))
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name && /^[A-Z]/.test(name)) names.add(name);
      }
  }
  return names;
}
const BLOCKS_EXPORTS = blocksExports();

const PATTERNS = collectPatternFences(PATTERNS_DIR);

// A fence that never closes swallows the rest of the document, so the corpus is
// not what it looks like — settle that before the svelte-check passes are paid.
if (PATTERNS.unclosed.length) {
  for (const u of PATTERNS.unclosed)
    console.error(`${relative(REPO, u.source)}:${u.line}: fence opened here is never closed`);
  process.exit(1);
}

/** Pattern fences actually written into the host package's harness directory. */
let patternsWritten = 0;

function generate(pkg: string, extraDecls: Record<string, string[]>): Example[] {
  const pkgDir = join(REPO, 'packages', pkg);
  const outDir = join(pkgDir, 'src/lib/__examples-lint__');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const examples: Example[] = [];
  let n = 0;

  for (const sourceFile of walkIndexFiles(join(pkgDir, 'src'))) {
    const text = readFileSync(sourceFile, 'utf8');
    const blockRe = /\/\*\*([\s\S]*?)\*\/\s*export (?:interface|type) (\w+)Props\b/g;
    for (const match of text.matchAll(blockRe)) {
      const [, jsdocRaw, component] = match;
      const jsdoc = jsdocRaw
        .split('\n')
        .map((line) => line.replace(/^\s*\* ?/, ''))
        .join('\n');
      const blocks = [...jsdoc.matchAll(/```svelte\n([\s\S]*?)```/g)].map((m) => m[1]);

      blocks.forEach((code, index) => {
        n++;
        const name = `Ex${String(n).padStart(3, '0')}_${component}_${index}`;

        const declared = new Set<string>();
        for (const d of code.matchAll(/\b(?:let|const|function)\s+(\w+)/g)) declared.add(d[1]);
        for (const d of code.matchAll(/\{#snippet\s+(\w+)/g)) declared.add(d[1]);
        for (const d of code.matchAll(/import\s*\{([^}]*)\}/g))
          for (const part of d[1].split(','))
            declared.add(
              part
                .trim()
                .split(/\s+as\s+/)
                .pop()
                ?.trim() ?? ''
            );

        const used = new Set<string>();
        for (const tag of code.matchAll(/<([A-Z]\w*)/g))
          if (!declared.has(tag[1])) used.add(tag[1]);

        const shadowed = [...code.matchAll(GLOBALS)].map((g) => g[1]);
        const decls = [...new Set([...(extraDecls[name] ?? []), ...shadowed])].filter(
          (d) => !declared.has(d) && !used.has(d)
        );

        const fromBlocks =
          pkg === 'blocks' ? [] : [...used].filter((u) => BLOCKS_EXPORTS.has(u)).sort();
        const fromOwn = [...used].filter((u) => !fromBlocks.includes(u)).sort();
        const importLine =
          (fromOwn.length ? `\timport { ${fromOwn.join(', ')} } from '$lib/index.js';\n` : '') +
          (fromBlocks.length
            ? `\timport { ${fromBlocks.join(', ')} } from '@urbicon-ui/blocks';\n`
            : '');
        const declLines = decls.map((d) => `\tlet ${d} = $state<any>();\n`).join('');

        // `\b` so a component named `<Scripted …>` is not mistaken for the
        // snippet's script block. Case-sensitive on purpose: Svelte only treats
        // lower-case `<script>` as a script block — `<SCRIPT>` would be a
        // component, and matching it here would splice imports into markup.
        const body = /<script\b/.test(code)
          ? code.replace(/<script\b([^>]*)>/, (_m, attrs: string) => {
              const withLang = /lang=/.test(attrs) ? attrs : `${attrs} lang="ts"`;
              return `<script${withLang}>\n${importLine}${declLines}`;
            })
          : `<script lang="ts">\n${importLine}${declLines}</script>\n\n${code}`;

        writeFileSync(join(outDir, `${name}.svelte`), body);
        examples.push({
          file: `${name}.svelte`,
          source: sourceFile,
          label: `${component} @example #${index + 1}`
        });
      });
    }
  }

  if (pkg === PATTERNS_HOST)
    for (const fence of PATTERNS.fences) {
      const name = `Pattern_${basename(fence.source, '.md').replaceAll('-', '_')}_${fence.index}`;
      writeFileSync(join(outDir, `${name}.svelte`), `${fence.code}\n`);
      examples.push({
        file: `${name}.svelte`,
        source: fence.source,
        label: `svelte fence #${fence.index}`,
        pattern: { openLine: fence.openLine }
      });
    }
  return examples;
}

interface Diagnostic {
  filename: string;
  start: { line: number };
  message: string;
  code: number | string;
  source?: string;
}

/**
 * An empty diagnostics list is how this gate says "clean", so a svelte-check
 * that never ran says the same thing. It exits 1 both when it finds errors and
 * when it refuses to start (a bad `--tsconfig` prints a stack to stderr and
 * nothing to stdout, measured), so the exit code cannot tell those apart — the
 * `COMPLETED` line of `machine-verbose` can, and it is the only output the
 * runner always emits. No diagnostics AND no `COMPLETED` is a dead pass, not a
 * green one; so is any exit that is neither 0 nor 1, or a signal.
 */
/** The harness dir is git-ignored, so a run that exits with it in place leaves
 * `blocks run check` red in every harness file with nothing in `git status`
 * to explain it. Every exit after the write goes through here. */
function cleanHarness(pkg: string) {
  rmSync(join(REPO, 'packages', pkg, 'src/lib/__examples-lint__'), {
    recursive: true,
    force: true
  });
}

async function runCheck(pkg: string): Promise<Diagnostic[]> {
  const proc = Bun.spawn(
    ['bunx', 'svelte-check', '--output', 'machine-verbose', '--threshold', 'error'],
    { cwd: join(REPO, 'packages', pkg), stdout: 'pipe', stderr: 'pipe' }
  );
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ]);
  await proc.exited;

  const out: Diagnostic[] = [];
  let completed = false;
  for (const line of stdout.split('\n')) {
    if (line.includes(' COMPLETED ')) completed = true;
    const brace = line.indexOf('{');
    if (brace < 0) continue;
    try {
      const d = JSON.parse(line.slice(brace));
      if (d.type === 'ERROR' && d.filename?.includes('__examples-lint__')) out.push(d);
    } catch {
      /* progress lines are not JSON */
    }
  }

  const died = proc.signalCode !== null || (proc.exitCode !== 0 && proc.exitCode !== 1);
  if (died || !completed) {
    console.error(
      `svelte-check did not complete in packages/${pkg} (exit ${proc.exitCode}, signal ${proc.signalCode ?? 'none'}):`
    );
    console.error(stderr.trim() || '(no stderr)');
    cleanHarness(pkg);
    process.exit(1);
  }
  return out;
}

interface Finding {
  example: Example;
  line: number;
  message: string;
}

const placeholderNames = new Set(PLACEHOLDERS.map(([n]) => n));
const placeholdersSeen = new Set<string>();
const findings: Finding[] = [];
let checked = 0;

for (const pkg of PACKAGES) {
  // ── pass 1: find the identifiers a fragment leaves undeclared ─────────────
  generate(pkg, {});
  const first = await runCheck(pkg);

  const decls: Record<string, string[]> = {};
  for (const d of first) {
    const name = d.filename.split('/').pop()?.replace('.svelte', '') ?? '';
    const missing =
      d.message.match(/^Cannot find name '(\w+)'/)?.[1] ??
      d.message.match(/^No value exists in scope for the shorthand property '(\w+)'/)?.[1];
    if (!missing) continue;
    decls[name] ??= [];
    decls[name].push(missing);
  }

  // ── pass 2: judge the examples with those slots filled in ────────────────
  const examples = generate(pkg, decls);
  const second = await runCheck(pkg);
  checked += examples.filter((e) => !e.pattern).length;
  // What the host held on disk while svelte-check read it. A directory listing,
  // not the loop's own bookkeeping: bookkeeping agrees with itself by
  // construction, and the write is the step that can silently not happen.
  if (pkg === PATTERNS_HOST)
    patternsWritten = readdirSync(join(REPO, 'packages', pkg, 'src/lib/__examples-lint__')).filter(
      (f) => f.startsWith('Pattern_')
    ).length;

  const byName = new Map(examples.map((e) => [e.file.replace('.svelte', ''), e]));

  for (const d of second) {
    const name = d.filename.split('/').pop()?.replace('.svelte', '') ?? '';
    const example = byName.get(name);
    if (!example) continue;

    if (example.pattern) {
      // a whole component, not a fragment: every error counts, at its document line
      const code = d.source === 'svelte' ? String(d.code) : `TS${d.code}`;
      findings.push({
        example,
        line: documentLine(example.pattern.openLine, d.start.line),
        message: `${code}: ${d.message.split('\n')[0]}`
      });
      continue;
    }

    // a tag the library does not export: consumer placeholder or a typo
    const missingExport = d.message.match(/has no exported member(?: named)? '(\w+)'/)?.[1];
    if (missingExport) {
      if (placeholderNames.has(missingExport)) {
        placeholdersSeen.add(missingExport);
        continue;
      }
      findings.push({
        example,
        line: d.start.line + 1,
        message: `<${missingExport}> is not exported by @urbicon-ui/${pkg} — typo, or add it to PLACEHOLDERS in this script if it is consumer context`
      });
      continue;
    }

    if (d.source === 'svelte') {
      // compiler errors that survive the harness are real syntax problems,
      // except the bind-target complaint a fragment provokes
      if (d.code === 'bind_invalid_value') continue;
      if (!REPORTED_SVELTE.test(d.message)) continue;
      findings.push({ example, line: d.start.line + 1, message: d.message.split('\n')[0] });
      continue;
    }

    if (REPORTED_CODES.has(d.code))
      findings.push({ example, line: d.start.line + 1, message: d.message.split('\n')[0] });
  }

  cleanHarness(pkg);
}

// The corpus is only checked once it reaches the host. Parsing is satisfied by
// fences nothing ever compiles, so the number that counts is what was written.
if (patternsWritten !== PATTERNS.fences.length || patternsWritten === 0) {
  console.error(
    patternsWritten === 0
      ? `no pattern fence reached packages/${PATTERNS_HOST}: ${PATTERNS.fences.length} parsed in ${relative(REPO, PATTERNS_DIR)} — a run that checks nothing is not green`
      : `${PATTERNS.fences.length} pattern fence(s) parsed in ${relative(REPO, PATTERNS_DIR)}, ${patternsWritten} written into packages/${PATTERNS_HOST}`
  );
  cleanHarness(PATTERNS_HOST);
  process.exit(1);
}

// ── report ──────────────────────────────────────────────────────────────────
const staleplaceholders = PLACEHOLDERS.filter(([n]) => !placeholdersSeen.has(n));

console.log(
  `examples-lint: ${checked} @example blocks checked across ${PACKAGES.join(', ')}, ${PATTERNS.fences.length} svelte fence(s) in ${relative(REPO, PATTERNS_DIR)}:`
);
for (const f of PATTERNS.fences) {
  const span = fenceSpan(f);
  console.log(
    `  ${relative(REPO, f.source)} svelte fence #${f.index} (line ${span.from}–${span.to})`
  );
}
console.log('');

if (findings.length) {
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = relative(REPO, f.example.source);
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)?.push(f);
  }
  for (const [file, list] of byFile) {
    console.error(`${file}`);
    for (const f of list)
      console.error(
        `  ${f.example.label}${f.example.pattern ? ` line ${f.line}` : ''}: ${f.message}`
      );
  }
  console.error('');
}

if (staleplaceholders.length) {
  console.error('Stale PLACEHOLDERS entries in scripts/examples-lint.ts (no example uses them):');
  for (const [n] of staleplaceholders) console.error(`  ${n}`);
  console.error('');
}

if (findings.length || staleplaceholders.length) {
  console.error(
    `✖ ${findings.length} example finding(s), ${staleplaceholders.length} stale allowlist entr(ies)`
  );
  process.exit(1);
}

console.log('✔ every @example and every pattern fence type-checks');
