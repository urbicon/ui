/**
 * Deterministic design rules. Each is a fact about the code — a regex/string
 * match with no judgement — so it can carry `error`/`warning` severity and be
 * covered by regression tests. The prose source is the Anti-Patterns section of
 * `design-system/principles.md` plus the documented known failure modes
 * (token hallucination, dynamic Tailwind classes).
 *
 * All class-utility / module-specifier rules declare `scope: 'code'`: they scan
 * the code view (scope.ts) — class attributes, script/expression literals,
 * `@apply` — never prose text content, so a page that *quotes* an anti-pattern
 * (linter docs, before/after migration guides) is not flagged as committing it.
 * The markup rules (markup-rules.ts) stay file-scoped: they are structurally
 * scoped to elements already.
 */

import { MARKUP_RULES } from './markup-rules.js';
import {
  INTENT_NAMES,
  INTENT_PREFIXES,
  KNOWN_BAD_NAMESPACES,
  KNOWN_FOREIGN_CORES,
  SEMANTIC_NAMESPACES,
  suggestIntentTypo,
  VALID_TOKEN_CORES
} from './tokens.js';
import type { Finding, Rule } from './types.js';

const SHADCN_FIX =
  'This is shadcn/ui vocabulary, not Urbicon UI. Use surface tokens (`bg-surface-base`/`-elevated`), text tokens (`text-text-primary`/`-secondary`), or intents (`bg-primary`, `text-success`).';

/** shadcn/ui-family cores (bare set + `-foreground` suffix + `fg`/`fg-`). */
function isForeignVocab(core: string): boolean {
  return (
    KNOWN_FOREIGN_CORES.has(core) ||
    core.endsWith('-foreground') ||
    core === 'fg' ||
    core.startsWith('fg-')
  );
}

/** Tailwind's default chromatic palette names — none are Urbicon UI tokens. `neutral` is ours, so it is excluded. */
const RAW_PALETTE =
  'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

/** Colour-bearing Tailwind prefixes (longest first so `border-l` wins over `border`). */
const COLOR_PREFIXES = [
  'ring-offset',
  'border-x',
  'border-y',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'border-s',
  'border-e',
  'bg',
  'text',
  'border',
  'ring',
  'divide',
  'outline',
  'decoration',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'accent',
  'caret',
  'placeholder'
];

/** Tailwind utility roots that take a scale/value — used to catch broken dynamic interpolation. */
const DYNAMIC_UTILITY_ROOTS = [
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'w',
  'h',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'size',
  'text',
  'bg',
  'border',
  'rounded',
  'grid-cols',
  'grid-rows',
  'col-span',
  'row-span',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'z',
  'leading',
  'tracking',
  'opacity',
  'scale',
  'rotate',
  'translate-x',
  'translate-y',
  'duration',
  'delay'
];

function dedupeByLine(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    const key = `${f.ruleId}:${f.line}:${f.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

const rawTailwindColor: Rule = {
  id: 'raw-tailwind-color',
  scope: 'code',
  severity: 'error',
  description: 'Raw Tailwind palette colour (e.g. `bg-blue-500`) instead of a semantic token.',
  check(lines) {
    // Trailing `(?![a-z0-9-])` (not `\b`) so an optional `/NN` opacity suffix stays in the match.
    const re = new RegExp(
      `\\b(?:${COLOR_PREFIXES.join('|')})-(?:${RAW_PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\\/\\d{1,3})?(?![a-z0-9-])`,
      'g'
    );
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Raw Tailwind colour \`${m[0]}\` bypasses the token system (no dark-mode adaptation, no theming).`,
          fix: 'Use a semantic token: `bg-surface-*`, `text-text-*`, `border-border-*`, or an intent (`bg-primary`, `text-success`).',
          line: i + 1,
          match: m[0]
        });
      }
    });
    return dedupeByLine(findings);
  }
};

const darkModeOverride: Rule = {
  id: 'dark-mode-override',
  scope: 'code',
  severity: 'error',
  description: 'Manual `dark:` override instead of automatic `light-dark()` semantic tokens.',
  check(lines) {
    // `!` covers the Tailwind important modifier (`dark:!bg-…`).
    const re = /\bdark:[a-z[!]/g;
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message:
            'Manual `dark:` override. Dark mode resolves automatically via `light-dark()` semantic tokens.',
          fix: 'Remove the `dark:` variant and rely on semantic tokens (`bg-surface-elevated` etc.), which already switch.',
          line: i + 1,
          match: m[0].slice(0, -1)
        });
      }
    });
    return dedupeByLine(findings);
  }
};

