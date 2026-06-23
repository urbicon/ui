/**
 * The authoritative set of Urbicon UI semantic design tokens, expressed as the
 * "core" of a Tailwind colour utility (the part after `bg-`/`text-`/`border-`/…).
 *
 * SOURCE OF TRUTH: `packages/blocks/src/lib/style/{foundation,semantic}.css`
 * (the `--color-*` custom properties). This list is hand-maintained but guarded
 * against drift by `tokens.test.ts`, which re-derives the set from the CSS when
 * run inside the monorepo and fails on any mismatch. The design-engine ships
 * standalone (no access to the blocks source at runtime), so the data must live
 * here, not be read from disk.
 *
 * Why a whitelist: token hallucination is the single biggest weakness of
 * design-quality guidance — the model invents plausible names like
 * `bg-status-danger` or `text-success-fg`
 * that do not exist. A deterministic whitelist turns that from a guess into a
 * fact: a utility whose core looks semantic but is absent here is flagged.
 */

/** Surface background tokens → `bg-surface-*`. */
const SURFACE_CORES = [
  'surface-base',
  'surface-quiet',
  'surface-subtle',
  'surface-elevated',
  'surface-overlay',
  'surface-interactive',
  'surface-hover',
  'surface-active',
  'surface-disabled',
  'surface-selected',
  'surface-inverted'
] as const;

/** Text colour tokens → `text-text-*` (the `text-` namespace, used after a colour prefix). */
const TEXT_CORES = [
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-quaternary',
  'text-disabled',
  'text-inverted',
  'text-on-primary',
  'text-on-dark',
  'text-on-surface'
] as const;

/** Border colour tokens → `border-border-*`. */
const BORDER_CORES = [
  'border-subtle',
  'border-default',
  'border-emphasis',
  'border-strong',
  'border-hairline'
] as const;

/** Intent palettes. Each has a bare token plus the four interaction variants. */
const INTENT_NAMES = [
  'primary',
  'secondary',
  'success',
  'warning',
  'danger',
  'info',
  'neutral'
] as const;

const INTENT_VARIANTS = ['hover', 'active', 'subtle', 'emphasis'] as const;

/** Numbered foundation steps present on every intent scale. */
const SCALE_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950'
] as const;

/**
 * `neutral` carries an extended ramp beyond the standard scale (finer steps for
 * the surface ladder). Omitting these would make the hallucination rule flag a
 * real token like `bg-neutral-650` — the drift guard in tokens.test.ts caught
 * exactly that.
 */
const NEUTRAL_EXTRA_STEPS = ['0', '25', '650', '750', '850'] as const;

/** Warm-neutral foundation scale (used by the Organic/Warm paradigm). Scale-only — no semantic variants. */
const WARM_NEUTRAL_STEPS = SCALE_STEPS;

/** Feedback tokens for status messaging → `bg-feedback-*` / `text-feedback-*`. */
const FEEDBACK_CORES = [
  'feedback-info',
  'feedback-info-subtle',
  'feedback-success',
  'feedback-success-subtle',
  'feedback-warning',
  'feedback-warning-subtle',
  'feedback-error',
  'feedback-error-subtle'
] as const;

/** Interactive overlay tokens. */
const INTERACTIVE_CORES = [
  'interactive-hover',
  'interactive-active',
  'interactive-focus',
  'interactive-disabled'
] as const;

/** Chart series tokens → `text-chart-1` … `text-chart-6`. */
const CHART_CORES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'] as const;

/** Skeleton loading tokens → `bg-skeleton-shimmer` (the shimmer overlay sweep). */
const SKELETON_CORES = ['skeleton-shimmer'] as const;

function buildIntentCores(): string[] {
  const cores: string[] = [];
  for (const intent of INTENT_NAMES) {
    cores.push(intent); // bare, e.g. `bg-primary`
    for (const variant of INTENT_VARIANTS) cores.push(`${intent}-${variant}`); // `bg-primary-subtle`
    for (const step of SCALE_STEPS) cores.push(`${intent}-${step}`); // `bg-primary-500`
  }
  return cores;
}

/**
 * Every valid semantic colour-utility core, as a Set for O(1) membership checks.
 * `surface-base`, `text-primary`, `primary`, `primary-500`, `feedback-success`, …
 */
