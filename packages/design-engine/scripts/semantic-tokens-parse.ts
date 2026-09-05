/**
 * Reads the semantic token tables out of `semantic.css` — the parser and the
 * module emitter behind `semantic-tokens-gen.ts`, kept apart from the CLI so
 * the test can drive them on inline fixtures without touching the filesystem.
 *
 * What is read, and what is deliberately not:
 *
 *  - only the `@theme` block. The `:root` knobs (`--blocks-shadow-tint`,
 *    `--neutral-chrome-hue`) are partial values, and the `prefers-contrast`
 *    overrides are conditional — neither is a token a consumer reaches for
 *    by name;
 *  - the three families the reference tables one row per token
 *    ({@link TABLED_FAMILIES}) and the intent sections (`=== X INTENT ===`);
 *    everything else in the block (chart, avatar, live, feedback, interactive,
 *    the shadow scale) is recorded by name in `notTabled` so a new family
 *    shows up in the generated diff instead of vanishing;
 *  - both halves of `light-dark()`; a value without it is the same in both
 *    modes;
 *  - the OKLCH lightness of each foundation stop a branch reads, from
 *    `foundation.css` — the default chassis, before any theme re-tints it.
 *
 * Role prose comes from the CSS itself: a `@role` marker in the comment
 * preceding a declaration, and `@absent <core>` for a token the family shape
 * implies but the CSS deliberately leaves out. The grammar is documented at
 * the head of semantic.css; the errors thrown here are its enforcement.
 */

import type {
  AbsentRole,
  IntentNote,
  IntentRole,
  IntentStops,
  ModeValues,
  SemanticToken,
  SemanticTokens,
  StopValue
} from '../src/reference/semantic-tokens.js';

/** The `--color-<family>-*` families the reference tables row by row. */
export const TABLED_FAMILIES = ['surface', 'text', 'border'] as const;
export type TabledFamily = (typeof TABLED_FAMILIES)[number];

/** Spelled by the role table: a `@role` with this exact text is an explicit empty role. */
const NO_ROLE = '(none)';

type Event = { kind: 'comment'; text: string } | { kind: 'decl'; name: string; value: string };

function fail(message: string): never {
  throw new Error(`semantic-tokens: ${message}`);
}

/**
 * Comments and custom-property declarations of the first `@theme` block, in
 * source order. Comment-aware, so a brace or a `;` inside prose cannot end a
 * declaration; paren-aware, so `light-dark(a, b)` and relative colour syntax
 * survive whole. Nested blocks (`@keyframes` inside `@theme`) are skipped.
 */
export function tokenizeTheme(css: string): Event[] {
  const start = css.indexOf('@theme');
  if (start === -1) fail('no @theme block');
  let i = css.indexOf('{', start);
  if (i === -1) fail('@theme without a block');
  i++;
  const events: Event[] = [];
  let depth = 1;
  while (i < css.length && depth > 0) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) fail('unterminated comment');
      if (depth === 1) events.push({ kind: 'comment', text: css.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    const ch = css[i];
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth--;
      i++;
      continue;
    }
    if (depth === 1 && ch === '-' && css[i + 1] === '-') {
      const colon = css.indexOf(':', i);
      if (colon === -1) fail(`declaration without ':' near "${css.slice(i, i + 40)}"`);
      const name = css.slice(i, colon).trim();
      let j = colon + 1;
      let parens = 0;
      while (j < css.length) {
        if (css.startsWith('/*', j)) {
          const end = css.indexOf('*/', j + 2);
          if (end === -1) fail(`unterminated comment inside ${name}`);
          j = end + 2;
          continue;
        }
        const c = css[j];
        if (c === '(') parens++;
        else if (c === ')') parens--;
        else if ((c === ';' || c === '}') && parens === 0) break;
        j++;
      }
      if (j >= css.length) fail(`${name}: value runs to end of file`);
      const value = css
        .slice(colon + 1, j)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();
      events.push({ kind: 'decl', name, value });
      i = css[j] === ';' ? j + 1 : j;
      continue;
    }
    i++;
  }
  if (depth !== 0) fail('unterminated @theme block');
  return events;
}

