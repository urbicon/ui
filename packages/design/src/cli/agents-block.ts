/**
 * The managed `<!-- urbicon:start … urbicon:end -->` context block, shared between
 * `init` (which writes it) and `context` (which checks its freshness).
 *
 * The block lives in ONE of the conventional agent-context files — `AGENTS.md` or
 * `CLAUDE.md`, in whatever casing the project uses. All lookups go through a
 * directory listing instead of exact-path probes, so behaviour is identical on
 * case-insensitive (APFS) and case-sensitive (Linux CI) filesystems: an existing
 * `Agents.md` is updated in place on both, never shadowed by a second file that
 * would only appear once the project hits a case-sensitive checkout.
 */

import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { readTemplate } from './package-root.js';

export const BLOCK_START = '<!-- urbicon:start';
export const BLOCK_END = '<!-- urbicon:end -->';

export const AGENTS_NAME = /^agents\.md$/i;
export const CLAUDE_NAME = /^claude\.md$/i;

/**
 * The version `init` stamps into the start marker (`<!-- urbicon:start v6.48.0 — …`).
 * Blocks written before stamping existed have no match. The stamp is provenance for
 * the staleness *message* — staleness itself is decided by content (see
 * `currentBlockBodies`), never by comparing version numbers.
 */
const VERSION_RE = /<!--\s*urbicon:start\s+v(\d+\.\d+\.\d+(?:[-+][\w.]+)*)/;

/** Insert the CLI version into a template block's start marker. */
export function stampBlockVersion(block: string, version: string): string {
  return block.replace(BLOCK_START, `${BLOCK_START} v${version}`);
}

/** The version a block was written by, or null for pre-stamp blocks. */
export function blockVersion(content: string): string | null {
  return VERSION_RE.exec(content)?.[1] ?? null;
}

/** Remove the version stamp from a block's start marker, for content comparison. */
export function stripBlockStamp(s: string): string {
  return s.replace(/(<!--\s*urbicon:start)\s+v\S+/, '$1');
}

/** The managed region of `content` (markers inclusive), or null when absent/unterminated. */
export function blockRegion(content: string): string | null {
  const start = content.indexOf(BLOCK_START);
  if (start === -1) return null;
  const end = content.indexOf(BLOCK_END, start);
  if (end === -1) return null;
  return content.slice(start, end + BLOCK_END.length);
}

/**
 * The primer step, added to the block on the way into a consumer's AGENTS.md —
 * and deliberately absent from the template itself.
 *
 * Two audiences read the same block, and only one of them can act on this step.
 * An agent inside a tool it does not control (Claude Code, Cursor) has no way to
 * put the primer in its context except by running the command, so it needs the
 * instruction. A harness that owns its system prompt (an `ArtifactFrame`, a chat
 * app) injects the primer's *content* there instead — for it the instruction is
 * not just noise but wrong, since there is nothing left to fetch.
 *
 * Keeping it here rather than in the template means the template stays a clean
 * prompt base that any harness can take verbatim, and neither side carries a
 * sentence that does not apply to it. The earlier attempts were worse: appending
 * "skip step 0" put an instruction and its retraction in one prompt, and phrasing
 * it conditionally ("if it isn't already in your context") made every reader
 * evaluate a condition that is decided long before the model sees it.
 */
const PRIMER_STEP = `0. **Load the primer** — \`bunx urbicon primer\`. How to pick a component plus the token
   reference, in one call. It applies to every task, so fetch it once up front.
`;

/**
 * Where the primer step goes: immediately before the first numbered step of the
 * loop. Anchored on the step's own text, and a missing anchor is a hard failure
 * rather than a silent no-op — a block that quietly lost its primer step would
 * cost the agent ten calls per session with nothing to point at.
 */
const LOOP_FIRST_STEP = '1. **Read the intent**';

/** Insert the primer step into a template block (see PRIMER_STEP). */
export function withPrimerStep(block: string): string {
  const at = block.indexOf(LOOP_FIRST_STEP);
  if (at === -1) {
    throw new Error(
      `the context block template has no "${LOOP_FIRST_STEP}" anchor — cannot place the primer step.`
    );
  }
  return `${block.slice(0, at)}${PRIMER_STEP}${block.slice(at)}`;
}

/**
 * Every body the current template can render to (with and without the primer
 * step), trimmed the way `init` writes them and with no version stamp. Staleness
 * is CONTENT equality against these — never a version-number comparison — for two
 * reasons: this repo bumps one unified version on every release while the template
 * changes rarely, so a version check would nag every session after every patch
 * bump; and a verbatim hand-paste of the current template (which its header
 * explicitly invites) is current despite carrying no stamp. Throws when the
 * template cannot be read (broken install) — callers decide how loud to be.
 */
export async function currentBlockBodies(): Promise<string[]> {
  const template = await readTemplate('AGENTS.md');
  return [template.trim(), withPrimerStep(template).trim()];
}

export interface AgentsFile {
  /** Actual directory-entry name — preserves the project's casing. */
  name: string;
  path: string;
  content: string;
  hasBlock: boolean;
}

/**
 * The agent-context files present in `cwd`, in block-precedence order: every
 * AGENTS.md-cased entry first, then every CLAUDE.md-cased one, each group sorted
 * so the canonical uppercase name wins when a case-sensitive filesystem holds
 * several casings. Unreadable entries (dangling symlink, a directory of that
 * name) are skipped — they cannot carry the block.
 */
export async function scanAgentsFiles(cwd: string): Promise<AgentsFile[]> {
  let entries: string[];
  try {
    entries = await readdir(cwd);
  } catch {
    return [];
  }
  const ranked = [
    ...entries.filter((e) => AGENTS_NAME.test(e)).sort(),
    ...entries.filter((e) => CLAUDE_NAME.test(e)).sort()
  ];
  const files: AgentsFile[] = [];
  for (const name of ranked) {
    const path = join(cwd, name);
    try {
      const content = await readFile(path, 'utf-8');
      files.push({ name, path, content, hasBlock: content.includes(BLOCK_START) });
    } catch {
      // Unreadable — not a candidate.
    }
  }
  return files;
}

/**
 * The one line that actually delivers the block to Claude Code.
 *
 * Measured, not assumed (CLI 2.1.220, a codeword in each file and a prompt that
 * uses no tools): a project holding only `AGENTS.md` gets **nothing** into the
 * model's context — the file is never read unless the agent happens to open it
 * while looking around. `CLAUDE.md` is loaded, and so is `@AGENTS.md` inside it,
 * whose content arrives inlined with no tool call at all. A prose pointer
 * ("the context lives in AGENTS.md") does *not* work: the model has no reason to
 * follow it before it starts working.
 *
 * So the import is the delivery mechanism, and it beats the two alternatives:
 * a second copy of the block would drift the moment one side is refreshed, and a
 * `CLAUDE.md → AGENTS.md` symlink does not survive Windows checkouts. AGENTS.md
 * stays the single source every other tool reads.
 */
export function claudeImportLine(agentsName: string): string {
  return `@${agentsName}`;
}

/** Whether `content` already imports `agentsName` (the delivery, not a mention). */
export function hasClaudeImport(content: string, agentsName: string): boolean {
  const name = agentsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(String.raw`^\s*@(?:\./)?${name}\s*$`, 'im').test(content);
}

/**
 * Whether two paths resolve to the same file (so a `CLAUDE.md → AGENTS.md`
 * symlink does not read as two competing copies). False when either side is
 * unresolvable.
 */
export async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    return (await realpath(a)) === (await realpath(b));
  } catch {
    return false;
  }
}