export const VALID_TOKEN_CORES: ReadonlySet<string> = new Set([
  ...SURFACE_CORES,
  ...TEXT_CORES,
  ...BORDER_CORES,
  ...buildIntentCores(),
  ...NEUTRAL_EXTRA_STEPS.map((s) => `neutral-${s}`),
  ...WARM_NEUTRAL_STEPS.map((s) => `warm-neutral-${s}`),
  ...FEEDBACK_CORES,
  ...INTERACTIVE_CORES,
  ...CHART_CORES,
  ...SKELETON_CORES
]);

/**
 * Normalise raw per-call extra-token input: trim each, drop blanks. These are
 * token *cores* (e.g. `surface-brand`), matching {@link VALID_TOKEN_CORES} — not
 * full utilities (`bg-surface-brand`) and not CSS variables. Deliberately tolerant
 * on read (trim/drop) but it never rewrites a value, so the whitelist contract
 * stays predictable and a caller's `surface-brand` means exactly that.
 */
function normalizeExtraTokens(extra: readonly string[]): string[] {
  return extra.map((token) => token.trim()).filter((token) => token.length > 0);
}

/**
 * The effective valid-core set for one lint run: the built-in
 * {@link VALID_TOKEN_CORES} plus any project-specific cores passed per call. The
 * base set is hot and never mutated — so when there are no usable extras this
 * returns it by reference (no allocation), and otherwise returns a fresh merged
 * Set. Powers the `extraTokens` "context as parameter" path (see LintOptions).
 */
export function resolveValidTokenCores(extra?: readonly string[]): ReadonlySet<string> {
  if (!extra || extra.length === 0) return VALID_TOKEN_CORES;
  const normalized = normalizeExtraTokens(extra);
  if (normalized.length === 0) return VALID_TOKEN_CORES;
  const merged = new Set(VALID_TOKEN_CORES);
  for (const core of normalized) merged.add(core);
  return merged;
}

/**
 * Namespaces that mark a utility core as "intended to be semantic". A core that
 * starts with one of these but is NOT in {@link VALID_TOKEN_CORES} is a
 * hallucinated token. Kept deliberately narrow so we never flag genuine Tailwind
 * utilities (`bg-transparent`, `bg-cover`, arbitrary `bg-[#fff]`).
 */
export const SEMANTIC_NAMESPACES = [
  'surface-',
  'text-',
  'border-',
  'feedback-',
  'interactive-',
  'chart-'
] as const;

/** Intent prefixes (`primary-…`, `success-…`) that mark a core as semantic-intent. */
export const INTENT_PREFIXES: readonly string[] = INTENT_NAMES;

/**
 * The shadcn/ui (and Radix) token vocabulary. This is the single most common
 * hallucination source: with no explicit whitelist, models default to the
 * dominant design-system convention in their training data — `text-foreground`,
 * `bg-accent`, `text-muted-foreground`, `bg-card`, … — none of which exist in
 * Urbicon UI. Discovered empirically during design-quality evaluation.
 * These bare cores slip past the namespace/intent heuristics, so they are
 * matched explicitly. (Suffix `-foreground` and the `fg`/`fg-` family are caught
 * by rule in rules.ts.)
 */
export const KNOWN_FOREIGN_CORES: ReadonlySet<string> = new Set([
  'foreground',
  'background',
  'muted',
  'accent',
  'card',
  'popover',
  'input',
  'destructive',
  'surface', // bare — the real page surface is `surface-base`
  'muted-foreground',
  'accent-foreground',
  'card-foreground',
  'popover-foreground',
  'primary-foreground',
  'secondary-foreground',
  'destructive-foreground'
]);

/**
 * Cores that are commonly hallucinated and have a known correct replacement.
 * Drives a precise fix hint instead of a generic "unknown token".
 */
export const KNOWN_BAD_NAMESPACES: Record<string, string> = {
  // `status-*` is the most frequent invention observed. Map to feedback/intents.
  'status-':
    'Use a `feedback-*` token (feedback-success, feedback-error, …) or a bare intent (`success`, `danger`).',
  // `-fg` / `-foreground` suffixes are invented; the system uses `text-on-primary` etc.
  '-fg': 'Use `text-on-primary` / `text-on-surface` for foreground-on-intent text.'
};

export { INTENT_NAMES, INTENT_VARIANTS, SCALE_STEPS };