const focusNotVisible: Rule = {
  id: 'focus-not-visible',
  scope: 'code',
  severity: 'error',
  description: 'Plain `focus:` ring instead of keyboard-only `focus-visible:`.',
  check(lines) {
    // `focus:` followed by a utility start, but never `focus-visible:`/`focus-within:`
    // (those contain `focus-`, not `focus:`). Catches `group-focus:` / `peer-focus:` too.
    const re = /\bfocus:(?=[a-z[])/g;
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const _ of line.matchAll(re)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message:
            '`focus:` shows a focus ring on mouse clicks too. Keyboard-only rings are the house style.',
          fix: 'Use `focus-visible:` instead of `focus:`.',
          line: i + 1,
          match: 'focus:'
        });
      }
    });
    return dedupeByLine(findings);
  }
};

const hardcodedZIndex: Rule = {
  id: 'hardcoded-z-index',
  scope: 'code',
  severity: 'error',
  description: 'Hardcoded z-index instead of a `z-[var(--z-*)]` token.',
  check(lines) {
    // `z-10`, `z-50`, `z-[999]` — but not `z-[var(--z-modal)]` or `z-auto`.
    // Trailing `(?![\w-])` (not `\b`) so the bracket form terminates correctly after `]`.
    const re = /\bz-(?:\d{1,4}|\[\d{1,4}\])(?![\w-])/g;
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Hardcoded z-index \`${m[0]}\` collides with the layering scale and can sit behind/above the wrong overlay.`,
          fix: 'Use a z-index token: `z-[var(--z-modal)]`, `z-[var(--z-dropdown)]`, `z-[var(--z-tooltip)]`, …',
          line: i + 1,
          match: m[0]
        });
      }
    });
    return dedupeByLine(findings);
  }
};

const dynamicClassInterpolation: Rule = {
  id: 'dynamic-class-interpolation',
  scope: 'code',
  severity: 'error',
  description:
    'String-interpolated Tailwind class fragment (e.g. `gap-{x}`) — never compiled by Tailwind.',
  check(lines) {
    // A Tailwind utility root immediately glued to a `{` or `${` interpolation.
    // Tailwind needs static class names; `gap-${x}` produces no CSS at all.
    const re = new RegExp(`\\b(?:${DYNAMIC_UTILITY_ROOTS.join('|')})-(\\$\\{|\\{)`, 'g');
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Interpolated class fragment \`${m[0]}…\` — Tailwind only compiles static class names, so this utility is never generated.`,
          fix: "Switch the whole class string per state: `class={isHero ? 'gap-4' : 'gap-3'}` — keep each utility a complete literal.",
          line: i + 1,
          match: m[0]
        });
      }
    });
    return dedupeByLine(findings);
  }
};

/** Subpath segments that are internal to an `@urbicon-ui` package — never a public export. */
const INTERNAL_SUBPATH_SEGMENTS = new Set([
  'primitives',
  'components',
  'lib',
  'dist',
  'src',
  'icons'
]);

/**
 * A deep import into an `@urbicon-ui` package: either a concrete component/module
 * file (`…/Button.svelte`, `…/foo.js`) or a path through an internal directory
 * (`primitives/`, `components/`, …). The documented public subpaths — `./date`,
 * `./style/*.css`, `./i18n/en` — are flat, extensionless-or-CSS, and stay allowed.
 */
function isDeepInternalSubpath(subpath: string): boolean {
  if (/\.svelte(\.[jt]s)?$|\.[jt]s$/.test(subpath)) return true;
  return subpath.split('/').some((seg) => INTERNAL_SUBPATH_SEGMENTS.has(seg));
}

