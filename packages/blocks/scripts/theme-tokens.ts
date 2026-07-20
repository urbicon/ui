/**
 * theme-tokens — pure helpers for the variants-lint theme-existence guard.
 *
 * Background: seven Calendar slots referenced `text-2xs` while `--text-2xs`
 * was defined nowhere — Tailwind emitted ZERO CSS for the class and
 * `Calendar size="sm"` silently rendered like `md`. In Tailwind 4 a utility
 * in a theme-driven namespace only exists when its `--<ns>-<key>` variable is
 * declared in an `@theme` block, so class-name → theme-key existence is
 * statically checkable: collect every `@theme` variable from the repo's own
 * styles plus Tailwind's default theme, then verify each scale-suffixed class
 * in the tv() configs against that set.
 *
 * Covered namespaces (each rule ground-truthed against the real Tailwind 4
 * compiler, see scripts/theme-tokens.test.ts):
 *
 *   text-<size>                  → --text-<key>       (+ static aligns/wraps,
 *                                                       + colour keys)
 *   rounded[-<corner>]-<radius>  → --radius-<key>     (+ none/full, bare compat)
 *   shadow- / inset-shadow- /
 *   drop-shadow- / text-shadow-  → --<ns>-<key>       (+ none, bare, colour keys)
 *   blur-<size>                  → --blur-<key>       (+ none, bare)
 *   tracking-<size>              → --tracking-<key>
 *   leading-<size>               → --leading-<key>    (+ none, spacing numbers)
 *   ease-<curve>                 → --ease-<key>       (+ linear/initial)
 *
 * Skipped by design:
 *   - arbitrary values (`text-[13px]`), custom-property shorthands
 *     (`ease-(--blocks-ease-confident)`) and arbitrary properties
 *     (`[font:inherit]`) — resolved without the theme;
 *   - colour keys of colour-capable namespaces pass via `--color-<key>` —
 *     colour-token *policy* is the design-engine linter's job, not this guard's;
 *   - `font-`: font-family keys are legitimately consumer-supplied (the docs
 *     app styles `font-meta` itself, scoped under `.docs-rooms`);
 *   - `animate-`: the repo pattern is component-local `:global(.animate-…)`
 *     CSS (Progress), invisible to any theme scan.
 *
 * Pure string-in/string-out module — no Bun APIs, importable from vitest.
 */

/** Strip CSS block comments (they may quote `--var:` examples). */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Collect every custom property declared at the top level of any `@theme`
 * block (including Tailwind's `@theme default inline reference` compat
 * block). Depth-aware: declarations inside nested blocks (`@keyframes` in
 * Tailwind's default theme) and outside `@theme` (`:root`) are excluded.
 */
export function collectThemeVars(css: string): Set<string> {
  const src = stripCssComments(css);
  const vars = new Set<string>();
  const themeStart = /@theme[^{]*\{/g;
  let match = themeStart.exec(src);
  while (match !== null) {
    let depth = 1;
    let i = themeStart.lastIndex;
    let declStart = true; // directly after `{` / `}` / `;` (+ whitespace)
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') {
        depth++;
        declStart = true;
      } else if (ch === '}') {
        depth--;
        declStart = true;
      } else if (ch === ';') {
        declStart = true;
      } else if (declStart && depth === 1 && ch === '-' && src[i + 1] === '-') {
        const colon = src.indexOf(':', i);
        if (colon === -1) break;
        const name = src.slice(i, colon).trim();
        if (/^--[A-Za-z0-9-]+$/.test(name)) vars.add(name);
        i = colon;
        declStart = false;
      } else if (!/\s/.test(ch)) {
        declStart = false;
      }
      i++;
    }
    themeStart.lastIndex = i;
    match = themeStart.exec(src);
  }
  return vars;
}

/**
 * Reduce a full class token to its utility: strip variant prefixes
 * (`hover:`, `sm:`, `data-[state=open]:` — last `:` outside brackets),
 * the important marker (`!` either end) and a leading negative `-`.
 */
export function utilityOf(rawClass: string): string {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < rawClass.length; i++) {
    const ch = rawClass[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) lastColon = i;
  }
  let u = rawClass.slice(lastColon + 1);
  if (u.startsWith('!')) u = u.slice(1);
  if (u.endsWith('!')) u = u.slice(0, -1);
  if (u.startsWith('-')) u = u.slice(1);
  return u;
}

