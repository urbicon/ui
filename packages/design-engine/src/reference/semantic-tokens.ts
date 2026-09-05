/**
 * The semantic token data the CSS reference renders its tables from, and the
 * Markdown renderers over it. The data itself is `semantic-tokens.gen.ts`,
 * generated from `packages/blocks/src/lib/style/semantic.css` by
 * `scripts/semantic-tokens-gen.ts` — this module holds only its shape and its
 * presentation, so the engine still ships without the blocks CSS.
 */

import { SEMANTIC_TOKENS } from './semantic-tokens.gen.js';

/** One branch of a token's value: what it reads, and how light that is in the default chassis. */
export interface StopValue {
  /** The foundation stop the branch reads (`neutral-600`); absent for a literal. */
  readonly ref?: string;
  /** OKLCH lightness of `ref` in the unthemed foundation ramp. */
  readonly l?: number;
  /** The branch derives from `ref` with relative colour syntax instead of reading it verbatim. */
  readonly derived?: boolean;
  /** The literal when the branch reads no foundation stop (`rgb(0 0 0 / 0.08)`). */
  readonly raw?: string;
}

export interface ModeValues {
  readonly light: StopValue;
  readonly dark: StopValue;
}

/** A `--color-<family>-<name>` token with its `@role` sentence and both resolved branches. */
export interface SemanticToken extends ModeValues {
  /** The core after `--color-` (`text-tertiary`). */
  readonly name: string;
  /** The `@role` marker's sentence; empty for an explicit `@role (none)`. */
  readonly role: string;
  /** The semantic core this token reads verbatim (`text-link` → `primary-text`), when it is an alias. */
  readonly alias?: string;
}

export interface IntentRole {
  /** `base` for `--color-<intent>`, else the suffix after `--color-<intent>-`. */
  readonly suffix: string;
  readonly role: string;
}

export interface IntentStops {
  readonly name: string;
  readonly stops: Readonly<Record<string, ModeValues>>;
}

export interface IntentNote {
  readonly intent: string;
  readonly suffix: string;
  readonly note: string;
}

export interface AbsentRole {
  readonly intent: string;
  readonly suffix: string;
  readonly reason: string;
}

export interface SemanticTokens {
  readonly families: {
    readonly surface: readonly SemanticToken[];
    readonly text: readonly SemanticToken[];
    readonly border: readonly SemanticToken[];
  };
  readonly intents: {
    /** The intent whose `@role` markers define every suffix's role. */
    readonly exemplar: string;
    readonly roles: readonly IntentRole[];
    readonly entries: readonly IntentStops[];
    /** `@role` markers on a non-exemplar intent's token — a refinement for that intent only. */
    readonly notes: readonly IntentNote[];
    /** Suffixes an intent deliberately lacks, with the CSS's `@absent` reason. */
    readonly absent: readonly AbsentRole[];
  };
  /** `@theme` declarations the reference does not table, so a new family is visible in the diff. */
  readonly notTabled: readonly string[];
}

export type SemanticFamily = keyof SemanticTokens['families'];

/**
 * The informative-text ladder, top to bottom. Its ORDER is a design decision
 * the CSS states only in prose; every value in the rendered ladder is read
 * from the data, and `css-reference.test.ts` holds the order to the lightness.
 */
export const INFORMATIVE_RAMP = [
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-quaternary'
] as const;

const UTILITY_PREFIX: Record<SemanticFamily, string> = {
  surface: 'bg-',
  text: 'text-',
  border: 'border-'
};

/**
 * Text made safe inside a GFM table cell: `|` would end the cell, and `\` would
 * make the next `|` literal — so both are escaped, in one pass, backslash
 * included. Escaping the pipe alone turns a literal `\|` into `\\|`, which a
 * reader takes as a backslash plus an unescaped pipe.
 */
export const escapeCell = (s: string): string => s.replace(/[\\|]/g, '\\$&');
const cell = escapeCell;

/** `neutral-600 (L 0.42)` · `warm-neutral-500†` · `rgb(0 0 0 / 0.08)`. */
export function formatStop(stop: StopValue): string {
  if (stop.ref === undefined) return stop.raw ?? '—';
  const l = stop.l !== undefined ? ` (L ${stop.l})` : '';
  return `${stop.ref}${stop.derived ? '†' : ''}${l}`;
}

function formatMode(token: SemanticToken, side: 'light' | 'dark'): string {
  const stop = formatStop(token[side]);
  return token.alias === undefined ? stop : `${token.alias} → ${stop}`;
}

function sameStop(a: StopValue, b: StopValue): boolean {
  return a.ref === b.ref && a.raw === b.raw && a.derived === b.derived;
}

/** Tokens of a family whose light and dark branches resolve to the same value. */
export function modeInvariant(family: SemanticFamily): SemanticToken[] {
  return SEMANTIC_TOKENS.families[family].filter((t) => sameStop(t.light, t.dark));
}

