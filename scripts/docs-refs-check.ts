#!/usr/bin/env bun
/**
 * docs-refs-check — does every reference the instruction docs make still
 * resolve, and does any tracked file point where nobody else can follow? Five
 * systems answer, never a model of them:
 *
 *   1. `package.json` — for every `bun run <name>` span the root scripts, for
 *      every `bun --filter='<pkg>' run <name>` that package's.
 *   2. the file tree — for every backtick span shaped like a repo path and for
 *      every `file.ts:123` pointer. `git check-ignore` decides the one case the
 *      tree cannot: a path that is absent by design (a generated catalog, a
 *      built `dist/`) is unverifiable, not broken.
 *   3. the sources — `packages/*` and `apps/*` src+scripts, `scripts`,
 *      `.github`, the root configs — word-boundary-grepped for every
 *      `UPPER_SNAKE_CASE` span, so a deleted constant stops being documented as
 *      an exemption an agent then looks for.
 *   4. the target document's headings, slugified the way GitHub does, for every
 *      `[…](file.md#anchor)` link.
 *   5. git's index — `git ls-files` — for every tracked file, code included,
 *      that names a path *below* a `PRIVATE_DIRS` entry: the maintainer's
 *      private working directories, each listed there with its reason. They
 *      are never generated and never published, so for them rule 2's "absent
 *      by design" flips into "dead for everyone but the maintainer" — and a
 *      pointer in a comment ships with the tarball as readily as one in a doc.
 *      The index decides what is published: a pointer to a file git tracks
 *      there is fine, anything else is a finding. The bare folder name and a
 *      placeholder are not pointers (`privateTarget`), and `UNSCANNED` lists
 *      the kinds of tracked file this rule does not read, one reason each. A
 *      checkout whose index git cannot read exits 2 rather than passing on
 *      zero files.
 *
 * It owns existence and nothing else. A path that exists but is the wrong one,
 * a count that has drifted, two docs that contradict each other, a rule that no
 * longer holds: all of that is the review's, and a green run says nothing about
 * it. The split is worth having because the existence half is the half that
 * rots on every rename, and it needs no reader.
 *
 * Rules 1–4 extract narrowly, because a false positive is paid for in
 * exemptions: inline code spans only (never fenced blocks), a path only when
 * the span carries a `/` and ends in `/` or an alphabetic extension, and never
 * a span carrying `*`, `<`, `>`, `{`, `}`, `…`, `$`, `?`, `|` or `...` — a
 * pattern or a placeholder is not a claim that a file exists. A span inside a
 * link's label is skipped too: the target is the claim, the label only names
 * it. Rule 5 reads every line, fences and comments included: a path below a
 * private directory is a pointer wherever it is written.
 *
 * The docs name a file by as much of its path as identifies it
 * (`Tab/tab.context.ts`), so a token is resolved against the root, the
 * document's own directory, its package, and finally as a path tail. A token
 * whose FIRST segment is a real top-level directory is a root-anchored claim
 * and gets no tail — that is what keeps `scripts/imports-lint.ts` a finding
 * while the file sits in `packages/blocks/scripts/`.
 *
 * The tail is a weaker question than it looks: 107 of the references resolve
 * only that way, and 19 of those match more than one file (`src/index.ts`,
 * `examples/Basic.svelte`, `__fixtures__/`). This says such a file exists, not
 * that the document points at the right one — which one is the review's.
 *
 * It also indexes the tree that is on disk, so a built tree can answer "exists"
 * where an unbuilt one has only `git check-ignore`'s "absent by design". The
 * `lint` job runs it without a build, and that is the run whose answer counts;
 * a local run after a build is the more permissive of the two.
 *
 * `ALLOWLIST` exempts a reference by its literal text, one reason per entry.
 * Like `packages/blocks/scripts/imports-lint.ts` it errors on an entry that has
 * gone stale, and unlike it, stale means "no source mentions the text" rather
 * than "suppressed no finding": the findings an entry suppresses depend on a
 * tree this check does not control (a built `dist/`, a `docs/internal/` that
 * exists only in the main checkout), and a list that flips with that is worse
 * than none. The cost is that an entry can go inert without being stale, so
 * this file is excluded from the identifier grep below — otherwise the entry
 * naming a constant would itself be the source that constant is found in.
 *
 * Run: `bun run docs:refs:check` — no build needed. `--root <dir>` points it at
 * another tree, `--json` prints findings as JSON. Exit 1 on any finding, 2 on
 * a malformed argument or a checkout whose index git cannot read.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Glob } from 'bun';

/**
 * AGENTS.md is read in full by every session, so its length is a cost every
 * session pays. The budget is set one Commands bullet above the file as it was
 * when the check landed: a new entry is meant to cost the removal of another.
 */