interface Marker {
  kind: 'role' | 'absent';
  /** The marker's paragraph — up to the first blank line — whitespace-collapsed. */
  text: string;
  /** Non-blank text between that paragraph and the next marker (or the comment's end). */
  trailing?: string;
}

const MARKER = /@(role|absent)\b([\s\S]*?)(?=@(?:role|absent)\b|$)/g;
const SECTION = /^\s*=== (.+?) ===/;
const BLANK_LINE = /\n[ \t]*\n/;
/** A `--color-x:` inside prose reads as a declaration to the three tests that parse the file with comments intact. */
const DECLARATION_IN_PROSE = /--color-[a-z0-9-]+\s*:/;

/** One sentence: no sentence end followed by a capitalised next one. */
const MAX_MARKER = 140;
const SENTENCE_BREAK = /[.!?]\s+[A-Z]/;

function markersIn(comment: string): Marker[] {
  const out: Marker[] = [];
  for (const m of comment.matchAll(MARKER)) {
    const raw = m[2] ?? '';
    const cut = BLANK_LINE.exec(raw);
    const paragraph = cut ? raw.slice(0, cut.index) : raw;
    const rest = cut ? raw.slice(cut.index + cut[0].length) : '';
    const text = paragraph.replace(/\s+/g, ' ').trim();
    const spelled = DECLARATION_IN_PROSE.exec(text);
    if (spelled)
      fail(
        `a marker spells "${spelled[0].replace(/\s+/g, '')}" — contrast.test.ts, tokens.test.ts and semantic.test.ts read semantic.css with comments intact and would take it for a declaration`
      );
    const trailing = rest.replace(/\s+/g, ' ').trim();
    out.push({
      kind: m[1] as Marker['kind'],
      text,
      ...(trailing ? { trailing } : {})
    });
  }
  return out;
}

/** The limits every marker paragraph is held to, once the token it belongs to is known. */
function checkMarker(
  who: string,
  trailingWho: string,
  text: string,
  trailing: string | undefined
): void {
  if (trailing !== undefined)
    fail(
      `${trailingWho} ("${trailing.slice(0, 48)}") — reasoning goes before the marker, separated by a blank line`
    );
  if (text.length > MAX_MARKER)
    fail(
      `${who} is ${text.length} characters, the limit is ${MAX_MARKER} — one sentence, reasoning before it`
    );
  if (SENTENCE_BREAK.test(text))
    fail(`${who} reads as more than one sentence ("${text}") — one sentence, reasoning before it`);
}

interface Declaration {
  name: string;
  value: string;
  role?: string;
  section: string;
}

/** Declarations with their bound `@role`, plus every `@absent`, plus the intent sections in order. */
function bindMarkers(events: Event[]): {
  declarations: Declaration[];
  absent: Map<string, string>;
  intentSections: string[];
} {
  const declarations: Declaration[] = [];
  const absent = new Map<string, string>();
  const intentSections: string[] = [];
  let section = '';
  let pending: Marker | undefined;
  for (const event of events) {
    if (event.kind === 'comment') {
      const header = SECTION.exec(event.text);
      if (header) {
        section = header[1] ?? '';
        const intent = /^([A-Z-]+) INTENT$/.exec(section);
        if (intent) intentSections.push((intent[1] ?? '').toLowerCase());
      }
      for (const marker of markersIn(event.text)) {
        if (marker.kind === 'absent') {
          const m = /^([a-z0-9-]+)\s*[—-]\s*(.+)$/.exec(marker.text);
          if (!m) fail(`@absent needs "<core> — <reason>", got "${marker.text}"`);
          const [, core, reason] = m;
          if (absent.has(core as string)) fail(`@absent ${core} declared twice`);
          checkMarker(
            `@absent ${core}`,
            `@absent ${core}: text after it`,
            reason as string,
            marker.trailing
          );
          absent.set(core as string, reason as string);
          continue;
        }
        if (pending !== undefined)
          fail(`two @role markers before one declaration ("${pending.text}" / "${marker.text}")`);
        if (marker.text === '')
          fail('empty @role — write "@role (none)" to state that deliberately');
        pending = marker;
      }
      continue;
    }
    let role: string | undefined;
    if (pending !== undefined) {
      role = pending.text === NO_ROLE ? '' : pending.text;
      checkMarker(
        `${event.name}: @role`,
        `${event.name}: text after its @role`,
        role,
        pending.trailing
      );
    }
    declarations.push({ name: event.name, value: event.value, role, section });
    pending = undefined;
  }
  if (pending !== undefined) fail(`@role "${pending.text}" is not followed by a declaration`);
  return { declarations, absent, intentSections };
}

