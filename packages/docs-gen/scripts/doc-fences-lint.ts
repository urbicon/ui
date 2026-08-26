#!/usr/bin/env bun
/**
 * doc-fences-lint — compiles the opted-in `ts` code fences of the shipped
 * Markdown docs with `tsc`, as a consumer would see them.
 *
 * Corpus: every `packages/<pkg>/README.md` and `packages/<pkg>/docs/*.md` — the
 * files that ship in npm tarballs (six of them are symlinked from `docs/`) and
 * feed `llms-full.txt`. Nothing else compiles their code blocks, and what slips
 * through is exactly what `tsc` names: a factory missing required methods
 * (TS2739), an import the exports map does not provide (TS2305), a config key
 * that does not exist (TS2353), an env value typed `string | undefined` handed
 * to a `string` parameter (TS2322).
 *
 * Opt-in, not check-all: most `ts` fences are deliberate excerpts with
 * elided parts and free identifiers, and a skip list over them would be the
 * hand-maintained list this repo argues against. A fence is checked when the
 * line directly above it is
 *
 *     <!-- typecheck -->
 *     <!-- typecheck: stub drizzle-orm -->
 *
 * `stub <pkg>` adds `scripts/fence-stubs/<pkg>.d.ts` — an ambient declaration
 * of a third-party module the repo does not depend on — to that document's
 * program. A marker that is not followed by a `ts`/`typescript` fence, an
 * unknown directive, a missing stub file and a stub file no fence uses are all
 * errors, so the marker set and the stub directory cannot drift apart silently.
 *
 * How it compiles: a throwaway consumer project under `.doc-fences-lint/`
 * whose `node_modules/@urbicon-ui/<pkg>` are symlinks to the workspace
 * packages, so every import resolves through the **published exports map**
 * into `dist/` (`moduleResolution: "bundler"`, `strict`, `verbatimModuleSyntax`
 * — the profile SvelteKit generates for an app). One `tsc` per document, all
 * of its marked fences in one program; every diagnostic code is reported,
 * because a marked fence is a whole module, not a fragment to filter noise
 * from. Needs `build:packages` first — an unbuilt package is a `TS2307`.
 *
 * What the consumer has and the fence cannot bring along is declared per
 * document, derived from the fences' own imports so that nothing is stubbed
 * that the real module would not provide:
 *   - `$env/static/private` exports exactly the SCREAMING_SNAKE names the
 *     fences import, minus `PUBLIC_*` (SvelteKit keeps those out of the private
 *     module). `import { env } from '$env/static/private'` therefore stays the
 *     `TS2305` it is in a real app — a `declare const env` would have hidden it.
 *   - `$env/dynamic/private` / `$env/dynamic/public` in the shape
 *     `svelte-kit sync` writes (`PUBLIC_*` → `undefined`, the rest
 *     `string | undefined`) — that shape is what makes `secret: env.X` fail
 *     against a `string` parameter, as it does in the app.
 *   - `$lib`, `$lib/*` and relative consumer modules (`./prisma`) are `any`:
 *     the app's own files, out of scope. Relative ones get a `.d.ts` next to
 *     the fence exporting the imported names.
 *
 * Output names the document, the fence number and the **document line**
 * (scratch offsets are mapped back), and proves via `tsc --listFiles` that
 * every marked fence was in the program — a harness whose `include` no longer
 * matches its files is green for nothing.
 *
 * Run: `bun run docs:fences:lint` (needs `build:packages`). Options:
 *   --docs <file>…    check these Markdown files instead of the corpus
 *   --scratch <dir>   scratch directory (default: packages/docs-gen/.doc-fences-lint)
 *   --keep            leave the scratch project in place for inspection
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPECHECK_MARKER } from '../src/generators/llm/guide-injection';

const DOCS_GEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(DOCS_GEN, '../..');
const STUBS_DIR = join(DOCS_GEN, 'scripts/fence-stubs');

// ── arguments ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let keep = false;
let scratchDir = 'packages/docs-gen/.doc-fences-lint';
const docArgs: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--keep') keep = true;
  else if (a === '--scratch') scratchDir = argv[++i] ?? scratchDir;
  else if (a === '--docs')
    while (argv[i + 1] && !argv[i + 1]?.startsWith('--')) docArgs.push(argv[++i] ?? '');
  else throw new Error(`unknown argument ${a} (known: --docs <file>…, --scratch <dir>, --keep)`);
}
const SCRATCH = resolve(REPO, scratchDir);
const docs = docArgs.length ? docArgs.map((a) => resolve(REPO, a)) : corpus();

/** Every Markdown file a package ships: its README and its `docs/` directory. */
function corpus(): string[] {
  const out: string[] = [];
  const packagesDir = join(REPO, 'packages');
  for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const readme = join(packagesDir, pkg.name, 'README.md');
    if (existsSync(readme)) out.push(readme);
    const docsDir = join(packagesDir, pkg.name, 'docs');
    if (existsSync(docsDir))
      for (const f of readdirSync(docsDir)) if (f.endsWith('.md')) out.push(join(docsDir, f));
  }
  return out.sort();
}

