/**
 * Minimal, dependency-free argv parser for the `urbicon` CLI. Modelled on
 * `packages/docs-gen/src/cli/CLI.ts` (the repo's only other `bin`), extended with
 * `--key=value` and an explicit boolean-flag set so a value flag never swallows a
 * following positional (`urbicon validate --json src/` keeps `src/` positional).
 */

/** Parsed `--key value` / `--key=value` / bare `--key` flag bag. */
export type Flags = Record<string, string | boolean>;

export interface ParsedArgs {
  /** First non-flag token, e.g. `validate`. */
  command: string | undefined;
  /** Remaining non-flag tokens (paths, etc.), in order. */
  positionals: string[];
  flags: Flags;
}

/**
 * Flags that take no value — never consume the following token. Exported because
 * `command-flags.ts` needs the complement: a flag *outside* this set that arrives
 * as bare `--key` was given no value, and silently falling back to the default is
 * the same class of bug as accepting an unknown flag.
 */
export const BOOLEAN_FLAGS = new Set([
  'json',
  'strict',
  'skip-heuristics',
  'record',
  // Default-on; `--with-primer=false` turns it off. Listed here so the bare form
  // doesn't swallow the following positional.
  'with-primer',
  'hook',
  'ci',
  'rubric',
  'help',
  'version'
]);

export function parseArgs(argv: string[], booleans: Set<string> = BOOLEAN_FLAGS): ParsedArgs {
  let command: string | undefined;
  const positionals: string[] = [];
  const flags: Flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      if (booleans.has(body)) {
        flags[body] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[body] = next;
        i++;
      } else {
        flags[body] = true;
      }
      continue;
    }

    if (command === undefined) command = arg;
    else positionals.push(arg);
  }

  return { command, positionals, flags };
}

/** Read a flag as a string, or undefined when absent or boolean. */
export function stringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

/** Read a flag as a boolean (bare `--key` or `--key=true`). */
export function boolFlag(flags: Flags, key: string): boolean {
  const value = flags[key];
  return value === true || value === 'true';
}
