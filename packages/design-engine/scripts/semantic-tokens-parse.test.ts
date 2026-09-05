import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEMANTIC_TOKENS } from '../src/reference/semantic-tokens.gen.js';
import { parseSemanticTokens, renderModule } from './semantic-tokens-parse.js';

/**
 * The marker grammar's enforcement, on inline fixtures — every rule the
 * generator fails on has a case here, so a parser edit that makes one silent
 * fails a test rather than a future reference. The last describe is the
 * in-repo round trip: the real CSS parsed now must equal the committed data,
 * the same oracle `tokens:reference:check` asks, with a readable diff.
 */

const FOUNDATION = `@theme {
  --color-neutral-0: oklch(1 0 0);
  --color-neutral-500: oklch(0.55 0.016 240);
  --color-neutral-900: oklch(0.15 0.012 240);
  --color-primary-400: oklch(0.66 0.13 240);
  --color-primary-500: oklch(0.58 0.15 240);
  --color-primary-600: oklch(0.52 0.15 240);
  --color-warm-neutral-500: oklch(0.5 0.008 45);
}`;

const PRIMARY = `
  /* === PRIMARY INTENT === */
  /* @role the fill */
  --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500));
  /* @role the intent as text */
  --color-primary-text: light-dark(var(--color-primary-600), var(--color-primary-400));`;

const theme = (body: string) => `@theme {${body}\n}`;
const parse = (body: string) => parseSemanticTokens(theme(body), FOUNDATION);

describe('parseSemanticTokens — values', () => {
  it('reads both light-dark() branches with the stop and its lightness', () => {
    const data = parse(`
      /* @role the page */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`);
    expect(data.families.surface).toEqual([
      {
        name: 'surface-base',
        role: 'the page',
        light: { ref: 'neutral-0', l: 1 },
        dark: { ref: 'neutral-900', l: 0.15 }
      }
    ]);
  });

  it('treats a value without light-dark() as the same stop in both modes', () => {
    const data = parse(`
      /* @role disabled */
      --color-text-disabled: var(--color-neutral-500);
      ${PRIMARY}`);
    const [token] = data.families.text;
    expect(token?.light).toEqual({ ref: 'neutral-500', l: 0.55 });
    expect(token?.dark).toEqual(token?.light);
  });

  it('resolves an alias of a semantic token and records what it aliases', () => {
    const data = parse(`
      /* @role on fill */
      --color-text-on-fill: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      /* @role on primary */
      --color-text-on-primary: var(--color-text-on-fill);
      /* @role link */
      --color-text-link: var(--color-primary-text);
      ${PRIMARY}`);
    const byName = new Map(data.families.text.map((t) => [t.name, t]));
    expect(byName.get('text-on-primary')).toMatchObject({
      alias: 'text-on-fill',
      light: { ref: 'neutral-0' },
      dark: { ref: 'neutral-900' }
    });
    expect(byName.get('text-link')).toMatchObject({
      alias: 'primary-text',
      light: { ref: 'primary-600' },
      dark: { ref: 'primary-400' }
    });
  });

  it('flags a stop reached through relative colour syntax as derived', () => {
    const data = parse(`
      /* @role chrome */
      --color-surface-inverted: light-dark(
        oklch(from var(--color-warm-neutral-500) l c 240),
        var(--color-neutral-0)
      );
      ${PRIMARY}`);
    expect(data.families.surface[0]?.light).toEqual({
      ref: 'warm-neutral-500',
      l: 0.5,
      derived: true
    });
    expect(data.families.surface[0]?.dark).toEqual({ ref: 'neutral-0', l: 1 });
  });

  it('keeps a literal that reads no stop verbatim', () => {
    const data = parse(`
      /* @role hairline */
      --color-border-hairline: light-dark(rgb(0 0 0 / 0.08), rgb(255 255 255 / 0.06));
      ${PRIMARY}`);
    expect(data.families.border[0]?.light).toEqual({ raw: 'rgb(0 0 0 / 0.08)' });
  });

  it('lists what it does not table, so a new family is visible in the diff', () => {
    const data = parse(`
      --color-chart-1: light-dark(var(--color-primary-600), var(--color-primary-400));
      --blocks-shadow-scale-xs: 0 1px 2px 0 oklch(0 0 0 / 0.05);
      ${PRIMARY}`);
    expect(data.notTabled).toEqual(['--color-chart-1', '--blocks-shadow-scale-xs']);
  });

  it('refuses a reference to a stop neither file defines', () => {
    expect(() =>
      parse(`
      /* @role x */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-1000));
      ${PRIMARY}`)
    ).toThrow(/reads --color-neutral-1000, which neither file defines/);
  });
});