// ── fence extraction ────────────────────────────────────────────────────────
interface Fence {
  /** 1-based position among the `ts`/`typescript` fences of the document */
  index: number;
  /** 1-based document line of the opening ``` — code starts on the next line */
  openLine: number;
  code: string;
  stubs: string[];
}

interface Doc {
  path: string;
  rel: string;
  fences: Fence[];
  /** marker/directive problems — reported like findings, fail the run */
  errors: string[];
}

const FENCE_OPEN = /^```(\w*)/;
const TS_LANGS = new Set(['ts', 'typescript']);

function extract(path: string): Doc {
  const rel = relative(REPO, path);
  const lines = readFileSync(path, 'utf8').split('\n');
  const doc: Doc = { path, rel, fences: [], errors: [] };

  let open: { lang: string; line: number; marker: string | null | undefined } | null = null;
  let tsIndex = 0;
  const body: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (open) {
      if (/^```\s*$/.test(line)) {
        if (open.marker !== undefined) {
          const stubs = parseDirectives(open.marker, doc, open.line - 1);
          if (stubs)
            doc.fences.push({ index: tsIndex, openLine: open.line, code: body.join('\n'), stubs });
        }
        open = null;
        body.length = 0;
      } else body.push(line);
      continue;
    }

    const marker = line.match(TYPECHECK_MARKER);
    if (marker) {
      const next = (lines[i + 1] ?? '').match(FENCE_OPEN);
      if (!next || !TS_LANGS.has(next[1] ?? ''))
        doc.errors.push(
          `${rel}:${i + 1}: <!-- typecheck --> must sit on the line directly above a \`\`\`ts fence`
        );
      continue;
    }

    const fence = line.match(FENCE_OPEN);
    if (fence) {
      const lang = fence[1] ?? '';
      const isTs = TS_LANGS.has(lang);
      if (isTs) tsIndex++;
      const prev = (lines[i - 1] ?? '').match(TYPECHECK_MARKER);
      open = { lang, line: i + 1, marker: isTs && prev ? (prev[1] ?? null) : undefined };
    }
  }
  return doc;
}

/** `stub a, stub b` → ['a', 'b']; null when a directive is unusable. */
function parseDirectives(spec: string | null, doc: Doc, line: number): string[] | null {
  if (!spec) return [];
  const stubs: string[] = [];
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^stub\s+([@\w./-]+)$/);
    if (!m) {
      doc.errors.push(
        `${doc.rel}:${line}: unknown typecheck directive "${part.trim()}" (known: stub <pkg>)`
      );
      return null;
    }
    const name = m[1] ?? '';
    if (!existsSync(join(STUBS_DIR, `${name}.d.ts`))) {
      doc.errors.push(`${doc.rel}:${line}: no stub scripts/fence-stubs/${name}.d.ts for "${name}"`);
      return null;
    }
    stubs.push(name);
  }
  return stubs;
}

// ── consumer project ────────────────────────────────────────────────────────
interface ImportSpec {
  named: Set<string>;
  types: Set<string>;
  default: boolean;
  namespace: boolean;
}

/** Every `import … from '<module>'` of a code block, by module specifier. */
function imports(code: string): Map<string, ImportSpec> {
  const out = new Map<string, ImportSpec>();
  const get = (mod: string) => {
    let s = out.get(mod);
    if (!s) {
      s = { named: new Set(), types: new Set(), default: false, namespace: false };
      out.set(mod, s);
    }
    return s;
  };
  const re =
    /import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\*\s+as\s+(\w+)|\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of code.matchAll(re)) {
    const [, typeOnly, def, ns, named, mod] = m;
    const spec = get(mod ?? '');
    if (def) spec.default = true;
    if (ns) spec.namespace = true;
    for (const raw of (named ?? '').split(',')) {
      const part = raw.trim();
      if (!part) continue;
      const isType = typeOnly || /^type\s+/.test(part);
      const name =
        part
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          ?.trim() ?? '';
      if (!name) continue;
      (isType ? spec.types : spec.named).add(name);
    }
  }
  return out;
}

const STATIC_PRIVATE = /^(?!PUBLIC_)[A-Z][A-Z0-9_]*$/;
const STATIC_PUBLIC = /^PUBLIC_[A-Z0-9_]*$/;

