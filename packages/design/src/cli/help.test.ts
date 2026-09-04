import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSS_REFERENCE_SECTION_NAMES } from '@urbicon-ui/design-engine/reference';
import { describe, expect, it } from 'vitest';
import { COMMAND_FLAGS } from './command-flags.js';
import { CSS_REFERENCE_SECTION_LIST, commandHelp, guideSlugList, renderHelp } from './help.js';

/** The fixture bundle's guides; the built bundle gets its own block below. */
const GUIDES = ['auth', 'table-sticky'];
const HELP = renderHelp(GUIDES);

/** What docs-gen last emitted — there after `docs:gen:all`, absent in a bare checkout. */
const BUILT_INDEX = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'design-content',
  'content',
  'guides',
  'index.json'
);

/** The slugs the `guide` block advertises: its `Guides:` line plus the wrapped continuations. */
function advertisedGuides(help: string): string[] {
  const block = commandHelp(help, 'guide') ?? '';
  const lines = block.split('\n');
  const start = lines.findIndex((line) => line.includes('Guides: '));
  const listed: string[] = [];
  for (let i = start; i >= 0 && i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (i > start && line.includes('--')) break;
    listed.push(...line.replace(/^.*Guides: /, '').split('|'));
  }
  return listed.map((s) => s.trim()).filter(Boolean);
}

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

  it('advertises exactly the guides it is handed, in bundle order', () => {
    // The same drift, one command over: the guide list was authored next to
    // docs-gen's PACKAGE_GUIDES and named "migration notes" while the bundle
    // shipped none. Read from the index at print time, it cannot name a guide
    // the bundle lacks or miss one it has.
    expect(advertisedGuides(HELP)).toEqual(GUIDES);
    expect(advertisedGuides(renderHelp(['auth', 'migration-blocks', 'sveltekit-utils']))).toEqual([
      'auth',
      'migration-blocks',
      'sveltekit-utils'
    ]);
  });

  it('names an unreadable bundle in place of the list and keeps the guide entry', () => {
    const help = renderHelp(null);
    expect(guideSlugList(null)).toContain('bundle unreadable');
    expect(commandHelp(help, 'guide')).toContain('bundle unreadable');
    expect(commandHelp(help, 'guide')).toContain('--json');
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

describe.skipIf(!existsSync(BUILT_INDEX))('urbicon --help against the built bundle', () => {
  const slugs = (JSON.parse(readFileSync(BUILT_INDEX, 'utf-8')) as { slug: string }[]).map(
    (g) => g.slug
  );
  const help = renderHelp(slugs);

  it('advertises every guide docs-gen bundled and nothing else', () => {
    expect(advertisedGuides(help)).toEqual(slugs);
  });

  it('wraps the real list inside the help width', () => {
    // The fixture list is two slugs; the bundle's is what the wrapping must survive.
    const overflowing = help.split('\n').filter((line) => line.length > 100);
    expect(overflowing, `Help lines over 100 columns: ${overflowing.join(' / ')}`).toEqual([]);
  });
});

describe('urbicon <command> --help', () => {
  it('has a block for every command that takes flags', () => {
    // Without this, `urbicon <command> --help` reports "unknown command" for a
    // command the CLI happily dispatches — the slice would silently find nothing.
    const missing = Object.keys(COMMAND_FLAGS).filter((c) => commandHelp(HELP, c) === undefined);
    expect(missing, `Commands with no --help block: ${missing.join(', ')}`).toEqual([]);
  });

  it('returns that command and nothing after it', () => {
    const block = commandHelp(HELP, 'record-decision');
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
      const block = commandHelp(HELP, command) ?? '';
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
    const block = commandHelp(HELP, 'record-decision') ?? '';
    expect(block.length).toBeLessThan(HELP.length / 10);
  });

  it('returns undefined for something that is not a command', () => {
    expect(commandHelp(HELP, 'bogus')).toBeUndefined();
    // "Commands:" and "Examples:" are section headings, not commands.
    expect(commandHelp(HELP, 'Commands:')).toBeUndefined();
  });
});
