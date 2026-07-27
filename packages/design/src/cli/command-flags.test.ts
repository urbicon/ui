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
import { COMMAND_FLAGS, checkFlags, GLOBAL_FLAGS, QUERY_ALIAS_COMMANDS } from './command-flags.js';
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
    // prose mentions like "(--strict, --slop-floor)" restate, they don't declare.
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
