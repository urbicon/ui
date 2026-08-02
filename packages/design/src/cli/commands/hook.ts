/**
 * `urbicon hook` — the editor-hook adapter that turns the design gate from "the
 * agent should run it" into "the harness runs it" (DESIGN-MCP-V2 §5.3). Wired as a
 * Claude Code `PostToolUse` hook (matcher `Edit|MultiEdit|Write`), it fires after
 * every file edit; a plain `urbicon validate` cannot, because the hook event
 * arrives as JSON on stdin, not as a path argument.
 *
 * It reads that event, pulls the edited file out of `tool_input.file_path`, and —
 * when the edit touched a `.svelte` file — lints it with the same engine `validate`
 * uses (so hook and CI verdicts agree). Accepts the same gate flags as `validate`
 * (`--strict`, `--craft-floor`, `--skip-heuristics`, `--manifest`).
 *
 * Exit codes follow the Claude Code hook protocol, NOT the CLI's: a gate failure
 * exits **2**, the one code that makes Claude Code feed this process's stderr back
 * to the agent as feedback — so the findings reach the model and it self-corrects
 * (PostToolUse runs after the write, so this prompts a forward fix, it does not
 * undo the edit). Every other path — clean lint, a non-svelte edit, or an event we
 * can't parse — exits 0: a hook must never break the edit flow on a surprise.
 *
 * Why exit-2-plus-stderr over the structured `{"decision":"block"}` JSON output:
 * the exit-code contract is the older, more stable surface (the hook JSON schema
 * has already grown `hookSpecificOutput`/`additionalContext`/`if`), it needs no
 * schema coupling, and it degrades sensibly when the command is run outside a hook
 * (a manual `cat event.json | urbicon hook` still signals failure correctly).
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { LintReport } from '@urbicon-ui/design-engine/linter';
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { evaluateGate, parseCraftFloor } from '../gate.js';
import {
  exemptRulesFor,
  readExempts,
  readTokenOverrides,
  resolveManifestPath
} from '../manifest-io.js';
import { EXIT, formatReport, printError } from '../output.js';
import { findShapeDecision } from '../shape-decision.js';

/** The code that makes Claude Code surface this process's stderr to the agent. */
const HOOK_BLOCK = 2;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Pull the edited file path out of a PostToolUse event, tolerant of shape drift.
 * Edit, Write, and MultiEdit all expose the path at `tool_input.file_path`; reading
 * that one field (rather than switching on `tool_name`) keeps the adapter working
 * if the tool set grows. Returns `[]` for any event shape without a string path.
 */
function editedPaths(event: unknown): string[] {
  if (typeof event !== 'object' || event === null) return [];
  const input = (event as { tool_input?: unknown }).tool_input;
  if (typeof input !== 'object' || input === null) return [];
  const fp = (input as { file_path?: unknown }).file_path;
  return typeof fp === 'string' && fp.length > 0 ? [fp] : [];
}

export async function runHook(_positionals: string[], flags: Flags): Promise<number> {
  const craftFloor = parseCraftFloor(flags['craft-floor']);
  if (craftFloor === 'invalid') {
    // A misconfigured hook command — surface it loudly (it fails on the first edit,
    // so the consumer fixes the wiring immediately) rather than gating on nothing.
    printError('--craft-floor needs an integer between 0 and 100, e.g. --craft-floor 40');
    return EXIT.USAGE;
  }

  let event: unknown;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    return EXIT.OK; // not a hook event we understand — never block the edit flow
  }

  const paths = editedPaths(event).filter((p) => p.endsWith('.svelte'));
  if (paths.length === 0) return EXIT.OK; // nothing svelte was edited

  const manifestPath = resolveManifestPath(stringFlag(flags, 'manifest'));
  const extraTokens = await readTokenOverrides(manifestPath);
  const exempts = await readExempts(manifestPath);
  const strict = boolFlag(flags, 'strict');
  const skipHeuristics = boolFlag(flags, 'skip-heuristics');
  // Same project-side resolution as `validate`: a shape decision taken at the tier
  // level lives in a stylesheet, and the edited `.svelte` file cannot see it. This
  // is the path that runs on *every* edit, so a false nudge here is the loudest one.
  const shapeDecided = skipHeuristics
    ? false
    : (await findShapeDecision(dirname(manifestPath))) !== null;

  const reports = [];
  for (const p of paths) {
    const abs = resolve(p);
    let code: string;
    try {
      code = await readFile(abs, 'utf-8');
    } catch {
      continue; // the file vanished between the edit and the hook — skip it
    }
    reports.push(
      lintDesign(code, {
        filename: p,
        skipHeuristics,
        extraTokens,
        shapeDecided,
        suppressRules: exemptRulesFor(abs, manifestPath, exempts)
      })
    );
  }
  if (reports.length === 0) return EXIT.OK;

  const gate = evaluateGate(reports, { strict, craftFloor });
  if (!gate.failed) return EXIT.OK; // silent on success — no noise on every clean edit

  // Block: write only the failing files' findings to stderr (a PostToolUse event
  // carries one edit today, but keep the feedback tight if it ever carries more —
  // never dump a clean "✓ no issues" report at the agent).
  const blocking = (r: LintReport): boolean =>
    r.counts.error > 0 ||
    (strict && r.counts.warning > 0) ||
    (craftFloor !== null && r.scores.craft < craftFloor);
  for (const report of reports.filter(blocking)) console.error(formatReport(report));
  if (gate.craftBreaches.length > 0) {
    console.error(
      `\nBelow the craft floor (${craftFloor}): ` +
        gate.craftBreaches.map((b) => `${b.label} (${b.craft}/100)`).join(', ')
    );
  }
  console.error('\nFix the issues above and re-save. — urbicon design gate');
  return HOOK_BLOCK;
}