/** Core → value of every `--color-*` in foundation.css (comments stripped). */
function foundationStops(foundationCss: string): Map<string, string> {
  const stops = new Map<string, string>();
  const stripped = foundationCss.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    stops.set(m[1] as string, (m[2] as string).trim());
  }
  if (stops.size === 0) fail('foundation.css yielded no --color-* stops');
  return stops;
}

function lightnessOf(value: string): number | undefined {
  const m = /^oklch\(\s*([\d.]+)/.exec(value);
  return m ? Number(m[1]) : undefined;
}

/** `light-dark(a, b)` → [a, b] split at the top-level comma; anything else → null. */
function splitLightDark(value: string): [string, string] | null {
  const m = /^light-dark\((.*)\)$/s.exec(value);
  if (!m) return null;
  const inner = m[1] as string;
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
  }
  fail(`light-dark() without a top-level comma: ${value}`);
}

interface Branch extends StopValue {
  /** Set when the branch reads a SEMANTIC token verbatim — resolved after all tokens are known. */
  aliasOf?: string;
}

function parseBranch(
  expr: string,
  owner: string,
  foundation: Map<string, string>,
  semanticNames: Set<string>
): Branch {
  const exact = /^var\(--color-([a-z0-9-]+)\)$/.exec(expr);
  const inner = exact ?? /var\(--color-([a-z0-9-]+)\)/.exec(expr);
  if (!inner) return { raw: expr };
  const ref = inner[1] as string;
  // A semantic reference is resolved after every token is known; a derived
  // one (`oklch(from var(--color-surface-base) …)`) stays marked derived.
  if (semanticNames.has(ref)) return { aliasOf: ref, ...(exact ? {} : { derived: true }) };
  const stop = foundation.get(ref);
  if (stop === undefined) fail(`${owner} reads --color-${ref}, which neither file defines`);
  const l = lightnessOf(stop);
  return {
    ref,
    ...(l !== undefined ? { l } : {}),
    ...(exact ? {} : { derived: true })
  };
}

