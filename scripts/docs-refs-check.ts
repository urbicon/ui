#!/usr/bin/env bun
/**
 * docs-refs-check — does every reference the instruction docs make still
 * resolve? Four systems answer, never a model of them:
 *
 *   1. `package.json` — for every `bun run <name>` span the root scripts, for
 *      every `bun --filter='<pkg>' run <name>` that package's.
 *   2. the file tree — for every backtick span shaped like a repo path and for
 *      every `file.ts:123` pointer. `git check-ignore` decides the one case the
 *      tree cannot: a path that is absent by design (`docs/internal/`,
 *      generated catalogs) is unverifiable, not broken.
 *   3. the sources — `packages/*` and `apps/*` src+scripts, `scripts`,
 *      `.github`, the root configs — word-boundary-grepped for every
 *      `UPPER_SNAKE_CASE` span, so a deleted constant stops being documented as
 *      an exemption an agent then looks for.
 *   4. the target document's headings, slugified the way GitHub does, for every
 *      `[…](file.md#anchor)` link.
 *
 * It owns existence and nothing else. A path that exists but is the wrong one,
 * a count that has drifted, two docs that contradict each other, a rule that no
 * longer holds: all of that is the review's, and a green run says nothing about
 * it. The split is worth having because the existence half is the half that
 * rots on every rename, and it needs no reader.
 *
 * Extraction is narrow, because a false positive is paid for in exemptions:
 * inline code spans only (never fenced blocks), a path only when the span
 * carries a `/` and ends in `/` or an alphabetic extension, and never a span
 * carrying `*`, `<`, `>`, `{`, `}`, `…`, `$`, `?`, `|` or `...` — a pattern or
 * a placeholder is not a claim that a file exists. A span that is a link's
 * whole label is skipped too: the target is the claim, the label only names it.
 *
 * The docs name a file by as much of its path as identifies it
 * (`Tab/tab.context.ts`), so a token is resolved against the root, the
 * document's own directory, its package, and finally as a path tail. A token
 * whose FIRST segment is a real top-level directory is a root-anchored claim
 * and gets no tail — that is what keeps `scripts/imports-lint.ts` a finding
 * while the file sits in `packages/blocks/scripts/`.
 *
 * `ALLOWLIST` exempts a reference by its literal text, one reason per entry; an
 * entry no source mentions is reported as stale, the contract of
 * `packages/blocks/scripts/imports-lint.ts`. Stale means "no source mentions
 * it", not "suppressed no finding": an entry must not flip with the state of a
 * tree the check does not control.
 *
 * Run: `bun run docs:refs:check` — no build needed. `--root <dir>` points it at
 * another tree, `--json` prints findings as JSON. Exit 1 on any finding.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Glob } from 'bun';

/** AGENTS.md is read in full by every session; the budget is what that costs. */
export const AGENTS_WORD_BUDGET = 3300;

/** Exemptions — a genuine false positive per entry, with the reason for it. */
export const ALLOWLIST: ReadonlyArray<readonly [what: string, why: string]> = [
  ['NOT_DECIDABLE', 'a verdict the architecture-probe skill writes, not a constant in the code'],
  ['NODE_ENV', 'a platform environment variable, named to explain an upstream build gate'],
  ['src/runtime/server/respond.js', 'a file inside @sveltejs/kit, cited to locate its CSRF gate'],
  [
    'src/routes/.well-known/jwks.json/+server.ts',
    'a route the consumer mounts in their own app — AUTH.md says "e.g."'
  ],
  [
    'TABLE_QUERY_FILTER_OPERATORS',
    'the v7 name in a rename table: retired by design, and the row is why'
  ]
];

export type Kind = 'script' | 'path' | 'ident' | 'link' | 'budget' | 'allowlist';

export interface Finding {
  file: string;
  line: number;
  kind: Kind;
  what: string;
  why: string;
}

export interface Report {
  sources: number;
  references: number;
  words: number;
  findings: Finding[];
}

interface Source {
  /** Path relative to the root, as reported — a doc symlink reports its target. */
  display: string;
  real: string;
  /** The directory the document lives in: the base for its relative links. */
  dir: string;
  /** The workspace package it lives in, or null at the root. */
  pkg: string | null;
  text: string;
}

