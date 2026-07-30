/**
 * Guards the flag table against the two ways it can lie: drifting from the help
 * text (a flag the CLI accepts but never advertises, or vice versa), and drifting
 * from the commands themselves.
 *
 * The help/table diff is the same defence `help.ts` already applies to the
 * css-reference section list — that one went stale precisely because nothing
 * compared it to the truth. Written after the table caught two real drifts on the
 * first run: `i18n --function-names` and `--runtime-usage` were implemented and
 * undocumented.
 */

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { BOOLEAN_FLAGS } from './args.js';
import {
  applyFlagAliases,
  COMMAND_FLAGS,
  COMMAND_POSITIONALS,
  checkFlags,
  checkPositionals,
  DEPRECATED_FLAG_ALIASES,
  GLOBAL_FLAGS,
  QUERY_ALIAS_COMMANDS
} from './command-flags.js';
import { HELP } from './help.js';

/**
 * The flags HELP documents for each command, read from its own layout: a command
 * line starts at column 2, its flags are the `--x` tokens indented deeper until
 * the next command.
 */
function flagsDocumentedInHelp(): Map<string, Set<string>> {
  const documented = new Map<string, Set<string>>();
  let current: string | undefined;

  for (const line of HELP.split('\n')) {
    const command = /^ {2}(\S+)/.exec(line)?.[1];
    if (command) {
      current = command;
      documented.set(current, new Set());
    }
    if (!current) continue;
    // Only flags introduced as their own entry (`--flag <v>  description`);
    // prose mentions like "(--strict, --craft-floor)" restate, they don't declare.
    const declared = /^\s{20,}(--[a-z-]+)/.exec(line);
    if (declared?.[1]) documented.get(current)?.add(declared[1].slice(2));
  }
  return documented;
}

describe('COMMAND_FLAGS', () => {
  it('documents every accepted flag in HELP, and accepts every documented one', () => {
    const documented = flagsDocumentedInHelp();

    for (const [command, flags] of Object.entries(COMMAND_FLAGS)) {
      const inHelp = documented.get(command);
      if (!inHelp) {
        // `help`/`version` are dispatch keywords with no flag block of their own.
        expect(flags, `${command} has flags but no HELP entry`).toEqual([]);
        continue;
      }
      // `--query` is an alias for a positional, deliberately not given its own
      // help entry — the positional form is the one to teach.
      const accepted = new Set(flags.filter((f) => f !== 'query'));
      expect([...inHelp].sort(), `HELP documents flags \`${command}\` does not accept`).toEqual(
        [...accepted].sort()
      );
    }
  });

  it('has an entry for every command the CLI dispatches', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf-8');
    const dispatched = [...source.matchAll(/^\s+case '([a-z-]+)':/gm)].map((m) => m[1] ?? '');

    expect(dispatched.length).toBeGreaterThan(10);
    for (const command of dispatched) {
      expect(COMMAND_FLAGS, `no flag list for \`${command}\``).toHaveProperty(command);
    }
  });

  it('lists `query` as accepted wherever it is an alias', () => {
    for (const command of QUERY_ALIAS_COMMANDS) {
      expect(COMMAND_FLAGS[command], `${command} aliases --query`).toContain('query');
    }
  });
});

