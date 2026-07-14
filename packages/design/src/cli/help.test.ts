import { CSS_REFERENCE_SECTION_NAMES } from '@urbicon-ui/design-engine/reference';
import { describe, expect, it } from 'vitest';
import { CSS_REFERENCE_SECTION_LIST, HELP } from './help.js';

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
