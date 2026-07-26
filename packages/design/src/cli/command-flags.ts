/**
 * Which flags each command accepts — the table the CLI validates every invocation
 * against, so an unknown flag is a usage error instead of a silent no-op.
 *
 * Why this exists: the parser in `args.ts` is a generic flag bag with no notion of
 * *which* flags a command has, so `urbicon icons --query moon` used to drop the
 * unknown `--query` without a word and print the full 13.6 kB icon reference — a
 * plausible, well-formed answer to a question nobody asked. A human re-reads the
 * usage line; an agent cannot tell that from a result. Measured in the recorded
 * consumer-path run (`prototypes/artifact-frame`, 2026-07-26): three `--query`
 * calls, three identical full listings, ~41 kB of context spent on nothing.
 *
 * The table is the source of truth for validation only — `help.ts` still authors
 * the prose. `command-flags.test.ts` diffs the two so neither can drift silently
 * (it already caught `i18n --function-names` / `--runtime-usage` shipping
 * undocumented).
 */

import { BOOLEAN_FLAGS } from './args.js';

/** Flags handled before dispatch, valid on every command. */
export const GLOBAL_FLAGS: readonly string[] = ['help', 'version'];

/**
 * Command → the flags it reads. Derived from the command bodies, not from the
 * help text: a flag that no code path reads is not accepted, however plausible.
 */
export const COMMAND_FLAGS: Readonly<Record<string, readonly string[]>> = {
  init: ['hook', 'ci', 'agents-file', 'manifest'],
  validate: ['json', 'strict', 'slop-floor', 'skip-heuristics', 'record', 'manifest'],
  hook: ['strict', 'slop-floor', 'skip-heuristics', 'manifest'],
  find: ['json', 'limit', 'tag', 'query'],
  'get-component': ['section'],
  pattern: ['json'],
  principles: ['topic', 'rubric'],
  'css-reference': [],
  icons: ['json', 'limit', 'query'],
  recipe: ['json'],
  guide: ['json'],
  context: ['json', 'manifest'],
  'record-decision': ['title', 'decision', 'rationale', 'status', 'date', 'manifest'],
  'sync-manifest': ['json', 'manifest', 'src'],
  i18n: [
    'json',
    'strict',
    'config',
    'base-locale',
    'runtime-usage',
    'function-names',
    'dynamic-keys',
    'ignore-keys',
    'ignore-strings',
    'translations'
  ],
  verbs: [],
  verb: [],
  help: [],
  version: []
};

/**
 * Commands whose leading positional may also be written as `--query <value>`.
 *
 * Not sugar: both recorded agent runs reached for the named form first
 * (`icons --query moon`, `find --query combobox`), because that is how tool
 * arguments look everywhere else. Accepting it costs one table entry; rejecting
 * it costs the agent a round-trip it cannot diagnose. Kept to the two discovery
 * commands that genuinely take a free-text query — `get-component <slug>` and
 * `verb <name>` take an identifier, where guessing a name is the actual mistake.
 */
export const QUERY_ALIAS_COMMANDS: readonly string[] = ['find', 'icons'];

/** Levenshtein distance, capped implicitly by the short strings involved. */
function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const curr = [i, ...Array<number>(cols - 1).fill(0)];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[cols - 1] ?? 0;
}

/**
 * The closest accepted flag to `unknown`, if one is near enough to be a typo.
 * The threshold scales with length so `--ci` can't "mean" `--hook`, while
 * `--skip-heuristic` still resolves to `--skip-heuristics`.
 */
function nearest(unknown: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distance(unknown, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  const limit = Math.max(1, Math.floor(Math.max(unknown.length, best?.length ?? 0) / 3));
  return best !== undefined && bestDistance <= limit ? best : undefined;
}

export type FlagCheck = { ok: true; positionals: string[] } | { ok: false; message: string };

/**
 * A value flag given as bare `--key`. `stringFlag` returns undefined for a
 * boolean, so every such call quietly used its default — `urbicon icons --limit`
 * printed 20 results as if no flag had been passed. Same silent-answer failure as
 * an unknown flag, so it gets the same treatment.
 */
function missingValue(command: string, name: string, value: string | boolean): string | undefined {
  if (value !== true || BOOLEAN_FLAGS.has(name)) return undefined;
  return `--${name} needs a value, e.g. \`urbicon ${command} --${name} <value>\`.`;
}

/**
 * Reject flags the command does not read, and fold a `--query` alias into the
 * positionals. Returns the positionals the command should actually run with.
 *
 * Unknown *commands* are not this function's business — `index.ts` reports those
 * against the full command list.
 */
export function checkFlags(
  command: string,
  flags: Record<string, string | boolean>,
  positionals: string[]
): FlagCheck {
  const own = COMMAND_FLAGS[command];
  if (own === undefined) return { ok: true, positionals };

  const accepted = [...own, ...GLOBAL_FLAGS];
  for (const [name, value] of Object.entries(flags)) {
    if (accepted.includes(name)) {
      const message = missingValue(command, name, value);
      if (message) return { ok: false, message };
      continue;
    }

    const suggestion = nearest(name, accepted);
    const takesQuery = QUERY_ALIAS_COMMANDS.includes(command);
    const hint = suggestion
      ? ` Did you mean --${suggestion}?`
      : takesQuery
        ? ` The query is positional: \`urbicon ${command} <query>\`.`
        : '';
    const list = own.length
      ? `Accepted flags: ${own.map((f) => `--${f}`).join(', ')}.`
      : `\`${command}\` takes no flags.`;
    return {
      ok: false,
      message: `unknown flag "--${name}" for \`${command}\`.${hint}\n  ${list}`
    };
  }

  // `--query` names the positional the command already takes. Two spellings of
  // one argument in one call is ambiguous, so it is an error rather than a
  // precedence rule nobody can remember.
  const query = flags.query;
  if (typeof query === 'string' && QUERY_ALIAS_COMMANDS.includes(command)) {
    if (positionals.length > 0) {
      return {
        ok: false,
        message:
          `\`${command}\` got a query twice — --query "${query}" and the positional ` +
          `"${positionals.join(' ')}". Pass it once.`
      };
    }
    return { ok: true, positionals: [query] };
  }

  return { ok: true, positionals };
}
