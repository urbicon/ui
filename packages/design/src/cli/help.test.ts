import { CSS_REFERENCE_SECTION_NAMES } from '@urbicon-ui/design-engine/reference';
import { describe, expect, it } from 'vitest';
import { COMMAND_FLAGS } from './command-flags.js';
import { CSS_REFERENCE_SECTION_LIST, commandHelp, HELP } from './help.js';

describe('urbicon --help', () => {
  it('advertises every css-reference section the command accepts', () => {
    // The regression this guards: `typography` shipped as a section while the help
    // still listed six. The engine-side guard passed throughout — it only checked
    // CSS_REFERENCE_OVERVIEW — so the surface consumers actually run stayed stale.
    const missing = CSS_REFERENCE_SECTION_NAMES.filter((name) => !HELP.includes(name));
    expect(
      missing,
      `Sections callable via "urbicon css-reference <section>" but absent from --help: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('advertises no section the command would reject', () => {
    const advertised = CSS_REFERENCE_SECTION_LIST.split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(advertised).toEqual([...CSS_REFERENCE_SECTION_NAMES]);
  });

  it('keeps the section list inside the help width', () => {
    // The list is derived, so it must wrap itself; an added section must not blow
    // the column out.
    const overflowing = HELP.split('\n').filter((line) => line.length > 100);
    expect(overflowing, `Help lines over 100 columns: ${overflowing.join(' / ')}`).toEqual([]);
  });

  it('still documents every command the CLI dispatches', () => {
    // HELP moved out of index.ts to become importable; this pins that the move
    // carried the whole text, not a remembered subset of it.
    for (const command of [
      'init',
      'validate',
      'hook',
      'find',
      'get-component',
      'pattern',
      'principles',
      'css-reference',
      'icons',
      'recipe',
      'guide',
      'context',
      'record-decision',
      'sync-manifest',
      'i18n',
      'verbs',
      'verb'
    ]) {
      expect(HELP, `--help no longer documents "${command}"`).toContain(`  ${command}`);
    }
    expect(HELP).toContain('Exit codes:');
    expect(HELP).toContain('Examples:');
  });
});

describe('urbicon <command> --help', () => {
  it('has a block for every command that takes flags', () => {
    // Without this, `urbicon <command> --help` reports "unknown command" for a
    // command the CLI happily dispatches — the slice would silently find nothing.
    const missing = Object.keys(COMMAND_FLAGS).filter((c) => commandHelp(c) === undefined);
    expect(missing, `Commands with no --help block: ${missing.join(', ')}`).toEqual([]);
  });

  it('returns that command and nothing after it', () => {
    const block = commandHelp('record-decision');
    expect(block).toBeDefined();
    expect(block).toContain('record-decision');
    expect(block).toContain('--title <t>');
    expect(block).toContain('--manifest <path>');
    // The following command must not bleed in — the slice ends at the next entry.
    expect(block).not.toContain('sync-manifest');
  });

  it('carries every flag the command actually reads', () => {
    // The measured failure was an agent needing a second call to find flags that
    // --help should have shown. A block that omits one recreates it.
    for (const [command, flags] of Object.entries(COMMAND_FLAGS)) {
      const block = commandHelp(command) ?? '';
      // `query` is an accepted alias folded into the positionals, not a documented flag.
      const undocumented = flags.filter((f) => f !== 'query' && !block.includes(`--${f}`));
      expect(
        undocumented,
        `"${command} --help" never mentions: ${undocumented.join(', ')}`
      ).toEqual([]);
    }
  });

  it('is far smaller than the full page', () => {
    // The point of the fix: answer the question asked, not with 9.5 kB.
    const block = commandHelp('record-decision') ?? '';
    expect(block.length).toBeLessThan(HELP.length / 10);
  });

  it('returns undefined for something that is not a command', () => {
    expect(commandHelp('bogus')).toBeUndefined();
    // "Commands:" and "Examples:" are section headings, not commands.
    expect(commandHelp('Commands:')).toBeUndefined();
  });
});