/** The SvelteKit ambient a real app would have, cut to what these fences import. */
function ambient(specs: Map<string, ImportSpec>): string {
  const out: string[] = [];
  const envModule = (mod: string, accept: RegExp) => {
    const spec = specs.get(mod);
    if (!spec) return;
    const names = [...spec.named, ...spec.types].filter((n) => accept.test(n)).sort();
    out.push(
      `declare module '${mod}' {`,
      ...names.map((n) => `\texport const ${n}: string;`),
      '}',
      ''
    );
  };
  envModule('$env/static/private', STATIC_PRIVATE);
  envModule('$env/static/public', STATIC_PUBLIC);
  out.push(KIT_AMBIENT);
  return out.join('\n');
}

/** The fixed part: the shapes `svelte-kit sync` writes regardless of the app's env. */
const KIT_AMBIENT = `declare module '$env/dynamic/private' {
\texport const env: {
\t\t[key: \`PUBLIC_\${string}\`]: undefined;
\t\t[key: \`\${string}\`]: string | undefined;
\t};
}

declare module '$env/dynamic/public' {
\texport const env: {
\t\t[key: \`PUBLIC_\${string}\`]: string | undefined;
\t};
}

declare module '$lib';
declare module '$lib/*';
`;

/** `import { prisma } from './prisma'` → `prisma.d.ts` exporting `prisma: any`. */
function relativeStub(spec: ImportSpec): string {
  const out: string[] = [];
  for (const n of [...spec.named].sort()) out.push(`export const ${n}: any;`);
  for (const n of [...spec.types].sort()) out.push(`export type ${n} = any;`);
  if (spec.default) out.push('declare const _default: any;', 'export default _default;');
  if (spec.namespace && !out.length) out.push('export {};');
  return `${out.join('\n')}\n`;
}

/** Workspace packages by npm name, so scratch `node_modules` can link them. */
function workspacePackages(): Map<string, string> {
  const out = new Map<string, string>();
  const packagesDir = join(REPO, 'packages');
  for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const manifest = join(packagesDir, pkg.name, 'package.json');
    if (!existsSync(manifest)) continue;
    const name = JSON.parse(readFileSync(manifest, 'utf8')).name as string | undefined;
    if (name?.startsWith('@urbicon-ui/')) out.set(name, join(packagesDir, pkg.name));
  }
  return out;
}

const HAS_MODULE_SYNTAX = /^\s*(import|export)\b/m;

interface Project {
  dir: string;
  tsconfig: string;
  /** fence file (absolute) → fence */
  files: Map<string, Fence>;
}