const deepInternalImport: Rule = {
  id: 'deep-internal-import',
  scope: 'code',
  severity: 'error',
  description: 'Deep/internal import into an `@urbicon-ui` package instead of its public root.',
  check(lines) {
    // The module specifier of any import / export-from / @import / dynamic import.
    const re = /['"](@urbicon-ui\/[a-z-]+)\/([^'"]+)['"]/g;
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const pkg = m[1] ?? '';
        const subpath = m[2] ?? '';
        if (!isDeepInternalSubpath(subpath)) continue;
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Deep import \`${pkg}/${subpath}\` reaches into ${pkg}'s internals — they can move between releases.`,
          fix: `Import from the package root: \`import { … } from '${pkg}'\`.`,
          line: i + 1,
          match: `${pkg}/${subpath}`
        });
      }
    });
    return dedupeByLine(findings);
  }
};

const hardcodedMotion: Rule = {
  id: 'hardcoded-motion',
  scope: 'code',
  severity: 'error',
  description:
    'Hardcoded transition duration or `cubic-bezier()` easing instead of a motion token.',
  check(lines) {
    // `duration-[250ms]` / `duration-[0.2s]` — but not `duration-[var(--blocks-duration-fast)]`.
    const duration = /\bduration-\[\d+(?:\.\d+)?m?s\]/g;
    // `ease-[cubic-bezier(…)]` — but not `ease-[var(--blocks-ease-smooth)]` or named `ease-out`.
    const easing = /\bease-\[cubic-bezier\([^\]]*\)\]/g;
    const findings: Finding[] = [];
    lines.forEach((line, i) => {
      for (const m of line.matchAll(duration)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Hardcoded transition duration \`${m[0]}\` bypasses the motion scale (no global speed / reduced-motion control).`,
          fix: 'Use a duration token: `duration-[var(--blocks-duration-fast)]` / `-normal` / `-slow`.',
          line: i + 1,
          match: m[0]
        });
      }
      for (const m of line.matchAll(easing)) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `Hardcoded \`cubic-bezier()\` easing \`${m[0]}\` bypasses the motion system's easing tokens.`,
          fix: 'Use an easing token: `ease-[var(--blocks-ease-smooth)]` / `-snappy` / `-gentle`, or a named Tailwind ease (`ease-out`).',
          line: i + 1,
          match: m[0]
        });
      }
    });
    return dedupeByLine(findings);
  }
};

/**
 * Token hallucination: a colour utility whose core *looks* like an Urbicon UI
 * semantic token (right namespace / intent prefix) but is not in the validated
 * whitelist. Narrow by construction — only fires on our own namespaces, so it
 * never flags `bg-transparent`, `bg-cover`, or arbitrary `bg-[#fff]`.
 *
 * **`error`, not `warning`, since 2026-07-31.** A hallucinated token is a dead
 * reference, not a matter of taste: in Tailwind 4 a utility in a theme-driven
 * namespace emits no CSS at all when its variable does not exist, so the element
 * renders with no colour whatsoever.
 *
 * The old severity let exactly that pass a gate that blocks on errors. Measured,
 * not hypothetical: a recorded baseline run first used raw Tailwind colours;
 * when the linter rejected those, the fix round replaced them with token-*shaped*
 * names that do not exist (`bg-surface-raised`, `text-text-muted`,
 * `text-text-inverse`, `bg-surface-inverse-hover`). The `raw-tailwind-color`
 * errors disappeared, fifteen hallucination warnings appeared, and the result
 * scored **correctness 25 with zero errors** while rendering completely
 * unstyled — and looking system-conformant in review.
 *
 * The axis assignment already said as much: this rule lowers *correctness*, not
 * craft. Severity and axis simply disagreed. They agree now.
 *
 * This is a gate-breaking change for a consumer whose generated markup contains
 * an invented token — which is the point, and the finding names the real token
 * to use.
 */