/** text-align / text-wrap / text-overflow keywords — static, not theme-driven. */
const TEXT_STATICS = new Set([
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip'
]);

/** Colour keywords that need no `--color-*` variable. */
const COLOR_KEYWORDS = new Set(['inherit', 'current', 'transparent']);

const NONE = new Set(['none']);

type Namespace = {
  /** class prefix, without the trailing `-` */
  prefix: string;
  /** theme variable namespace: key `<k>` must exist as `--<varNs>-<k>` */
  varNs: string;
  /** the bare prefix alone is a valid utility (compat vars / shorthand) */
  bare?: boolean;
  /** keys resolving via `--color-<k>` (or a colour keyword) also pass */
  colors?: boolean;
  /** plain numbers are valid keys (spacing-scale based, e.g. leading-4) */
  numeric?: boolean;
  statics?: ReadonlySet<string>;
};

/** Ordered longest-prefix-first so `text-shadow-*` never falls into `text-*`. */
const NAMESPACES: Namespace[] = [
  { prefix: 'inset-shadow', varNs: 'inset-shadow', bare: true, colors: true, statics: NONE },
  { prefix: 'drop-shadow', varNs: 'drop-shadow', bare: true, colors: true, statics: NONE },
  { prefix: 'text-shadow', varNs: 'text-shadow', bare: true, colors: true, statics: NONE },
  { prefix: 'shadow', varNs: 'shadow', bare: true, colors: true, statics: NONE },
  { prefix: 'text', varNs: 'text', colors: true, statics: TEXT_STATICS },
  { prefix: 'tracking', varNs: 'tracking' },
  { prefix: 'leading', varNs: 'leading', numeric: true, statics: NONE },
  { prefix: 'blur', varNs: 'blur', bare: true, statics: NONE },
  { prefix: 'ease', varNs: 'ease', statics: new Set(['linear', 'initial']) }
];

/** `rounded` with optional physical/logical side or corner infix. */
const ROUNDED_RE = /^rounded(?:-(ss|se|es|ee|tl|tr|br|bl|t|r|b|l|s|e))?(?:-(.+))?$/;

export type ThemeTokenFinding = {
  /** the utility after prefix/important/negative stripping */
  utility: string;
  /** theme variables whose absence makes the class emit no CSS */
  lookedFor: string[];
};

/**
 * Check one class token against the collected theme variables.
 * Returns null when the class is fine or out of this guard's scope,
 * a finding when it sits in a guarded namespace with an undefined key.
 */
export function checkClassToken(
  rawClass: string,
  themeVars: ReadonlySet<string>
): ThemeTokenFinding | null {
  let u = utilityOf(rawClass);
  if (u.length === 0) return null;
  // Arbitrary value / arbitrary property / custom-property shorthand.
  if (u.includes('[') || u.includes('(')) return null;
  // Opacity or line-height modifier (`text-primary/70`, `text-sm/6`).
  const slash = u.lastIndexOf('/');
  if (slash !== -1) u = u.slice(0, slash);
  if (u.length === 0) return null;

  const rounded = u.match(ROUNDED_RE);
  if (rounded) {
    const key = rounded[2];
    // bare `rounded` / `rounded-t` → Tailwind's `--radius` compat default
    if (key === undefined) return null;
    if (key === 'none' || key === 'full') return null;
    if (themeVars.has(`--radius-${key}`)) return null;
    return { utility: u, lookedFor: [`--radius-${key}`] };
  }

  for (const ns of NAMESPACES) {
    if (u === ns.prefix) {
      return ns.bare ? null : { utility: u, lookedFor: [`--${ns.varNs}`] };
    }
    if (!u.startsWith(`${ns.prefix}-`)) continue;
    const key = u.slice(ns.prefix.length + 1);
    if (key.length === 0) return { utility: u, lookedFor: [`--${ns.varNs}-`] };
    if (ns.statics?.has(key)) return null;
    if (ns.numeric && /^\d+(?:\.\d+)?$/.test(key)) return null;
    const lookedFor = [`--${ns.varNs}-${key}`];
    if (themeVars.has(lookedFor[0])) return null;
    if (ns.colors) {
      if (COLOR_KEYWORDS.has(key)) return null;
      lookedFor.push(`--color-${key}`);
      if (themeVars.has(`--color-${key}`)) return null;
    }
    return { utility: u, lookedFor };
  }
  return null;
}
