#!/usr/bin/env node
/**
 * `urbicon` — the version-pinned design CLI for projects built with Urbicon UI.
 *
 * One engine (`@urbicon-ui/design-engine`), three entry points: this CLI, the
 * remote MCP adapter, and editor/CI hooks. The CLI is the local, version-correct
 * path (the knowledge is the installed library version) and the home of the
 * filesystem operations a stateless remote server structurally cannot do.
 * See docs/internal/DESIGN-MCP-V2.md.
 *
 * Bundled to `dist/cli.js` (Node-runnable, shebang preserved) so consumers need
 * no Bun. In the monorepo, run the TypeScript source directly via `bun run`.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from './args.js';
import { runContext } from './commands/context.js';
import { runFind } from './commands/find.js';
import { runGetComponent } from './commands/get-component.js';
import { runHook } from './commands/hook.js';
import { runRecordDecision } from './commands/record-decision.js';
import { runSyncManifest } from './commands/sync-manifest.js';
import { runValidate } from './commands/validate.js';
import { runVerb, runVerbList } from './commands/verb.js';
import { EXIT, printError } from './output.js';
import { findPackageRoot } from './package-root.js';

const HELP = `urbicon — design validation & manifest tooling for Urbicon UI projects

Usage:
  urbicon <command> [options]

Commands:
  validate [paths...]   Lint .svelte markup against the Urbicon UI design rules.
                        Paths may be files, directories, or "-" (stdin).
                        Reads ## Token Overrides from the manifest (if any) so your
                        project's own tokens are not flagged as hallucinated.
                        --json             Machine-readable report ({ ok, slopFloor, results }).
                        --strict           Fail on warnings too, not just errors.
                        --slop-floor <n>   Also fail any file scoring below n/100 on the
                                           slop axis (0–100; off by default — slop is advisory).
                        --skip-heuristics  Deterministic rules only (no distribution notes).
                        --record           Append a drift entry to the sidecar history (CI).
                        --manifest <path>  Manifest for token overrides + history
                                           (default ./design.manifest.md).
  hook                  Editor-hook adapter: read a Claude Code PostToolUse event on
                        stdin, validate the edited .svelte file, and exit 2 with the
                        findings on stderr so the agent self-corrects. Takes the same
                        gate flags as validate (--strict, --slop-floor, --manifest).
                        Wire it via .claude/settings.json (see templates/).
  find [query]          Discover components by fuzzy search over the version-pinned
                        catalog (names, tags, descriptions). No query lists all.
                        --tag <t>          Filter by category tag (form, action, …).
                        --limit <n>        Max results for a query (default 10).
                        --json             Machine-readable catalog entries.
  get-component <slug>  Print a component's API (its llm.txt) from the bundle.
                        --section <s>      overview | examples | variants | api | slots |
                                           full (default: full).
  context               Print the project's design.manifest.md summary.
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the parsed manifest as JSON.
  record-decision       Append an ADR to the manifest.
                        --title <t>        (required) Short decision title.
                        --decision <d>     (required) What was decided.
                        --rationale <r>    Why — the trade-off.
                        --status <s>       accepted | proposed | superseded (default accepted).
                        --date <date>      Decision date, YYYY-MM-DD (default today).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
  sync-manifest         Re-index data-design-pattern markers into the manifest.
                        --src <dir>        Source tree to scan (default ./src).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the scan result as JSON.
  verbs                 List the design verbs (recipes over the design loop).
  verb <name>           Print one verb recipe, e.g. "urbicon verb compose".
  help                  Show this help.

Exit codes:
  0  ok (clean, or only warnings/notes)
  1  failed — validate found errors (--strict: warnings too), or a command could not complete
  2  usage error — bad flags / unreadable input

Examples:
  urbicon validate src/                          # CI: lint a whole tree
  urbicon validate src/ --slop-floor 40 --json   # CI: gate correctness + slop
  urbicon validate App.svelte --strict           # fail on warnings too
  cat Page.svelte | urbicon validate -           # lint stdin
  urbicon record-decision --title "Tabs for settings" --decision "Use Tab over Sidebar"
`;

/** Read this package's own version from its package.json (works from src/ and dist/). */
async function readVersion(): Promise<string> {
  const root = await findPackageRoot();
  if (!root) return 'unknown';
  try {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main(argv: string[]): Promise<number> {
  const { command, positionals, flags } = parseArgs(argv);

  if (flags.version === true || command === 'version') {
    console.log(await readVersion());
    return EXIT.OK;
  }
  if (command === undefined || command === 'help' || flags.help === true) {
    console.log(HELP);
    return EXIT.OK;
  }

  switch (command) {
    case 'validate':
      return runValidate(positionals, flags);
    case 'hook':
      return runHook(positionals, flags);
    case 'find':
      return runFind(positionals, flags);
    case 'get-component':
      return runGetComponent(positionals, flags);
    case 'context':
      return runContext(positionals, flags);
    case 'record-decision':
      return runRecordDecision(positionals, flags);
    case 'sync-manifest':
      return runSyncManifest(positionals, flags);
    case 'verbs':
      return runVerbList(positionals, flags);
    case 'verb':
      return runVerb(positionals, flags);
    default:
      printError(`unknown command "${command}"`);
      console.log(`\n${HELP}`);
      return EXIT.USAGE;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    // Recognised usage mistakes are handled (exit 2) inside the command bodies;
    // reaching here means an unexpected failure, so exit 1 ("could not complete"),
    // never 2 — a crash is not a usage error.
    printError(err instanceof Error ? err.message : String(err));
    process.exit(EXIT.FAIL);
  });