const tokenHallucination: Rule = {
  id: 'token-hallucination',
  scope: 'code',
  severity: 'error',
  description:
    'Colour utility referencing a non-existent semantic token (e.g. `bg-status-danger`).',
  check(lines, _raw, ctx) {
    // The effective whitelist for this run: per-call project tokens merged in by
    // lintDesign, or the built-in set when the rule is invoked standalone.
    const validCores = ctx?.validTokenCores ?? VALID_TOKEN_CORES;
    const prefixAlt = COLOR_PREFIXES.join('|');
    // capture: prefix, then the core up to a class boundary / opacity / end
    const re = new RegExp(`\\b(${prefixAlt})-([a-z][a-z0-9-]*)(?:\\/\\d{1,3})?\\b`, 'g');
    const findings: Finding[] = [];

    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const core = m[2] ?? '';
        if (!looksSemantic(core)) {
          // Not in our vocabulary — but a bare core one edit from an intent is almost
          // certainly a misspelling (`bg-primay` → `bg-primary`), where the namespace
          // heuristic alone would let it pass silently. Arbitrary cores (`bg-cover`,
          // `bg-brand`) are far from every intent and stay unflagged.
          const intended = suggestIntentTypo(core);
          if (intended) {
            findings.push({
              ruleId: this.id,
              severity: this.severity,
              kind: 'deterministic',
              message: `\`${m[1]}-${core}\` looks like a typo of \`${m[1]}-${intended}\`.`,
              fix: `Did you mean \`${m[1]}-${intended}\`? Valid intents: ${INTENT_NAMES.join(', ')}.`,
              line: i + 1,
              match: m[0]
            });
          }
          continue;
        }
        if (validCores.has(core)) continue;

        findings.push({
          ruleId: this.id,
          severity: this.severity,
          kind: 'deterministic',
          message: `\`${m[1]}-${core}\` is not a real token — likely hallucinated.`,
          fix: suggestForBadCore(core),
          line: i + 1,
          match: m[0] // full token incl. any `/NN` opacity suffix
        });
      }
    });
    return dedupeByLine(findings);
  }
};

/** Does this utility core sit in one of our semantic namespaces / intent families? */
function looksSemantic(core: string): boolean {
  // Font-size cores (`text-sm`, `text-2xl`) share the `text-` namespace but are not colour tokens.
  if (/^text-(?:xs|sm|base|lg|\d?xl)$/.test(core)) return false;
  if (isForeignVocab(core)) return true; // shadcn/ui vocabulary — always foreign
  if (SEMANTIC_NAMESPACES.some((ns) => core.startsWith(ns))) return true;
  if (core.startsWith('status-')) return true; // owned-looking, never valid → flag
  // intent-with-suffix: `primary-muted`, `success-foo` (bare `primary` is valid and caught by the whitelist)
  for (const intent of INTENT_PREFIXES) {
    if (core.startsWith(`${intent}-`)) return true;
  }
  if (core.endsWith('-fg')) return true; // `-foreground` is already covered by isForeignVocab above
  return false;
}

function suggestForBadCore(core: string): string {
  // The `-foreground` family is the most common shadcn pattern — give the precise replacement first.
  if (
    core === 'foreground' ||
    core.endsWith('-foreground') ||
    core === 'fg' ||
    core.endsWith('-fg')
  ) {
    return 'Use `text-on-primary` / `text-on-surface` for foreground-on-intent text, or `text-text-primary`/`-secondary` for general text.';
  }
  if (isForeignVocab(core)) return SHADCN_FIX;
  for (const [bad, hint] of Object.entries(KNOWN_BAD_NAMESPACES)) {
    if (bad.endsWith('-') ? core.startsWith(bad) : core.endsWith(bad)) return hint;
  }
  if (core.startsWith('surface-'))
    return 'Valid surfaces: surface-base/quiet/subtle/elevated/overlay/hover/active/selected/inverted.';
  if (core.startsWith('feedback-'))
    return 'Valid feedback tokens: feedback-{info,success,warning,error}[-subtle].';
  const intent = INTENT_NAMES.find((n) => core.startsWith(`${n}-`));
  if (intent)
    return `Valid \`${intent}\` variants: ${intent}, ${intent}-hover, ${intent}-active, ${intent}-subtle, ${intent}-emphasis, or a scale step ${intent}-50…${intent}-950.`;
  return 'Check `get_css_reference()` for the exact token name.';
}

/** All deterministic rules, in report order. The line-based regex rules first, then
 * the AST-pass rules (which read whole elements, not single lines). */
export const RULES: Rule[] = [
  rawTailwindColor,
  darkModeOverride,
  focusNotVisible,
  hardcodedZIndex,
  hardcodedMotion,
  deepInternalImport,
  dynamicClassInterpolation,
  tokenHallucination,
  ...MARKUP_RULES
];