export const AGENTS_WORD_BUDGET = 3400;

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
  ],
  [
    'prototypes/artifact-frame/serve.ts',
    'a port-in-use error of the private, local-only artifact studio: whoever reads it runs the checkout that holds prototypes/'
  ]
];

export type Kind = 'script' | 'path' | 'ident' | 'link' | 'private' | 'budget' | 'allowlist';

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
  /** Tracked files rule 5 read — 0 outside a git checkout, which is how a blind run shows. */
  tracked: number;
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

/** Plain code-unit order: the output is a diff, not a listing for a reader. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const PATTERN_CHARS = /[*<>{}…$?|]/;
const IDENT = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const FILE_LINE = /^(.+?):(\d+)(?:-(\d+))?$/;
const EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,7}$/;
const ARTIFACT = /(^|\/)(node_modules|dist|\.svelte-kit)(\/|$)/;
const SKIP_DIR = /(^|\/)(node_modules|dist|\.svelte-kit|\.git|build|coverage|test-results)(\/|$)/;
const BINARY =
  /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|zip|gz|tgz|svg|lock)$/i;

/**
 * The maintainer's private working directories (rule 5), one reason each. Not
 * derivable from `.gitignore`: it also ignores what a build regenerates
 * (`dist/`, the catalogs), and a pointer there comes back with the next build.
 */
export const PRIVATE_DIRS: ReadonlyArray<readonly [dir: string, why: string]> = [
  ['docs/internal/', 'planning and review working docs, git-ignored'],
  ['docs/archive/', 'the retired archive; its documents moved under docs/internal/'],
  ['prototypes/', 'throwaway spikes and their findings, git-ignored']
];

/**
 * A token starting with one of `PRIVATE_DIRS`, optionally behind `./` or `../`:
 * group 1 the token, group 2 the directory. The lookbehind keeps
 * `apps/docs/internal/…` out; the token runs to whitespace, a quote or a
 * bracket, and what it may not be is decided after the match (`privateTarget`).
 */
const PRIVATE_POINTER = new RegExp(
  `(?<![\\w./-])(?:\\.{1,2}/)*((${PRIVATE_DIRS.map(([dir]) => dir.replace(/[.*+?^$|()[\]{}\\/]/g, '\\$&')).join('|')})[^\\s\`'"()<>[\\]{},;|]*)`,
  'g'
);

/** A placeholder or a pattern, as in rules 1–4 — `→` because prose points with it. */
const PLACEHOLDER = /[*<>{}…$?|→]|\.\.\./;

/**
 * The path a rule-5 token names, or null when it names none: sentence
 * punctuation, a `#anchor` and a `:line` suffix come off first, so a pointer
 * into a tracked file is looked up as that file. The bare directory, a
 * placeholder (`docs/internal/…`, `$FILE`) and a compound written onto the
 * folder name (`docs/internal/-Dokumente`) are not pointers.
 */