describe('parseSemanticTokens — @role', () => {
  it('fails on a tabled token without a marker', () => {
    expect(() =>
      parse(`
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`)
    ).toThrow(/--color-surface-base has no @role marker/);
  });

  it('fails on two markers before one declaration', () => {
    expect(() =>
      parse(`
      /* @role one */
      /* @role two */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`)
    ).toThrow(/two @role markers before one declaration/);
  });

  it('fails on a marker nothing follows', () => {
    expect(() => parse(`${PRIMARY}\n  /* @role orphan */`)).toThrow(
      /"orphan" is not followed by a declaration/
    );
  });

  it('fails on an empty marker but accepts the explicit (none)', () => {
    expect(() =>
      parse(`
      /* @role */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`)
    ).toThrow(/empty @role/);
    const data = parse(`
      /* @role (none) */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`);
    expect(data.families.surface[0]?.role).toBe('');
  });

  it('fails on a marker for a token the reference does not table', () => {
    expect(() =>
      parse(`
      /* @role series one */
      --color-chart-1: light-dark(var(--color-primary-600), var(--color-primary-400));
      ${PRIMARY}`)
    ).toThrow(/--color-chart-1 carries a @role but the reference does not table it/);
  });

  it('collapses a multi-line marker to one sentence', () => {
    const data = parse(`
      /* prose that stays prose.
         @role first line
         second line */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      ${PRIMARY}`);
    expect(data.families.surface[0]?.role).toBe('first line second line');
  });
});

describe('parseSemanticTokens — intents', () => {
  it('takes the roles from the first intent section and the stops from every one', () => {
    const data = parse(`${PRIMARY}
      /* === INFO INTENT === */
      --color-info: light-dark(var(--color-primary-500), var(--color-primary-400));
      /* @role info reads darker */
      --color-info-text: light-dark(var(--color-primary-600), var(--color-primary-400));`);
    expect(data.intents.exemplar).toBe('primary');
    expect(data.intents.roles).toEqual([
      { suffix: 'base', role: 'the fill' },
      { suffix: 'text', role: 'the intent as text' }
    ]);
    expect(data.intents.entries.map((e) => e.name)).toEqual(['primary', 'info']);
    expect(data.intents.entries[1]?.stops.text?.light).toEqual({ ref: 'primary-600', l: 0.52 });
    expect(data.intents.notes).toEqual([
      { intent: 'info', suffix: 'text', note: 'info reads darker' }
    ]);
  });

  it('fails on an exemplar token without a marker', () => {
    expect(() =>
      parse(`
      /* === PRIMARY INTENT === */
      --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500));`)
    ).toThrow(/--color-primary \(exemplar primary\) has no @role marker/);
  });

  it('requires an @absent reason for a role an intent lacks, and rejects a stale one', () => {
    const neutral = `
      /* === NEUTRAL INTENT === */
      --color-neutral: light-dark(var(--color-neutral-500), var(--color-neutral-0));`;
    expect(() => parse(`${PRIMARY}${neutral}`)).toThrow(
      /neutral intent has no -text token and no "@absent neutral-text — …" marker/
    );
    const data = parse(`${PRIMARY}
      /* @absent neutral-text — the base already reads as text */${neutral}`);
    expect(data.intents.absent).toEqual([
      { intent: 'neutral', suffix: 'text', reason: 'the base already reads as text' }
    ]);
    expect(() =>
      parse(`${PRIMARY}
      /* @absent primary-text — stale */${neutral}
      /* @absent neutral-text — fine */`)
    ).toThrow(/@absent primary-text names a token that exists/);
  });

  it('fails on a suffix the exemplar does not define', () => {
    expect(() =>
      parse(`${PRIMARY}
      /* === INFO INTENT === */
      --color-info: light-dark(var(--color-primary-500), var(--color-primary-400));
      --color-info-text: light-dark(var(--color-primary-600), var(--color-primary-400));
      --color-info-glow: light-dark(var(--color-primary-600), var(--color-primary-400));`)
    ).toThrow(/--color-info-glow: the exemplar primary has no such role/);
  });

  it('fails on a token in an intent section that is not named after it', () => {
    expect(() =>
      parse(`${PRIMARY}
      --color-live: light-dark(var(--color-primary-500), var(--color-primary-400));`)
    ).toThrow(/--color-live sits in section "PRIMARY INTENT" but is not named after its intent/);
  });
});

