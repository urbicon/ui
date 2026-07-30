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
import { checkFlags, checkPositionals } from './command-flags.js';
import { runContext } from './commands/context.js';
import { runCssReference } from './commands/css-reference.js';
import { runFind } from './commands/find.js';
import { runGetComponent } from './commands/get-component.js';
import { runGuide } from './commands/guide.js';
import { runHook } from './commands/hook.js';
import { runI18n } from './commands/i18n.js';
import { runIcons } from './commands/icons.js';
import { runInit } from './commands/init.js';
import { runPattern } from './commands/pattern.js';
import { runPrimer } from './commands/primer.js';
import { runPrinciples } from './commands/principles.js';
import { runRecipe } from './commands/recipe.js';
import { runRecordDecision } from './commands/record-decision.js';
import { runSyncManifest } from './commands/sync-manifest.js';
import { runValidate } from './commands/validate.js';
import { runVerb, runVerbList } from './commands/verb.js';
import { commandHelp, HELP } from './help.js';
import { EXIT, printError } from './output.js';
import { findPackageRoot } from './package-root.js';

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
  const { command, positionals: rawPositionals, flags } = parseArgs(argv);

  if (flags.version === true || command === 'version') {
    console.log(await readVersion());
    return EXIT.OK;
  }
  // `urbicon <command> --help` answers about that command; the full page is for
  // `urbicon`, `urbicon help` and `urbicon --help`. An unknown command still fails
  // loud rather than being consoled with the whole page.
  if (flags.help === true && command !== undefined && command !== 'help') {
    const section = commandHelp(command);
    if (section === undefined) {
      printError(`unknown command "${command}"`);
      console.log(`\n${HELP}`);
      return EXIT.USAGE;
    }
    console.log(section);
    return EXIT.OK;
  }
  if (command === undefined || command === 'help' || flags.help === true) {
    // `urbicon help <command>` is the same question as `urbicon <command> --help`
    // and used to get the same wrong answer: the whole 9.5 kB page.
    const topic = command === 'help' ? rawPositionals[0] : undefined;
    if (topic !== undefined) {
      const section = commandHelp(topic);
      if (section === undefined) {
        printError(`unknown command "${topic}"`);
        console.log(`\n${HELP}`);
        return EXIT.USAGE;
      }
      console.log(section);
      return EXIT.OK;
    }
    console.log(HELP);
    return EXIT.OK;
  }

  // Reject flags this command does not read, before it can answer a question
  // nobody asked (see command-flags.ts). Also folds a `--query` alias into the
  // positionals, so the commands below never learn about it.
  const check = checkFlags(command, flags, rawPositionals);
  if (!check.ok) {
    printError(check.message);
    return EXIT.USAGE;
  }
  const positionals = check.positionals;

  // Same for positionals a command does not read — `sync-manifest src` used to
  // scan the default tree and report success.
  const arity = checkPositionals(command, positionals);
  if (!arity.ok) {
    printError(arity.message);
    return EXIT.USAGE;
  }

  switch (command) {
    case 'init':
      return runInit(positionals, flags);
    case 'validate':
      return runValidate(positionals, flags);
    case 'hook':
      return runHook(positionals, flags);
    case 'find':
      return runFind(positionals, flags);
    case 'get-component':
      return runGetComponent(positionals, flags);
    case 'primer':
      return runPrimer(positionals, flags);
    case 'pattern':
      return runPattern(positionals, flags);
    case 'principles':
      return runPrinciples(positionals, flags);
    case 'css-reference':
      return runCssReference(positionals, flags);
    case 'icons':
      return runIcons(positionals, flags);
    case 'recipe':
      return runRecipe(positionals, flags);
    case 'guide':
      return runGuide(positionals, flags);
    case 'context':
      return runContext(positionals, flags);
    case 'record-decision':
      return runRecordDecision(positionals, flags);
    case 'sync-manifest':
      return runSyncManifest(positionals, flags);
    case 'i18n':
      return runI18n(positionals, flags);
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