function privateTarget(token: string, dir: string): string | null {
  const target = token
    .replace(/[.,;:!?]+$/, '')
    .replace(/#.*$/, '')
    .replace(/:\d+(?:-\d+)?(?::\d+)?$/, '');
  const below = target.slice(dir.length);
  if (below === '' || below.startsWith('-') || PLACEHOLDER.test(target)) return null;
  return target;
}

/** The environment cannot answer — exit 2, like a malformed argument, never a clean run. */
export class EnvironmentError extends Error {}

/**
 * Tracked files rule 5 does not read, one reason each. A pattern names a kind of
 * file rather than suppressing a finding, so unlike `ALLOWLIST` it has no stale
 * state to report.
 */
export const UNSCANNED: ReadonlyArray<readonly [pattern: RegExp, why: string]> = [
  [/^CHANGELOG\.md$/, 'git-cliff writes it from commit messages; it is never edited by hand'],
  [/(^|\/)\.gitignore$/, 'the ignore rules name the private directories to keep them out'],
  [/^bun\.lock$/, 'a lockfile, not prose']
];

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
    sources.sort((a, b) => cmp(a.display, b.display));
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
    // Never this file: the ALLOWLIST quotes the identifiers it exempts, so a
    // grep that read it would find every exempted constant here and the entry
    // would exempt itself. (Outside ROOT this resolves to `../…` and matches
    // nothing, which is right for a fixture root; a second checkout of this repo would
    // read its own copy of this file and re-open the loop.)
    const self = relative(ROOT, import.meta.path);
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const pattern of CORPUS_GLOBS)
      for (const p of new Glob(pattern).scanSync({ cwd: ROOT, onlyFiles: true, dot: true })) {
        if (p === self || SKIP_DIR.test(p) || BINARY.test(p) || seen.has(p)) continue;
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

  const tailHits = (token: string): string[] => {
    const isDir = token.endsWith('/');
    const t = token.replace(/\/+$/, '');
    if (t === '') return [];
    const map = isDir ? treeIndex().dirs : treeIndex().files;
    return (map.get(basename(t)) ?? []).filter((p) => p === t || p.endsWith(`/${t}`));
  };

  const lineCounts = new Map<string, number>();
  const lineCount = (file: string): number => {
    const hit = lineCounts.get(file);
    if (hit !== undefined) return hit;
    let n = 0;
    try {
      n = readFileSync(file, 'utf-8').split('\n').length;
    } catch {
      /* unreadable — no number to disagree with */
    }
    lineCounts.set(file, n);
    return n;
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

  const reportAt = (file: string, line: number, kind: Kind, what: string, why: string) => {
    if (allow.has(what)) {
      allowHit.add(what);
      return;
    }
    findings.push({ file, line, kind, what, why });
  };
  const report = (src: Source, line: number, kind: Kind, what: string, why: string) =>
    reportAt(src.display, line, kind, what, why);

  const checkPathLike = (src: Source, line: number, token: string) => {
    const bases = [ROOT, src.dir];
    if (src.pkg && /^(src|scripts|docs)\//.test(token)) bases.push(src.pkg);
    for (const base of bases) if (existsSync(resolve(base, token))) return;
    if (isRootAnchored(token))
      report(src, line, 'path', token, `no such file at the repo root or under ${rel(src.dir)}`);
    else if (tailHits(token).length === 0)
      report(src, line, 'path', token, 'no file with that path tail anywhere in the tree');
  };

  /**
   * The single file a `file.ts:12` pointer names, or null. Only a unique answer
   * counts: `src/index.ts:40` matches nine files, and no line number is a claim
   * about all of them.
   */
  const pointerTarget = (src: Source, file: string): string | null => {
    const bases = [ROOT, src.dir];
    if (src.pkg && /^(src|scripts|docs)\//.test(file)) bases.push(src.pkg);
    for (const base of bases) {
      const abs = resolve(base, file);
      if (existsSync(abs)) return abs;
    }
    const hits = file.includes('/') ? tailHits(file) : (treeIndex().files.get(file) ?? []);
    return hits.length === 1 && hits[0] ? join(ROOT, hits[0]) : null;
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
      /\bbun\s+(?:--bun\s+)?--filter=['"]?([^'"\s]+)['"]?(?:\s+--bun)?\s+run\s+([A-Za-z0-9:_.-]+)(?![<>{}*?$|/\w:.-])/g
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
      /\bbun\s+(?:--bun\s+)?run\s+([A-Za-z0-9:_.-]+)(?![<>{}*?$|/\w:.-])/g
    )) {
      const name = m[1] ?? '';
      // `bun run scripts/foo.ts` never gets here — the lookahead rejects the
      // `/`. `bun run foo.ts` does, and names a file rather than a script.
      // Both are rule 2's.
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
        else if (!treeIndex().files.has(file)) {
          report(src, line, 'path', file, 'no file of that name in the tree');
          continue;
        }
        // The line half of the pointer, where the tree names one file: a
        // pointer into a file that has since been cut short is as dead as one
        // into a file that is gone.
        const target = pointerTarget(src, file);
        const wanted = Number(pointer[3] ?? pointer[2]);
        const lines = target ? lineCount(target) : 0;
        if (lines > 0 && wanted > lines)
          report(src, line, 'path', token, `${rel(target ?? '')} has ${lines} lines`);
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

  // 5 — private pointers, in every tracked file rather than the doc sources.
  // A checkout whose index git cannot read would otherwise pass with "0 tracked
  // files"; only a root that is no checkout at all (a fixture) may answer empty.
  const index = gitTracked(ROOT);
  if (index === null && existsSync(join(ROOT, '.git')))
    throw new EnvironmentError(`git ls-files failed in ${ROOT} — rule 5 cannot read the index`);
  const tracked = index ?? new Set<string>();
  const published = (target: string): boolean => {
    if (tracked.has(target)) return true;
    const dir = target.endsWith('/') ? target : `${target}/`;
    for (const p of tracked) if (p.startsWith(dir)) return true;
    return false;
  };
  // Never this file or its test: the pattern and the positive controls spell out
  // the very pointers they look for. (Outside ROOT both resolve to `../…` and
  // match nothing, which is right for a fixture root.)
  const own = new Set([
    relative(ROOT, import.meta.path),
    relative(ROOT, join(import.meta.dir, 'docs-refs-check.test.ts'))
  ]);
  let scanned = 0;
  for (const path of [...tracked].sort(cmp)) {
    if (own.has(path) || BINARY.test(path) || UNSCANNED.some(([re]) => re.test(path))) continue;
    const abs = join(ROOT, path);
    let text: string;
    try {
      // A tracked symlink is a doc whose target git tracks on its own; reading
      // both would report every pointer twice.
      if (lstatSync(abs).isSymbolicLink()) continue;
      text = readFileSync(abs, 'utf-8');
    } catch {
      continue; // deleted in the worktree, still in the index
    }
    if (text.includes('\0')) continue;
    scanned++;
    for (const [i, line] of text.split('\n').entries())
      for (const m of line.matchAll(PRIVATE_POINTER)) {
        const dir = m[2] ?? '';
        const target = privateTarget(m[1] ?? '', dir);
        if (target === null) continue;
        seenRef(target);
        if (!published(target))
          reportAt(
            path,
            i + 1,
            'private',
            target,
            `below ${dir}, which git does not track — it resolves for nobody but the maintainer`
          );
      }
  }

  // A path git ignores is absent by design — a generated catalog, a working
  // directory that lives only in the main checkout. The tree cannot answer for
  // it, so neither does this check.
  const ignored = gitIgnored(
    ROOT,
    findings.filter((f) => f.kind === 'path').map((f) => f.what)
  );
  // Rule 5 owns a path below a private directory: where it reported one, the
  // `path`/`link` finding rules 2 and 4 raised at the same line is the same
  // pointer a second time.
  const privateAt = new Set(
    findings.filter((f) => f.kind === 'private').map((f) => `${f.file}:${f.line}`)
  );
  const kept = findings.filter(
    (f) =>
      !(f.kind === 'path' && ignored.has(f.what)) &&
      !(
        (f.kind === 'path' || f.kind === 'link') &&
        privateAt.has(`${f.file}:${f.line}`) &&
        PRIVATE_DIRS.some(([dir]) => f.what.replace(/^(?:\.{1,2}\/)+/, '').startsWith(dir))
      )
  );

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

  kept.sort((a, b) => cmp(a.file, b.file) || a.line - b.line || cmp(a.what, b.what));
  return { sources: sources.length, references, tracked: scanned, words, findings: kept };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * GitHub's heading slug: lowercase, punctuation dropped except `-`/`_`, spaces
 * → `-`. Inside inline code nothing is HTML, so a heading that names
 * `<BlocksProvider>` keeps those letters — strip the angle brackets there and
 * the anchor the document actually links to reads as broken.
 */
/** Drops `<…>` runs until none is left, so a nested `<<b>>` cannot survive one pass. */
function stripTags(text: string): string {
  let out = text;
  for (;;) {
    const next = out.replace(/<[^>]*>/g, '');
    if (next === out) return out;
    out = next;
  }
}

export function slugify(raw: string): string {
  return raw
    .split('`')
    .map((part, i) => (i % 2 === 1 ? part : stripTags(part)))
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

/**
 * The files git tracks — what the repo publishes — or null when git cannot say
 * (no checkout, no git, a broken `GIT_DIR`). The caller decides which of those
 * is an error.
 */
function gitTracked(root: string): Set<string> | null {
  try {
    const proc = Bun.spawnSync(['git', '-C', root, 'ls-files', '-z'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    if (proc.exitCode !== 0) return null;
    return new Set(proc.stdout.toString().split('\0').filter(Boolean));
  } catch {
    return null; // no git binary at all
  }
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
  const at = argv.indexOf('--root');
  const given = at === -1 ? null : argv[at + 1];
  // Explicit over a fallback: `--root` with nothing behind it, or with the next
  // flag, would otherwise check the repo and report a clean tree for one the
  // caller never named.
  if (at !== -1 && (!given || given.startsWith('--'))) {
    console.error('docs-refs-check: --root needs a directory');
    process.exit(2);
  }
  let result: Report;
  try {
    result = check(given ? resolve(given) : resolve(import.meta.dir, '..'));
  } catch (error) {
    if (!(error instanceof EnvironmentError)) throw error;
    console.error(`docs-refs-check: ${error.message}`);
    process.exit(2);
  }

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
      `docs-refs-check: ${result.sources} sources, ${result.references} references, ${result.tracked} tracked files, ${result.findings.length} findings`
    );
  }
  process.exit(result.findings.length > 0 ? 1 : 0);
}
