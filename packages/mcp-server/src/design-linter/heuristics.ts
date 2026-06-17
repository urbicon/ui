/**
 * Distribution heuristics — stage 2 of the validator. These are *judgements*
 * about how design properties are spread across a page, not facts, so they emit
 * `info`/`heuristic` findings with a light score impact. They operationalise the
 * Design-Quality guidance ("Color = meaning", "Spacing = hierarchy", "Vary
 * visual weight", "Commit to a radius") and target the exact monotony that
 * scored lowest in design-quality evaluation (uniform spacing, rainbow
 * intents, identical Cards, zero radius strategy).
 *
 * Thresholds are named constants so the eval-suite (WP5) can tune them with data
 * instead of guesswork.
 */

import type { Finding } from './types.js';

/**
 * Chromatic intents only — `neutral` is structural greyscale, so neutral
 * backgrounds (common and legitimate) must not count toward a decorative
 * "rainbow". `info` is a distinct blue hue and does count.
 */
const CHROMATIC_INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as const;

/** Tunable thresholds. Kept together so evaluation can adjust them in one place. */
export const HEURISTIC_THRESHOLDS = {
  /** Distinct intent hues used as backgrounds before it reads as a decorative "rainbow". */
  rainbowIntentFamilies: 4,
  /** Minimum spacing utilities before uniformity is judged (avoids nagging tiny snippets). */
  minSpacingUtilities: 6,
  /** Minimum Card instances before monotony is judged. */
  minCards: 4,
  /** Minimum structural surfaces before a missing radius strategy is worth a nudge. */
  minSurfacesForRadius: 3
} as const;

/** All atoms inside class strings, lower-cased, comments already masked upstream. */
function collectAtoms(code: string): string[] {
  const atoms: string[] = [];
  // class="...", class={...}, slotClasses={{ base: '...' }} — grab quoted runs of utility-ish text.
  const stringRe = /["'`]([^"'`]*?)["'`]/g;
  for (const m of code.matchAll(stringRe)) {
    const body = m[1]!;
    if (!/[a-z]-/.test(body) && !/\b(flex|grid|block|hidden|relative|absolute)\b/.test(body))
      continue;
    for (const atom of body.split(/\s+/)) {
      if (atom) atoms.push(atom);
    }
  }
  return atoms;
}

/** "Color = meaning": flag a decorative rainbow of intent backgrounds. */
function checkIntentRainbow(atoms: string[]): Finding[] {
  const families = new Set<string>();
  const bgIntent = new RegExp(
    `^bg-(${CHROMATIC_INTENTS.join('|')})(?:-(?:hover|active|subtle|emphasis|\\d{2,3}))?(?:\\/\\d{1,3})?$`
  );
  for (const atom of atoms) {
    const m = atom.match(bgIntent);
    if (m) families.add(m[1]!);
  }
  if (families.size >= HEURISTIC_THRESHOLDS.rainbowIntentFamilies) {
    return [
      {
        ruleId: 'intent-rainbow',
        severity: 'info',
        kind: 'heuristic',
        message: `${families.size} different intent hues used as backgrounds (${[...families].join(', ')}). Reads as decoration, not meaning.`,
        fix: 'Let neutral surfaces dominate (80–90%). Reserve intent colour for genuine status/severity/action signals.'
      }
    ];
  }
  return [];
}

/** "Spacing = hierarchy": flag a single uniform rhythm tier. */
function checkSpacingUniformity(atoms: string[]): Finding[] {
  const values = new Set<string>();
  let total = 0;
  const spacingRe = /^(?:gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?|px)$/;
  for (const atom of atoms) {
    const m = atom.match(spacingRe);
    if (m) {
      values.add(m[1]!);
      total++;
    }
  }
  if (total >= HEURISTIC_THRESHOLDS.minSpacingUtilities && values.size <= 1) {
    return [
      {
        ruleId: 'spacing-uniform',
        severity: 'info',
        kind: 'heuristic',
        message: `All ${total} spacing utilities use one value (\`${[...values][0] ?? '?'}\`). No tight-within vs generous-between rhythm.`,
        fix: 'Use two tiers: tight (`gap-2`/`gap-3`) within related items, generous (`gap-8`/`gap-10`) between sections.'
      }
    ];
  }
  return [];
}

/** "Vary visual weight": flag many identical Cards (same variant + padding). */
function checkCardMonotony(code: string): Finding[] {
  const cardRe = /<Card\b([^>]*)>/g;
  const signatures: string[] = [];
  for (const m of code.matchAll(cardRe)) {
    const attrs = m[1]!;
    const variant = attrs.match(/\bvariant=(?:"([^"]*)"|'([^']*)'|\{['"]([^'"]*)['"]\})/);
    const padding = attrs.match(/\bpadding=(?:"([^"]*)"|'([^']*)'|\{['"]([^'"]*)['"]\})/);
    const v = variant ? (variant[1] ?? variant[2] ?? variant[3]) : 'default';
    const p = padding ? (padding[1] ?? padding[2] ?? padding[3]) : 'default';
    signatures.push(`${v}/${p}`);
  }
  if (signatures.length >= HEURISTIC_THRESHOLDS.minCards) {
    const distinct = new Set(signatures);
    if (distinct.size === 1) {
      return [
        {
          ruleId: 'card-monotony',
          severity: 'info',
          kind: 'heuristic',
          message: `All ${signatures.length} Cards share one look (\`${[...distinct][0]}\`). Visual weight does not vary.`,
          fix: 'Differentiate: prominent content `variant="elevated"`/`padding="lg"`, secondary `variant="outlined"`/`padding="md"`.'
        }
      ];
    }
  }
  return [];
}

/** "Commit to a radius": nudge when structural surfaces exist but no radius override does. */
function checkRadiusStrategy(code: string, atoms: string[]): Finding[] {
  // Only count genuine container surfaces. A bare `border`/`border-b` atom is far
  // more often a table row, list divider, or input frame than a Card-like surface,
  // so including it inflated the count into false positives (review finding #1).
  const surfaceCount =
    (code.match(/<Card\b/g)?.length ?? 0) +
    (code.match(/<(?:Dialog|Drawer|Popover)\b/g)?.length ?? 0);
  const hasRadiusOverride = atoms.some((a) => /^rounded(?:-|$)/.test(a));
  if (surfaceCount >= HEURISTIC_THRESHOLDS.minSurfacesForRadius && !hasRadiusOverride) {
    return [
      {
        ruleId: 'no-radius-strategy',
        severity: 'info',
        kind: 'heuristic',
        message: 'Multiple surfaces but no explicit radius — relying solely on component defaults.',
        fix: 'If the default tier radii do not match your design identity, commit to one philosophy (`rounded-lg`/`rounded-xl`/`rounded-2xl`) applied consistently via `class`/`slotClasses`.'
      }
    ];
  }
  return [];
}

/** Run all heuristics over the (comment-masked) code. */
export function runHeuristics(code: string): Finding[] {
  const atoms = collectAtoms(code);
  return [
    ...checkIntentRainbow(atoms),
    ...checkSpacingUniformity(atoms),
    ...checkCardMonotony(code),
    ...checkRadiusStrategy(code, atoms)
  ];
}