const PATTERN_CHARS = /[*<>{}…$?|]/;
const IDENT = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const FILE_LINE = /^(.+?):(\d+)(?:-\d+)?$/;
const EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,7}$/;
const ARTIFACT = /(^|\/)(node_modules|dist|\.svelte-kit)(\/|$)/;
const SKIP_DIR = /(^|\/)(node_modules|dist|\.svelte-kit|\.git|build|coverage|test-results)(\/|$)/;
const BINARY =
  /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|zip|gz|tgz|svg|lock)$/i;

/** What the identifier grep reads. Never node_modules, dist or .svelte-kit. */
const CORPUS_GLOBS = [
  'packages/*/src/**/*',
  'packages/*/scripts/**/*',
  'scripts/**/*',
  'apps/*/src/**/*',
  'apps/*/scripts/**/*',
  '.github/**/*',
  '*.config.*',
  'lefthook.yml',
  'package.json'
];

export function check(root: string): Report {
  // Through the symlinks first: a source's own path comes back from
  // `realpathSync`, and a root that did not would make every display path
  // relative to a different spelling of the same directory.
  const ROOT = realpathSync(resolve(root));
  const rel = (p: string) => relative(ROOT, p) || '.';

  // ── Sources ────────────────────────────────────────────────────────────────

  const sources: Source[] = [];
  {
    const paths: string[] = [];
    const agents = join(ROOT, 'AGENTS.md');
    if (existsSync(agents)) paths.push(agents);
    // `followSymlinks`, or the seven tarball docs are silently not sources:
    // a plain scan counts a symlink as "not a file" and drops it.
    for (const p of new Glob('docs/*.md').scanSync({
      cwd: ROOT,
      onlyFiles: true,
      followSymlinks: true
    }))
      paths.push(join(ROOT, p));
    for (const p of new Glob('.claude/skills/*/SKILL.md').scanSync({
      cwd: ROOT,
      onlyFiles: true,
      dot: true
    }))
      paths.push(join(ROOT, p));

    const seen = new Set<string>();
    for (const p of paths) {
      // A tarball doc is a symlink from docs/ into its package. Check it once,
      // at the target, so a finding names the file a consumer actually edits.
      const real = realpathSync(p);
      if (seen.has(real)) continue;
      seen.add(real);
      const pkg = rel(real).match(/^((?:packages|apps)\/[^/]+)\//);
      sources.push({
        display: rel(real),
        real,
        dir: dirname(real),
        pkg: pkg?.[1] ? join(ROOT, pkg[1]) : null,
        text: readFileSync(real, 'utf-8')
      });
    }
    sources.sort((a, b) => a.display.localeCompare(b.display));
  }

  // ── Oracles ────────────────────────────────────────────────────────────────

  const scriptCache = new Map<string, Set<string> | null>();
  const scriptsOf = (dir: string): Set<string> | null => {
    const hit = scriptCache.get(dir);
    if (hit !== undefined) return hit;
    let out: Set<string> | null = null;
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      try {
        const json = JSON.parse(readFileSync(file, 'utf-8')) as {
          scripts?: Record<string, string>;
        };
        out = new Set(Object.keys(json.scripts ?? {}));
      } catch {
        out = null;
      }
    }
    scriptCache.set(dir, out);
    return out;
  };

  /** `@urbicon-ui/table`, `table`, `docs-app`, `./packages/docs` → a package dir. */
  const packageDir = (spec: string): string | null => {
    const name = spec.replace(/^@urbicon-ui\//, '');
    if (name.includes('/')) {
      const dir = resolve(ROOT, name);
      return existsSync(join(dir, 'package.json')) ? dir : null;
    }
    const plain = name === 'docs-app' ? 'docs' : name;
    for (const base of name === 'docs-app' ? ['apps'] : ['packages', 'apps']) {
      const dir = join(ROOT, base, plain);
      if (existsSync(join(dir, 'package.json'))) return dir;
    }
    return null;
  };

  let corpusText: string | null = null;
  const corpus = (): string => {
    if (corpusText !== null) return corpusText;
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const pattern of CORPUS_GLOBS)
      for (const p of new Glob(pattern).scanSync({ cwd: ROOT, onlyFiles: true, dot: true })) {
        if (SKIP_DIR.test(p) || BINARY.test(p) || seen.has(p)) continue;
        seen.add(p);
        try {
          parts.push(readFileSync(join(ROOT, p), 'utf-8'));
        } catch {
          /* unreadable file — nothing to grep */
        }
      }
    corpusText = parts.join('\n');
    return corpusText;
  };

  let tree: { files: Map<string, string[]>; dirs: Map<string, string[]> } | null = null;
  const treeIndex = () => {
    if (tree !== null) return tree;
    const files = new Map<string, string[]>();
    const dirs = new Map<string, string[]>();
    const push = (map: Map<string, string[]>, path: string) => {
      const list = map.get(basename(path));
      if (list) list.push(path);
      else map.set(basename(path), [path]);
    };
    const seenDir = new Set<string>();
    for (const p of new Glob('**/*').scanSync({ cwd: ROOT, onlyFiles: true, dot: true })) {
      if (SKIP_DIR.test(p)) continue;
      push(files, p);
      for (let dir = dirname(p); dir !== '.'; dir = dirname(dir)) {
        if (seenDir.has(dir)) break;
        seenDir.add(dir);
        push(dirs, dir);
      }
    }
    tree = { files, dirs };
    return tree;
  };

  const resolvesByTail = (token: string): boolean => {
    const isDir = token.endsWith('/');
    const t = token.replace(/\/+$/, '');
    if (t === '') return false;
    const map = isDir ? treeIndex().dirs : treeIndex().files;
    return (map.get(basename(t)) ?? []).some((p) => p === t || p.endsWith(`/${t}`));
  };

  let rootDirs: Set<string> | null = null;
  const isRootAnchored = (token: string): boolean => {
    rootDirs ??= new Set(
      readdirSync(ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== 'node_modules')
        .map((e) => e.name)
    );
    return rootDirs.has(token.split('/')[0] ?? '');
  };

  const slugCache = new Map<string, Set<string>>();
  const headingSlugs = (file: string): Set<string> => {
    const hit = slugCache.get(file);
    if (hit) return hit;
    const slugs = new Set<string>();
    const counts = new Map<string, number>();
    let fenced = false;
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
      if (!m) continue;
      const base = slugify(m[1] ?? '');
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      slugs.add(n === 0 ? base : `${base}-${n}`);
    }
    slugCache.set(file, slugs);
    return slugs;
  };

  // ── Collection ─────────────────────────────────────────────────────────────

  const allow = new Map(ALLOWLIST.map(([what, why]) => [what, why]));
  const allowHit = new Set<string>();
  const findings: Finding[] = [];
  let references = 0;

  const seenRef = (what: string) => {
    references++;
    if (allow.has(what)) allowHit.add(what);
  };

  const report = (src: Source, line: number, kind: Kind, what: string, why: string) => {
    if (allow.has(what)) {
      allowHit.add(what);
      return;
    }
    findings.push({ file: src.display, line, kind, what, why });
  };

  const checkPathLike = (src: Source, line: number, token: string) => {
    const bases = [ROOT, src.dir];
    if (src.pkg && /^(src|scripts|docs)\//.test(token)) bases.push(src.pkg);
    for (const base of bases) if (existsSync(resolve(base, token))) return;
    if (isRootAnchored(token))
      report(src, line, 'path', token, `no such file at the repo root or under ${rel(src.dir)}`);
    else if (!resolvesByTail(token))
      report(src, line, 'path', token, 'no file with that path tail anywhere in the tree');
  };

  const checkFragment = (
    src: Source,
    line: number,
    target: string,
    file: string,
    frag: string | null
  ) => {
    if (!frag || !file.endsWith('.md') || !statSync(file).isFile()) return;
    if (!headingSlugs(file).has(frag.toLowerCase()))
      report(src, line, 'link', target, `no heading in ${rel(file)} slugifies to #${frag}`);
  };

  const checkSpan = (src: Source, line: number, span: string) => {
    // 1 — scripts. A `--filter` carrying a glob or a placeholder names no
    // single package, so there is nothing to ask.
    for (const m of span.matchAll(
      /\bbun\s+(?:--bun\s+)?--filter=['"]?([^'"\s]+)['"]?(?:\s+--bun)?\s+run\s+([A-Za-z0-9:_.-]+)(?![<>{}*?$|\w:.-])/g
    )) {
      const [, spec = '', name = ''] = m;
      if (PATTERN_CHARS.test(spec)) continue;
      seenRef(name);
      const dir = packageDir(spec);
      if (!dir)
        report(src, line, 'script', `--filter=${spec}`, 'no workspace package of that name');
      else if (!scriptsOf(dir)?.has(name))
        report(src, line, 'script', name, `not a script of ${rel(dir)}/package.json`);
    }
    for (const m of span.matchAll(
      /\bbun\s+(?:--bun\s+)?run\s+([A-Za-z0-9:_.-]+)(?![<>{}*?$|\w:.-])/g
    )) {
      const name = m[1] ?? '';
      // `bun run scripts/foo.ts` names a file, not a script — rule 2 owns it.
      if (name.includes('.')) continue;
      seenRef(name);
      if (!scriptsOf(ROOT)?.has(name))
        report(src, line, 'script', name, 'not a script of the root package.json');
    }

    // 3 — identifiers. The whole span, never a word inside a sentence.
    const ident = span.trim();
    if (IDENT.test(ident)) {
      seenRef(ident);
      if (!new RegExp(`\\b${ident}\\b`).test(corpus()))
        report(
          src,
          line,
          'ident',
          ident,
          'occurs in no source under packages/apps/scripts/.github'
        );
      return;
    }

    // 2 — paths and file:line pointers
    for (const raw of span.split(/\s+/)) {
      const token = normalize(raw);
      if (skippable(token)) continue;
      const pointer = token.match(FILE_LINE);
      const file = pointer?.[1];
      if (file && EXTENSION.test(file)) {
        seenRef(file);
        if (file.includes('/')) checkPathLike(src, line, file);
        else if (!treeIndex().files.has(file))
          report(src, line, 'path', file, 'no file of that name in the tree');
        continue;
      }
      if (!looksLikePath(token)) continue;
      seenRef(token);
      checkPathLike(src, line, token);
    }
  };

  const checkLink = (src: Source, line: number, target: string) => {
    if (/^(mailto|tel):/.test(target)) return;
    if (/^https?:\/\//.test(target)) {
      const m = target.match(/^https:\/\/github\.com\/urbicon\/ui\/blob\/main\/(.+)$/);
      if (!m) return;
      const [path, frag] = splitFragment(m[1] ?? '');
      seenRef(path);
      const abs = join(ROOT, path);
      if (!existsSync(abs)) report(src, line, 'link', target, `no such file: ${path}`);
      else checkFragment(src, line, target, abs, frag);
      return;
    }
    const [path, frag] = splitFragment(target);
    if (path === '') {
      if (!frag) return;
      seenRef(target);
      checkFragment(src, line, target, src.real, frag);
      return;
    }
    if (skippable(normalize(path))) return;
    seenRef(path);
    const abs = resolve(src.dir, path);
    if (!existsSync(abs))
      report(src, line, 'link', target, `no such file relative to ${rel(src.dir)}`);
    else checkFragment(src, line, target, abs, frag);
  };

  for (const src of sources) {
    let fenced = false;
    for (const [i, line] of src.text.split('\n').entries()) {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      // `[`docs/MIGRATION.md`](…)` claims the target, not the label: the label
      // is how the linked file is named where it is read, which for a tarball
      // doc is not where it sits here.
      const labels: Array<[number, number]> = [];
      for (const m of line.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        labels.push([m.index + 1, m.index + 1 + (m[1]?.length ?? 0)]);
        checkLink(src, i + 1, m[2] ?? '');
      }
      for (const m of line.matchAll(/`([^`\n]+)`/g)) {
        if (labels.some(([from, to]) => m.index >= from && m.index + m[0].length <= to)) continue;
        checkSpan(src, i + 1, m[1] ?? '');
      }
    }
  }

  // A path git ignores is absent by design — a generated catalog, a working
  // directory that lives only in the main checkout. The tree cannot answer for
  // it, so neither does this check.
  const ignored = gitIgnored(
    ROOT,
    findings.filter((f) => f.kind === 'path').map((f) => f.what)
  );
  const kept = findings.filter((f) => f.kind !== 'path' || !ignored.has(f.what));

  const agents = sources.find((s) => s.display === 'AGENTS.md');
  const words = agents ? agents.text.trim().split(/\s+/).filter(Boolean).length : 0;
  if (agents && words > AGENTS_WORD_BUDGET)
    kept.push({
      file: 'AGENTS.md',
      line: 1,
      kind: 'budget',
      what: `${words} words`,
      why: `over the ${AGENTS_WORD_BUDGET}-word budget every session pays in full`
    });

  for (const [what, why] of ALLOWLIST)
    if (!allowHit.has(what))
      kept.push({
        file: 'scripts/docs-refs-check.ts',
        line: 1,
        kind: 'allowlist',
        what: `'${what}'`,
        why: `stale — no source mentions it any more (${why})`
      });

  kept.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.what.localeCompare(b.what)
  );
  return { sources: sources.length, references, words, findings: kept };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * GitHub's heading slug: lowercase, punctuation dropped except `-`/`_`, spaces
 * → `-`. Inside inline code nothing is HTML, so a heading that names
 * `<BlocksProvider>` keeps those letters — strip the angle brackets there and
 * the anchor the document actually links to reads as broken.
 */
export function slugify(raw: string): string {
  return raw
    .split('`')
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/<[^>]*>/g, '')))
    .join('')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function normalize(token: string): string {
  return token
    .replace(/^[('"`[\]]+/, '')
    .replace(/[)'"`\],;]+$/, '')
    .replace(/\.$/, '')
    .replace(/^\.\//, '');
}

function looksLikePath(t: string): boolean {
  return t.includes('/') && (t.endsWith('/') || /\/[^/]*\.[A-Za-z][A-Za-z0-9]{0,7}$/.test(t));
}

function skippable(t: string): boolean {
  return (
    t === '' ||
    PATTERN_CHARS.test(t) ||
    t.includes('...') ||
    t.includes('://') ||
    t.startsWith('~') ||
    t.startsWith('@') ||
    isAbsolute(t) ||
    // A build artifact is absent by design; the answer must not turn on whether
    // a build ran before the check.
    ARTIFACT.test(t)
  );
}

function splitFragment(target: string): [string, string | null] {
  const i = target.indexOf('#');
  return i === -1 ? [target, null] : [target.slice(0, i), target.slice(i + 1)];
}

/** Asks git, so the ignore rules live in `.gitignore` and not in a second list. */
function gitIgnored(root: string, paths: string[]): Set<string> {
  if (paths.length === 0) return new Set();
  const proc = Bun.spawnSync(['git', '-C', root, 'check-ignore', '--stdin'], {
    stdin: Buffer.from(`${[...new Set(paths)].join('\n')}\n`),
    stdout: 'pipe',
    stderr: 'pipe'
  });
  // 0 = some ignored, 1 = none. Anything else (no repo, no git) answers nothing.
  if (proc.exitCode !== 0 && proc.exitCode !== 1) return new Set();
  return new Set(proc.stdout.toString().split('\n').filter(Boolean));
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const rootArg = argv[argv.indexOf('--root') + 1];
  const root =
    argv.includes('--root') && rootArg ? resolve(rootArg) : resolve(import.meta.dir, '..');
  const result = check(root);

  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    let current = '';
    for (const f of result.findings) {
      if (f.file !== current) {
        current = f.file;
        console.log(`\n${current}`);
      }
      console.log(`  ${f.file}:${f.line}  ${f.kind}  ${f.what}  →  ${f.why}`);
    }
    if (result.words > 0)
      console.log(`\nAGENTS.md: ${result.words} words (budget ${AGENTS_WORD_BUDGET})`);
    console.log(
      `docs-refs-check: ${result.sources} sources, ${result.references} references, ${result.findings.length} findings`
    );
  }
  process.exit(result.findings.length > 0 ? 1 : 0);
}