describe('checkFlags', () => {
  it('accepts a command with its own flags', () => {
    expect(checkFlags('icons', { limit: '5', json: true }, ['moon'])).toEqual({
      ok: true,
      positionals: ['moon']
    });
  });

  it('rejects an unknown flag as a usage error', () => {
    const result = checkFlags('icons', { nope: 'x' }, []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('unknown flag "--nope"');
  });

  it('suggests the intended flag for a typo — the `--limitt` case', () => {
    const result = checkFlags('icons', { limitt: '3' }, []);
    expect(result.ok === false && result.message).toContain('Did you mean --limit?');
  });

  it('does not suggest an unrelated flag for a short typo', () => {
    const result = checkFlags('init', { xy: true }, []);
    expect(result.ok === false && result.message).not.toContain('Did you mean');
  });

  it('folds --query into the positionals — the recorded `icons --query moon` case', () => {
    expect(checkFlags('icons', { query: 'moon' }, [])).toEqual({
      ok: true,
      positionals: ['moon']
    });
    expect(checkFlags('find', { query: 'combobox' }, [])).toEqual({
      ok: true,
      positionals: ['combobox']
    });
  });

  it('rejects --query where the argument is an identifier, not a query', () => {
    const result = checkFlags('get-component', { query: 'button' }, []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('unknown flag "--query"');
  });

  it('points at the positional form when a query command gets an unknown flag', () => {
    const result = checkFlags('find', { search: 'x' }, []);
    expect(result.ok === false && result.message).toContain('urbicon find <query>');
  });

  it('rejects a query given twice rather than picking a winner', () => {
    const result = checkFlags('icons', { query: 'moon' }, ['bell']);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('twice');
  });

  it('rejects a value flag given without a value', () => {
    const result = checkFlags('icons', { limit: true }, []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('--limit needs a value');
  });

  it('leaves genuine boolean flags alone', () => {
    const validateFlags = COMMAND_FLAGS.validate ?? [];
    for (const flag of BOOLEAN_FLAGS) {
      if (!validateFlags.includes(flag) && !GLOBAL_FLAGS.includes(flag)) continue;
      expect(checkFlags('validate', { [flag]: true }, []).ok, flag).toBe(true);
    }
  });

  it('names the command when it takes no flags at all', () => {
    const result = checkFlags('verbs', { json: true }, []);
    expect(result.ok === false && result.message).toContain('`verbs` takes no flags');
  });

  it("passes an unknown command through — that is index.ts' error to report", () => {
    expect(checkFlags('nonsense', { whatever: true }, ['x'])).toEqual({
      ok: true,
      positionals: ['x']
    });
  });
});

describe('checkPositionals', () => {
  it('has an entry for every command the flag table knows', () => {
    // A command missing from the arity table is unchecked — the silent-swallow
    // default this table exists to remove.
    const missing = Object.keys(COMMAND_FLAGS).filter((c) => !(c in COMMAND_POSITIONALS));
    expect(missing, `no positional arity declared for: ${missing.join(', ')}`).toEqual([]);
  });

  it('rejects an argument a command never reads — the `sync-manifest src` case', () => {
    // Measured: it scanned ./src (the default) and reported success, so the caller
    // could not tell its argument had been dropped.
    const result = checkPositionals('sync-manifest', ['src']);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('takes no arguments');
    expect(result.ok === false && result.message).toContain('--src <dir>');
  });

  it('points `verbs <name>` at the singular command it meant', () => {
    const result = checkPositionals('verbs', ['compose']);
    expect(result.ok === false && result.message).toContain('urbicon verb <name>');
  });

  it('rejects a second argument where one is read', () => {
    const result = checkPositionals('get-component', ['button', 'api']);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('takes one argument');
    expect(result.ok === false && result.message).toContain('--section');
  });

  it('leaves variadic commands and in-budget calls alone', () => {
    expect(checkPositionals('validate', ['a.svelte', 'b.svelte', 'src/']).ok).toBe(true);
    expect(checkPositionals('icons', ['calendar', 'date']).ok).toBe(true);
    expect(checkPositionals('guide', ['auth']).ok).toBe(true);
    expect(checkPositionals('primer', []).ok).toBe(true);
  });

  it("passes an unknown command through — that is index.ts' error to report", () => {
    expect(checkPositionals('nonsense', ['x'])).toEqual({ ok: true, positionals: ['x'] });
  });
});

describe('applyFlagAliases', () => {
  it('folds the pre-rename --slop-floor into --craft-floor, keeping the value', () => {
    const flags: Record<string, string | boolean> = { 'slop-floor': '40', json: true };
    const notices = applyFlagAliases('validate', flags);

    expect(flags).toEqual({ 'craft-floor': '40', json: true });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('--slop-floor');
    expect(notices[0]).toContain('--craft-floor');
    // …and the folded flag then passes the unknown-flag check, which is the point:
    // without the alias this is exit 2 with a hint the Levenshtein guard cannot give.
    expect(checkFlags('validate', flags, []).ok).toBe(true);
  });

  it('accepts the current spelling silently — no notice, no rewrite', () => {
    const flags: Record<string, string | boolean> = { 'craft-floor': '40' };
    expect(applyFlagAliases('validate', flags)).toEqual([]);
    expect(flags).toEqual({ 'craft-floor': '40' });
    expect(checkFlags('validate', flags, []).ok).toBe(true);
  });

  it('applies to `hook` as well — the wiring most likely to be pinned in a config', () => {
    const flags: Record<string, string | boolean> = { 'slop-floor': '60' };
    expect(applyFlagAliases('hook', flags)).toHaveLength(1);
    expect(flags['craft-floor']).toBe('60');
  });

  it('lets an explicit --craft-floor win rather than fighting over the value', () => {
    const flags: Record<string, string | boolean> = { 'slop-floor': '10', 'craft-floor': '90' };
    const notices = applyFlagAliases('validate', flags);
    expect(flags).toEqual({ 'craft-floor': '90' });
    expect(notices[0]).toContain('wins');
  });

  it('leaves commands that never had the flag alone, so the error names what was typed', () => {
    const flags: Record<string, string | boolean> = { 'slop-floor': '40' };
    expect(applyFlagAliases('find', flags)).toEqual([]);
    expect(checkFlags('find', flags, []).ok === false).toBe(true);
  });

  it('stays out of HELP and COMMAND_FLAGS — accepted, never advertised', () => {
    for (const [old, current] of Object.entries(DEPRECATED_FLAG_ALIASES)) {
      for (const flags of Object.values(COMMAND_FLAGS)) {
        expect(flags, `${old} must not be an advertised flag`).not.toContain(old);
      }
      expect(HELP, `${old} must not be taught in HELP`).not.toContain(`--${old}`);
      expect(HELP, `${current} is the name to teach`).toContain(`--${current}`);
    }
  });
});

describe('checkFlags — boolean flags with a value', () => {
  it('accepts true and false', () => {
    expect(checkFlags('init', { 'with-primer': 'true' }, []).ok).toBe(true);
    expect(checkFlags('init', { 'with-primer': 'false' }, []).ok).toBe(true);
    expect(checkFlags('init', { 'with-primer': true }, []).ok).toBe(true);
  });

  it('rejects a value that is neither — it would silently read as off', () => {
    const result = checkFlags('init', { 'with-primer': 'nonsense' }, []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('takes true or false');
  });
});