describe('parseSemanticTokens — marker boundaries', () => {
  const disabled =
    '--color-surface-disabled: light-dark(var(--color-neutral-0), var(--color-neutral-900));';

  it('ends the marker at the first blank line; reasoning before it stays prose', () => {
    const data = parse(`
      /* Reasoning that stays prose — it mentions neutral-200 and #12.

         @role the fill of a disabled control */
      ${disabled}
      ${PRIMARY}`);
    expect(data.families.surface[0]?.role).toBe('the fill of a disabled control');
  });

  it('fails on prose after the marker paragraph, naming the token', () => {
    expect(() =>
      parse(`
      /* @role the fill of a disabled control

         Historically this sat at neutral-200; moved in v7 (see #12). */
      ${disabled}
      ${PRIMARY}`)
    ).toThrow(/--color-surface-disabled: text after its @role/);
  });

  it('fails on a second sentence appended without a blank line', () => {
    expect(() =>
      parse(`
      /* @role the fill of a disabled control.
         Historically this sat at neutral-200; moved in v7 (see #12). */
      ${disabled}
      ${PRIMARY}`)
    ).toThrow(/--color-surface-disabled: @role reads as more than one sentence/);
  });

  it('fails on a marker over 140 characters', () => {
    const long =
      'the fill of a disabled control, one step in from the page in both modes, ' +
      'chosen so that the disabled label still reads against it in every shipped theme';
    expect(long.length).toBeGreaterThan(140);
    expect(() => parse(`\n/* @role ${long} */\n${disabled}\n${PRIMARY}`)).toThrow(
      /--color-surface-disabled: @role is \d+ characters, the limit is 140/
    );
  });

  it('fails on a marker that spells a --color- name followed by a colon', () => {
    expect(() =>
      parse(`
      /* @role the pair of --color-surface-hover: light-dark(a, b) */
      ${disabled}
      ${PRIMARY}`)
    ).toThrow(/spells "--color-surface-hover:"/);
  });

  it('applies the same limits to @absent', () => {
    const neutral = `
      /* === NEUTRAL INTENT === */
      --color-neutral: light-dark(var(--color-neutral-500), var(--color-neutral-0));`;
    expect(() =>
      parse(`${PRIMARY}
      /* @absent neutral-text — the base reads as text.
         It always did. */${neutral}`)
    ).toThrow(/@absent neutral-text reads as more than one sentence/);
  });
});

describe('parseSemanticTokens — derived branches', () => {
  it('resolves a derived branch that reads a semantic token, keeping it derived', () => {
    const data = parse(`
      /* @role the page */
      --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
      /* @role the inverse */
      --color-surface-inverted: light-dark(
        oklch(from var(--color-surface-base) l c 240),
        var(--color-neutral-0)
      );
      ${PRIMARY}`);
    const inverted = data.families.surface[1];
    expect(inverted?.light).toEqual({ ref: 'neutral-0', l: 1, derived: true });
    expect(inverted?.dark).toEqual({ ref: 'neutral-0', l: 1 });
    expect(inverted?.alias).toBeUndefined();
  });
});

describe('renderModule', () => {
  it('emits a typed constant behind a do-not-edit header', () => {
    const out = renderModule(parse(PRIMARY));
    expect(out.startsWith('// DO NOT EDIT')).toBe(true);
    expect(out).toContain("import type { SemanticTokens } from './semantic-tokens.js';");
    expect(out).toContain('export const SEMANTIC_TOKENS: SemanticTokens = {');
    expect(out).toContain("light: { ref: 'primary-600', l: 0.52 }");
  });
});

const style = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'blocks',
  'src',
  'lib',
  'style'
);
const cssAvailable = existsSync(resolve(style, 'semantic.css'));

describe.skipIf(!cssAvailable)('the committed module matches semantic.css', () => {
  it('parses to exactly SEMANTIC_TOKENS (run `bun run tokens:reference` otherwise)', () => {
    const parsed = parseSemanticTokens(
      readFileSync(resolve(style, 'semantic.css'), 'utf8'),
      readFileSync(resolve(style, 'foundation.css'), 'utf8')
    );
    expect(parsed).toEqual(SEMANTIC_TOKENS);
  });
});
