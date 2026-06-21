/**
 * Deterministic design rules. Each is a fact about the code — a regex/string
 * match with no judgement — so it can carry `error`/`warning` severity and be
 * covered by regression tests. The prose source is the Anti-Patterns section of
 * `design-system/principles.md` plus the documented known failure modes
 * (token hallucination, dynamic Tailwind classes).
 */

import {
  INTENT_NAMES,
  INTENT_PREFIXES,
  KNOWN_BAD_NAMESPACES,
  KNOWN_FOREIGN_CORES,
  SEMANTIC_NAMESPACES,
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

/**
 * Token hallucination: a colour utility whose core *looks* like an Urbicon UI
 * semantic token (right namespace / intent prefix) but is not in the validated
 * whitelist. Narrow by construction — only fires on our own namespaces, so it
 * never flags `bg-transparent`, `bg-cover`, or arbitrary `bg-[#fff]`.
 */
const tokenHallucination: Rule = {
  id: 'token-hallucination',
  severity: 'warning',
  description:
    'Colour utility referencing a non-existent semantic token (e.g. `bg-status-danger`).',
  check(lines) {
    const prefixAlt = COLOR_PREFIXES.join('|');
    // capture: prefix, then the core up to a class boundary / opacity / end
    const re = new RegExp(`\\b(${prefixAlt})-([a-z][a-z0-9-]*)(?:\\/\\d{1,3})?\\b`, 'g');
    const findings: Finding[] = [];

    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const core = m[2]!;
        if (!looksSemantic(core)) continue;
        if (VALID_TOKEN_CORES.has(core)) continue;

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

/** All deterministic rules, in report order. */
export const RULES: Rule[] = [
  rawTailwindColor,
  darkModeOverride,
  focusNotVisible,
  hardcodedZIndex,
  dynamicClassInterpolation,
  tokenHallucination
];