/** The family's table: one row per token, source order. `data` is injectable for tests. */
export function renderFamilyTable(
  family: SemanticFamily,
  data: SemanticTokens = SEMANTIC_TOKENS
): string {
  const prefix = UTILITY_PREFIX[family];
  const rows = data.families[family].map(
    (t) =>
      `| \`--color-${t.name}\` | \`${prefix}${t.name}\` | ${cell(t.role) || '—'} | ${cell(
        formatMode(t, 'light')
      )} | ${cell(formatMode(t, 'dark'))} |`
  );
  return [
    '| CSS Variable | Tailwind Utility | Role | Light | Dark |',
    '|---|---|---|---|---|',
    ...rows
  ].join('\n');
}

/** The informative ramp as an ordered ladder with the neutral step and L per mode. */
export function renderInformativeRamp(): string {
  const byName = new Map(SEMANTIC_TOKENS.families.text.map((t) => [t.name, t]));
  const rungs = INFORMATIVE_RAMP.map((name) => {
    const token = byName.get(name);
    if (!token) throw new Error(`INFORMATIVE_RAMP names ${name}, which the data does not carry`);
    return token;
  });
  const rows = rungs.map(
    (t) => `| \`${t.name}\` | ${cell(formatStop(t.light))} | ${cell(formatStop(t.dark))} |`
  );
  const ties: string[] = [];
  for (let i = 1; i < rungs.length; i++) {
    const prev = rungs[i - 1] as SemanticToken;
    const cur = rungs[i] as SemanticToken;
    if (sameStop(prev.dark, cur.dark))
      ties.push(`\`${prev.name}\` and \`${cur.name}\` share ${formatStop(cur.dark)} in dark mode`);
  }
  return [
    '| Rung | Light | Dark |',
    '|---|---|---|',
    ...rows,
    '',
    `Each rung is lighter than the one above it in light mode (L rises ${rungs
      .map((t) => t.light.l)
      .join(' → ')})${ties.length ? `; ${ties.join('; ')}` : ''}.`
  ].join('\n');
}

const suffixLabel = (suffix: string): string => (suffix === 'base' ? 'base' : `\`-${suffix}\``);
const tokenFor = (intent: string, suffix: string): string =>
  suffix === 'base' ? intent : `${intent}-${suffix}`;

/** Which utilities a role is reached through — presentation, keyed by what the role is for. */
function utilitiesFor(suffix: string): string {
  const core = tokenFor('<intent>', suffix);
  if (suffix === 'text') return `\`text-${core}\``;
  if (suffix === 'emphasis') return `\`bg-${core}\` / \`text-${core}\``;
  return `\`bg-${core}\``;
}

/** The role table shared by every intent, from the exemplar's `@role` markers. */
export function renderIntentRoles(): string {
  const rows = SEMANTIC_TOKENS.intents.roles.map(
    (r) =>
      `| ${suffixLabel(r.suffix)} | \`--color-${tokenFor('<intent>', r.suffix)}\` | ${utilitiesFor(
        r.suffix
      )} | ${cell(r.role) || '—'} |`
  );
  return [
    '| Role | CSS Variable | Tailwind Utility | Purpose |',
    '|---|---|---|---|',
    ...rows
  ].join('\n');
}

function formatIntentStop(intent: string, stop: StopValue): string {
  if (stop.ref === undefined) return stop.raw ?? '—';
  const short = stop.ref.startsWith(`${intent}-`) ? stop.ref.slice(intent.length + 1) : stop.ref;
  return `${short}${stop.derived ? '†' : ''}`;
}

/** Light → dark stops per intent and role, plus the per-intent notes and the deliberate gaps. */
export function renderIntentStops(): string {
  const { roles, entries, notes, absent } = SEMANTIC_TOKENS.intents;
  const header = `| Intent | ${roles.map((r) => suffixLabel(r.suffix)).join(' | ')} |`;
  const rows = entries.map((e) => {
    const cells = roles.map((r) => {
      const stop = e.stops[r.suffix];
      if (!stop) return '—';
      return `${formatIntentStop(e.name, stop.light)} → ${formatIntentStop(e.name, stop.dark)}`;
    });
    return `| \`${e.name}\` | ${cells.join(' | ')} |`;
  });
  const derived = entries.some((e) =>
    Object.values(e.stops).some((s) => s.light.derived || s.dark.derived)
  );
  const lines = [header, `|${'---|'.repeat(roles.length + 1)}`, ...rows];
  if (derived)
    lines.push(
      '',
      '† not the stop itself but derived from it with relative colour syntax — the stop lends its lightness and chroma, the hue comes from `--neutral-chrome-hue` (see the theming section).'
    );
  const remarks = [
    ...absent.map(
      (a) => `- \`${a.intent}\` has no ${suffixLabel(a.suffix)} token: ${cell(a.reason)}`
    ),
    ...notes.map((n) => `- \`${n.intent}\` ${suffixLabel(n.suffix)}: ${cell(n.note)}`)
  ];
  if (remarks.length) lines.push('', ...remarks);
  return lines.join('\n');
}

export { SEMANTIC_TOKENS };