function project(doc: Doc, stubsUsed: Set<string>): Project {
  const dir = join(SCRATCH, doc.rel.replace(/\.md$/, '').replaceAll('/', '__'));
  mkdirSync(dir, { recursive: true });

  const files = new Map<string, Fence>();
  const all = new Map<string, ImportSpec>();
  const stubs = new Set<string>();

  for (const fence of doc.fences) {
    const file = join(dir, `fence-${fence.index}.ts`);
    // a block without import/export is a script, and its top-level names would
    // leak into every other fence of the document
    const code = HAS_MODULE_SYNTAX.test(fence.code) ? fence.code : `${fence.code}\nexport {};\n`;
    writeFileSync(file, code);
    files.set(file, fence);
    for (const s of fence.stubs) stubs.add(s);

    for (const [mod, spec] of imports(fence.code)) {
      const merged = all.get(mod);
      if (!merged) all.set(mod, spec);
      else {
        for (const n of spec.named) merged.named.add(n);
        for (const n of spec.types) merged.types.add(n);
        merged.default ||= spec.default;
        merged.namespace ||= spec.namespace;
      }
    }
  }

  writeFileSync(join(dir, 'ambient.d.ts'), ambient(all));

  for (const [mod, spec] of all) {
    if (!mod.startsWith('.')) continue;
    const target = normalize(join(dir, `${mod}.d.ts`));
    if (!target.startsWith(dir))
      throw new Error(`${doc.rel}: relative import "${mod}" escapes the document's scratch dir`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, relativeStub(spec));
  }

  for (const stub of stubs) {
    stubsUsed.add(stub);
    writeFileSync(
      join(dir, `stub-${stub.replaceAll('/', '__')}.d.ts`),
      readFileSync(join(STUBS_DIR, `${stub}.d.ts`), 'utf8')
    );
  }

  const tsconfig = join(dir, 'tsconfig.json');
  writeFileSync(
    tsconfig,
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'esnext',
          lib: ['esnext', 'DOM', 'DOM.Iterable'],
          verbatimModuleSyntax: true,
          isolatedModules: true,
          skipLibCheck: true,
          types: ['node']
        },
        include: ['./**/*.ts']
      },
      null,
      2
    )}\n`
  );

  return { dir, tsconfig, files };
}

function linkWorkspace(): void {
  const scope = join(SCRATCH, 'node_modules/@urbicon-ui');
  mkdirSync(scope, { recursive: true });
  for (const [name, dir] of workspacePackages()) {
    const link = join(scope, name.slice('@urbicon-ui/'.length));
    if (!existsSync(link)) symlinkSync(dir, link, 'dir');
  }
}

// ── tsc ─────────────────────────────────────────────────────────────────────
interface Diagnostic {
  file: string;
  line: number;
  code: string;
  message: string;
}

interface TscResult {
  listed: Set<string>;
  diagnostics: Diagnostic[];
  raw: string;
}

const DIAG = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

async function tsc(p: Project): Promise<TscResult> {
  const proc = Bun.spawn(['bunx', 'tsc', '-p', p.tsconfig, '--listFiles', '--pretty', 'false'], {
    cwd: DOCS_GEN,
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ]);
  await proc.exited;
  if (stderr.trim()) throw new Error(`tsc failed to start:\n${stderr}`);

  const listed = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  for (const line of stdout.split('\n')) {
    const d = line.match(DIAG);
    if (d) {
      const [, file, ln, , code, message] = d;
      diagnostics.push({
        file: resolve(DOCS_GEN, file ?? ''),
        line: Number(ln),
        code: code ?? '',
        message: message ?? ''
      });
      continue;
    }
    if (/^\s+\S/.test(line) && diagnostics.length) {
      // continuation of the previous message (the "missing properties" list)
      const last = diagnostics[diagnostics.length - 1];
      if (last) last.message += ` ${line.trim()}`;
      continue;
    }
    if (isAbsolute(line.trim())) listed.add(resolve(line.trim()));
  }
  return { listed, diagnostics, raw: stdout };
}

// ── run ─────────────────────────────────────────────────────────────────────
const started = performance.now();
rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });
linkWorkspace();

const usedStubs = new Set<string>();
const findings: string[] = [];
let fenceCount = 0;
let docCount = 0;

for (const path of docs) {
  if (!existsSync(path)) {
    findings.push(`${relative(REPO, path)}: no such file`);
    continue;
  }
  const doc = extract(path);
  findings.push(...doc.errors);
  if (!doc.fences.length) continue;

  docCount++;
  fenceCount += doc.fences.length;
  const p = project(doc, usedStubs);
  const result = await tsc(p);

  // proof: every fence file is in the program, and the imports went to dist/
  const missing = [...p.files.keys()].filter((f) => !result.listed.has(f));
  if (missing.length) {
    findings.push(
      `${doc.rel}: harness vacuum — tsc --listFiles does not contain ${missing
        .map((f) => basename(f))
        .join(', ')}`
    );
    continue;
  }
  const viaDist = new Map<string, number>();
  for (const f of result.listed) {
    const m = relative(REPO, f).match(/^packages\/([^/]+)\/dist\//);
    if (m) viaDist.set(m[1] ?? '', (viaDist.get(m[1] ?? '') ?? 0) + 1);
  }
  console.log(`${doc.rel} — ${doc.fences.length} fence(s) in the tsc program (--listFiles):`);
  for (const [, fence] of p.files)
    console.log(
      `  fence #${fence.index} (line ${fence.openLine + 1}–${fence.openLine + fence.code.split('\n').length})`
    );
  console.log(
    viaDist.size
      ? `  resolved via ${[...viaDist]
          .map(([pkg, n]) => `packages/${pkg}/dist (${n} files)`)
          .join(', ')}`
      : '  resolved no @urbicon-ui package'
  );

  for (const d of result.diagnostics) {
    const fence = p.files.get(d.file);
    if (fence) {
      const line = fence.openLine + d.line;
      findings.push(`${doc.rel}:${line} (fence #${fence.index}, ${d.code}): ${d.message}`);
    } else {
      findings.push(
        `${doc.rel}: harness error in ${relative(SCRATCH, d.file)}:${d.line} (${d.code}): ${d.message}`
      );
    }
  }
}

// only the full corpus can judge the stub directory; a --docs subset cannot
const staleStubs =
  !docArgs.length && existsSync(STUBS_DIR)
    ? readdirSync(STUBS_DIR)
        .filter((f) => f.endsWith('.d.ts'))
        .map((f) => f.replace(/\.d\.ts$/, ''))
        .filter((name) => !usedStubs.has(name))
    : [];
for (const name of staleStubs)
  findings.push(`scripts/fence-stubs/${name}.d.ts: no fence uses "stub ${name}" — remove it`);

if (!keep) rmSync(SCRATCH, { recursive: true, force: true });

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `\ndoc-fences-lint: ${fenceCount} marked fence(s) in ${docCount} document(s), ${docs.length} scanned, ${seconds}s\n`
);

if (findings.length) {
  for (const f of findings) console.error(f);
  console.error(`\n✖ ${findings.length} finding(s)`);
  process.exit(1);
}
console.log('✔ every marked fence compiles against the published packages');
