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
  init: ['hook', 'ci', 'agents-file', 'manifest', 'with-primer'],
  validate: ['json', 'strict', 'craft-floor', 'skip-heuristics', 'record', 'manifest'],
  hook: ['strict', 'craft-floor', 'skip-heuristics', 'manifest'],
  find: ['json', 'limit', 'tag', 'query'],
  'get-component': ['section'],
  primer: [],
  pattern: ['json'],
  principles: ['topic', 'rubric'],
  'css-reference': [],
  icons: ['json', 'limit', 'query'],
  recipe: ['json'],
  guide: ['json'],
  context: ['json', 'manifest'],
  'record-decision': ['title', 'decision', 'rationale', 'status', 'supersedes', 'date', 'manifest'],
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
 * Old flag spellings still accepted, mapped to their current name.
 *
 * Silent in the sense of *unadvertised*: deliberately absent from `COMMAND_FLAGS`
 * and from `help.ts`, so nothing teaches the dead name — but accepted, because
 * `checkFlags` rejects an unknown flag with exit 2, and the `nearest()` hint cannot
 * rescue this one (`slop-floor` → `craft-floor` is 5 edits apart, well past the
 * length-scaled typo threshold). A pinned CI step or a `.claude/settings.json` hook
 * command written before the 2026-07-30 rename would otherwise fail with "unknown
 * flag" and no way to guess the new name.
 */
export const DEPRECATED_FLAG_ALIASES: Readonly<Record<string, string>> = {
  'slop-floor': 'craft-floor'
};

/**
 * Rewrite deprecated flag spellings to their current names **in place**, returning
 * one notice per rewrite for the caller to print.
 *
 * The notices go to stderr, never stdout: `validate --json` writes a machine-read
 * envelope there, and a deprecation line in it would break the parse — the exact
 * silent-answer failure this module exists to prevent, inverted.
 *
 * Only rewrites where the command actually accepts the target flag, so
 * `urbicon find --slop-floor 50` still reports the flag the caller typed rather
 * than a `--craft-floor` they have never heard of. An explicit current-name flag
 * wins; the old one is then dropped rather than fighting over the value.
 */
export function applyFlagAliases(
  command: string,
  flags: Record<string, string | boolean>
): string[] {
  const notices: string[] = [];
  for (const [old, current] of Object.entries(DEPRECATED_FLAG_ALIASES)) {
    if (!(old in flags)) continue;
    if (!COMMAND_FLAGS[command]?.includes(current)) continue;
    const value = flags[old];
    delete flags[old];
    if (current in flags) {
      notices.push(`--${old} is deprecated; --${current} was also given and wins.`);
      continue;
    }
    if (value !== undefined) flags[current] = value;
    notices.push(`--${old} has been renamed to --${current}; the old name still works for now.`);
  }
  return notices;
}

/** How many positional arguments a command reads, and what to type instead of an extra one. */
export interface PositionalSpec {
  /** Maximum positionals the command actually reads (`Infinity` = genuinely variadic). */
  max: number;
  /** Where the argument really goes — an arity error is only useful if it says that. */
  hint?: string;
}

/**
 * Command → the positionals it reads. The second half of the same defence
 * `COMMAND_FLAGS` gives the flags.
 *
 * Why it exists: a command that takes `_positionals` and never looks at them
 * answers a question nobody asked and exits 0. Measured on the shipped CLI:
 * `urbicon sync-manifest src` scanned `./src` and reported success (the scan root
 * is `--src`), `urbicon verbs compose` listed all the verbs, `urbicon primer
 * tokens` printed the whole primer, `urbicon context decisions` printed the whole
 * manifest. Same failure as an unknown flag — neither honoured nor rejected — so
 * it gets the same treatment, declared in one table rather than a dozen `if`s.
 *
 * `help` and `version` are listed for completeness; `index.ts` answers both before
 * the check runs (`urbicon help <command>` prints that command's block).
 */
export const COMMAND_POSITIONALS: Readonly<Record<string, PositionalSpec>> = {
  init: {
    max: 0,
    hint: 'Its targets are flags: --agents-file <path>, --manifest <path>, --hook, --ci.'
  },
  validate: { max: Number.POSITIVE_INFINITY },
  hook: {
    max: 0,
    hint: '`hook` reads the edit event on stdin — to lint a file, run `urbicon validate <path>`.'
  },
  find: { max: Number.POSITIVE_INFINITY },
  'get-component': {
    max: 1,
    hint: 'One slug per call; for one part of the API use `--section overview|examples|variants|api|slots`.'
  },
  primer: {
    max: 0,
    hint: 'It is the same bundle every time — `urbicon primer` takes no argument.'
  },
  pattern: { max: 1, hint: 'One pattern per call — `urbicon pattern` lists them.' },
  principles: { max: 1, hint: 'A topic is one word — `urbicon principles` lists them.' },
  'css-reference': { max: 1, hint: 'One section per call — `urbicon css-reference` lists them.' },
  icons: { max: Number.POSITIVE_INFINITY },
  recipe: { max: 1, hint: 'One recipe per call — `urbicon recipe` lists them.' },
  guide: { max: 1, hint: 'One guide per call — `urbicon guide` lists them.' },
  context: { max: 0, hint: 'Point it at another file with `--manifest <path>`.' },
  'record-decision': {
    max: 0,
    hint: 'Every field is a flag: --title, --decision, --rationale, --status, --supersedes, --date.'
  },
  'sync-manifest': {
    max: 0,
    hint: 'The tree to scan is a flag: `urbicon sync-manifest --src <dir>`.'
  },
  i18n: { max: Number.POSITIVE_INFINITY },
  verbs: { max: 0, hint: 'To print one, run `urbicon verb <name>`; `verbs` only lists them.' },
  verb: { max: 1, hint: 'One verb per call — list them with `urbicon verbs`.' },
  help: { max: 1 },
  version: { max: 0 }
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
 * A boolean flag given a value that isn't a boolean. `boolFlag` reads anything
 * other than `true`/`"true"` as false, so `--with-primer=nonsense` silently means
 * "off" — the same silent-answer failure as an unknown flag, on the one flag
 * shape that survived the first pass.
 */
function badBoolean(name: string, value: string | boolean): string | undefined {
  if (!BOOLEAN_FLAGS.has(name) || typeof value !== 'string') return undefined;
  if (value === 'true' || value === 'false') return undefined;
  return `--${name} takes true or false, not "${value}".`;
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
      const message = missingValue(command, name, value) ?? badBoolean(name, value);
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

/**
 * Reject positionals the command does not read (see {@link COMMAND_POSITIONALS}).
 * Run after {@link checkFlags}, on the positionals it returns, so a folded
 * `--query` is counted as the argument it stands for.
 */
export function checkPositionals(command: string, positionals: string[]): FlagCheck {
  const spec = COMMAND_POSITIONALS[command];
  if (spec === undefined || positionals.length <= spec.max) return { ok: true, positionals };

  const takes =
    spec.max === 0
      ? 'takes no arguments'
      : spec.max === 1
        ? 'takes one argument'
        : `takes at most ${spec.max} arguments`;
  const got = positionals.map((p) => `"${p}"`).join(' ');
  return {
    ok: false,
    message: `\`${command}\` ${takes} — got ${got}.${spec.hint ? `\n  ${spec.hint}` : ''}`
  };
}