/** Read `semantic.css` (+ `foundation.css` for lightness) into the reference's data. */
export function parseSemanticTokens(semanticCss: string, foundationCss: string): SemanticTokens {
  const foundation = foundationStops(foundationCss);
  const { declarations, absent, intentSections } = bindMarkers(tokenizeTheme(semanticCss));
  if (declarations.length === 0) fail('the @theme block holds no declarations');
  if (intentSections.length === 0) fail('no "=== <NAME> INTENT ===" section found');

  const colorCores = new Set(
    declarations
      .filter((d) => d.name.startsWith('--color-'))
      .map((d) => d.name.slice('--color-'.length))
  );

  const familyOf = (core: string): TabledFamily | undefined =>
    TABLED_FAMILIES.find((f) => core.startsWith(`${f}-`));
  const intentOf = (core: string): string | undefined =>
    intentSections.find((i) => core === i || core.startsWith(`${i}-`));

  // First pass: every tabled or intent token's raw branches, so aliases between
  // them (`text-link` → `primary-text`) can be resolved in a second pass.
  const branches = new Map<string, { light: Branch; dark: Branch }>();
  const roles = new Map<string, string>();
  const families: Record<TabledFamily, string[]> = { surface: [], text: [], border: [] };
  const intentTokens = new Map<string, Map<string, string>>(); // intent → suffix → core
  const notTabled: string[] = [];

  for (const d of declarations) {
    if (!d.name.startsWith('--color-')) {
      if (d.role !== undefined)
        fail(`${d.name} carries a @role but the reference does not table it`);
      notTabled.push(d.name);
      continue;
    }
    const core = d.name.slice('--color-'.length);
    const family = familyOf(core);
    const intent = intentOf(core);
    if (family === undefined && intent === undefined) {
      if (d.role !== undefined)
        fail(`${d.name} carries a @role but the reference does not table it`);
      notTabled.push(d.name);
      continue;
    }
    const halves = splitLightDark(d.value) ?? [d.value, d.value];
    branches.set(core, {
      light: parseBranch(halves[0], d.name, foundation, colorCores),
      dark: parseBranch(halves[1], d.name, foundation, colorCores)
    });
    if (d.role !== undefined) roles.set(core, d.role);
    if (family !== undefined) {
      if (d.role === undefined) fail(`${d.name} has no @role marker`);
      families[family].push(core);
    } else if (intent !== undefined) {
      if (!/^[A-Z-]+ INTENT$/.test(d.section))
        fail(`${d.name} is named like the ${intent} intent but sits in section "${d.section}"`);
      const suffix = core === intent ? 'base' : core.slice(intent.length + 1);
      const byIntent = intentTokens.get(intent) ?? new Map<string, string>();
      byIntent.set(suffix, core);
      intentTokens.set(intent, byIntent);
    }
  }

  for (const d of declarations) {
    if (!d.name.startsWith('--color-')) continue;
    if (
      /^[A-Z-]+ INTENT$/.test(d.section) &&
      intentOf(d.name.slice('--color-'.length)) === undefined
    )
      fail(`${d.name} sits in section "${d.section}" but is not named after its intent`);
  }

  const resolve = (branch: Branch, trail: string[]): StopValue => {
    if (branch.aliasOf === undefined) {
      const { aliasOf: _drop, ...stop } = branch;
      return stop;
    }
    if (trail.includes(branch.aliasOf))
      fail(`alias cycle: ${[...trail, branch.aliasOf].join(' → ')}`);
    const target = branches.get(branch.aliasOf);
    if (!target)
      fail(`${trail.at(-1)} aliases --color-${branch.aliasOf}, which the reference does not table`);
    const side = trail[0]?.endsWith(':dark') ? target.dark : target.light;
    const resolved = resolve(side, [...trail, branch.aliasOf]);
    return branch.derived ? { ...resolved, derived: true } : resolved;
  };
  const modeValues = (core: string): ModeValues => {
    const b = branches.get(core) as { light: Branch; dark: Branch };
    return {
      light: resolve(b.light, [`${core}:light`]),
      dark: resolve(b.dark, [`${core}:dark`])
    };
  };
  /** The semantic core a token reads VERBATIM in both branches — a derived read is not an alias. */
  const aliasOf = (core: string): string | undefined => {
    const b = branches.get(core) as { light: Branch; dark: Branch };
    return b.light.aliasOf !== undefined &&
      b.light.aliasOf === b.dark.aliasOf &&
      !b.light.derived &&
      !b.dark.derived
      ? b.light.aliasOf
      : undefined;
  };

  const tabled = (family: TabledFamily): SemanticToken[] =>
    families[family].map((core) => {
      const alias = aliasOf(core);
      return {
        name: core,
        role: roles.get(core) as string,
        ...(alias !== undefined ? { alias } : {}),
        ...modeValues(core)
      };
    });

  // Intents: the first section is the exemplar; its markers define the roles
  // of every suffix, every other intent inherits by suffix and may refine.
  const exemplar = intentSections[0] as string;
  const exemplarTokens = intentTokens.get(exemplar);
  if (!exemplarTokens) fail(`the exemplar intent "${exemplar}" declares no tokens`);
  const intentRoles: IntentRole[] = [];
  for (const [suffix, core] of exemplarTokens) {
    const role = roles.get(core);
    if (role === undefined) fail(`--color-${core} (exemplar ${exemplar}) has no @role marker`);
    intentRoles.push({ suffix, role });
  }

  const entries: IntentStops[] = [];
  const notes: IntentNote[] = [];
  const absentRoles: AbsentRole[] = [];
  const absentSeen = new Set<string>();
  for (const intent of intentSections) {
    const tokens = intentTokens.get(intent);
    if (!tokens) fail(`the ${intent} intent declares no tokens`);
    const stops: Record<string, ModeValues> = {};
    for (const { suffix } of intentRoles) {
      const core = tokens.get(suffix);
      if (core === undefined) {
        const expected = suffix === 'base' ? intent : `${intent}-${suffix}`;
        const reason = absent.get(expected);
        if (reason === undefined)
          fail(
            `the ${intent} intent has no -${suffix} token and no "@absent ${expected} — …" marker`
          );
        absentSeen.add(expected);
        absentRoles.push({ intent, suffix, reason });
        continue;
      }
      stops[suffix] = modeValues(core);
      const note = roles.get(core);
      if (note !== undefined && intent !== exemplar) notes.push({ intent, suffix, note });
    }
    for (const suffix of tokens.keys()) {
      if (!intentRoles.some((r) => r.suffix === suffix))
        fail(`--color-${intent}-${suffix}: the exemplar ${exemplar} has no such role`);
    }
    entries.push({ name: intent, stops });
  }
  for (const core of absent.keys()) {
    if (!absentSeen.has(core))
      fail(`@absent ${core} names a token that exists or belongs to no intent — remove the marker`);
  }

  return {
    families: {
      surface: tabled('surface'),
      text: tabled('text'),
      border: tabled('border')
    },
    intents: { exemplar, roles: intentRoles, entries, notes, absent: absentRoles },
    notTabled
  };
}

// ── module emitter ────────────────────────────────────────────────────────────

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function literal(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((v) => `${indent}  ${literal(v, `${indent}  `)}`).join(',\n');
    return `[\n${inner}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    // A leaf object (a StopValue) reads better on one line: `{ ref: 'neutral-600', l: 0.42 }`.
    if (entries.every(([, v]) => v === null || typeof v !== 'object')) {
      const flat = entries
        .map(([k, v]) => `${IDENTIFIER.test(k) ? k : quote(k)}: ${literal(v, indent)}`)
        .join(', ');
      return `{ ${flat} }`;
    }
    const inner = entries
      .map(
        ([k, v]) => `${indent}  ${IDENTIFIER.test(k) ? k : quote(k)}: ${literal(v, `${indent}  `)}`
      )
      .join(',\n');
    return `{\n${inner}\n${indent}}`;
  }
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  fail(`cannot emit ${String(value)}`);
}

/** The committed TS module: header, then the data as one typed constant. */
export function renderModule(data: SemanticTokens): string {
  return [
    '// DO NOT EDIT — generated by packages/design-engine/scripts/semantic-tokens-gen.ts',
    '// (`bun run tokens:reference`; `bun run tokens:reference:check` fails when this is stale).',
    '// Source: packages/blocks/src/lib/style/semantic.css, plus foundation.css for the',
    '// OKLCH lightness of each stop in the default chassis.',
    '//',
    '// The surface / text / border tables and the intent roles of the CSS token',
    '// reference (`urbicon css-reference`, `get_css_reference`) render from this, so',
    '// the reference cannot state a stop the CSS does not have. Role sentences are the',
    '// `@role` / `@absent` markers in semantic.css — edit them there.',
    '',
    "import type { SemanticTokens } from './semantic-tokens.js';",
    '',
    `export const SEMANTIC_TOKENS: SemanticTokens = ${literal(data, '')};`,
    ''
  ].join('\n');
}
