/**
 * variants-lint — behavioural lint over every tv() config in the monorepo.
 *
 * Since the within-stage fold (XC-10) the pipeline resolves same-bucket
 * conflicts deterministically: later sources (axes in declaration order,
 * compounds in array order) strip earlier ones. That makes a new failure
 * mode possible: a class token that is stripped in EVERY reachable
 * combination — dead weight that silently never renders (historic examples:
 * Button's variant.text `px-2`, JourneyTimeline's focused title colour).
 *
 * This script loads every `*.variants.ts` (blocks, table, docs), reads the
 * `.config` each resolver exposes, replays the real engine over the pairwise
 * variant matrix and reports:
 *
 *   ✖ ERROR  dead token — removing it from its source changes the output in
 *            NO sampled combination where the source is active (leave-one-out
 *            attribution, immune to identical-token collisions across sources).
 *   ✖ ERROR  unknown theme key — a class in a theme-driven namespace
 *            (text-/rounded-/shadow-/blur-/tracking-/leading-/ease-, see
 *            scripts/theme-tokens.ts) whose key is defined neither in the
 *            repo's own `@theme` blocks (blocks foundation/semantic,
 *            table-theme) nor in Tailwind 4's default theme.
 *            Tailwind emits NO CSS for such a class — the bug class behind
 *            Calendar's dead `text-2xs` (`size="sm"` rendered like `md`).
 *   ✖ ERROR  no CSS emitted — the same failure, asked of the real compiler
 *            instead of a model of it, so it covers every namespace the model
 *            does not: `bg-` and its colour-capable siblings (`border-`,
 *            `ring-`, `outline-`, `divide-`, `fill-`, `stroke-`, `accent-`,
 *            `caret-`, `decoration-`), variant-prefixed classes, and whatever
 *            Tailwind adds next. See scripts/tailwind-emit.ts.
 *
 *            Its first run found two inert classes — `resize-vertical` on
 *            Textarea and three dead gradient stops on the table skeleton
 *            (`surface-2`/`surface-3` are not tokens here). Neither changed a
 *            pixel: preflight already sets `textarea { resize: vertical }`,
 *            and the skeleton slots have no consumer. Worth stating plainly,
 *            because it is what this guard is for — a class that emits nothing
 *            is a claim the code does not keep, whether or not a user can see
 *            the difference today. The case that IS visible is the typo it was
 *            built for: a mistyped colour renders unstyled.
 *
 *            **Reach is the real limit, not the namespace model.** This lint
 *            reads `*.variants.ts` only (see GLOBS). Classes in `.svelte`
 *            markup, in `packages/auth` entirely, and in `*.system.ts` tables
 *            no config imports are invisible to it — and running the same
 *            probe over those sources on 2026-08-02 found live instances of
 *            exactly this bug class (issues filed). Widening the input is its
 *            own pass.
 *   ✖ ERROR  no conflict bucket — a class the compiler writes CSS properties
 *            for that `BUCKET_PATTERNS` matches nothing. The resolver returns
 *            null for it, so a consumer's override and the library's class both
 *            survive the fold and the stylesheet's emit order decides again —
 *            the state the fold was built to remove. Measured on the first run:
 *            50 such utilities in the library.
 *   ✖ ERROR  bucket disagrees with the compiler — one bucket holding classes
 *            whose declared-property sets differ, i.e. the table claims a
 *            conflict the compiler does not back. This is the shape of the
 *            `text-2xs`-as-a-colour bug (dba97fe8); the cases where Tailwind's
 *            own output legitimately differs are pinned in
 *            BUCKET_EFFECT_EXEMPTIONS. Asked about Tailwind's whole class list
 *            as well as the shipped classes — such a bucket ships its
 *            over-reach to every consumer whether or not this library writes
 *            the family, and seven did. Findings are ranked by how the property
 *            sets relate; see scripts/bucket-agreement.ts.
 *   ✖ ERROR  transform property missing from an arbitrary transition list —
 *            Tailwind 4 emits `scale-*` / `translate-*` / `rotate-*` as the
 *            DISCRETE CSS properties `scale:` / `translate:` / `rotate:`, not
 *            as `transform:`. A list like `transition-[…,transform]` therefore
 *            covers none of them and the motion jumps instead of animating.
 *            (The shorthand `transition-transform` expands to all four and is
 *            never flagged.) See "transform transitions" below.
 *   ✖ ERROR  hover on a resting surface — a `hover:`/`group-hover:` fill that
 *            names a reading surface (`bg-surface-base|quiet|elevated|overlay|
 *            subtle`) instead of an interaction step. Invisible wherever the
 *            element already rests on that surface, which the component cannot
 *            know. See READING_SURFACE_FILLS below.
 *   ✖ ERROR  intent fill used as text — a base intent token (`text-primary`,
 *            `text-danger`, …) as a text colour. The base is sized as a FILL
 *            and misses WCAG AA as text on calm grounds; the `-text` roles
 *            exist for that job and are gated in style/contrast.test.ts. See
 *            INTENT_AS_TEXT below.
 *   ⚠ WARN   partially stripped token — its removal changes some combinations
 *            but not others. Usually intentional (state overrides); the
 *            listing exists so axis-order decisions stay visible.
 *
 * Sampling is pairwise (defaults + single-axis + axis-pairs + compound
 * satisfiers): a token alive ONLY in 3-plus-axis combinations can be flagged
 * falsely dead — that direction fails loud and is reviewed by a human.
 *
 * Structural config errors (unknown slots, unknown compound axes/values)
 * throw at import time via the engine's own validateTvConfig and surface
 * here as file-level errors.
 *
 * Usage: bun --bun run packages/blocks/scripts/variants-lint.ts [--warnings]
 */
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import {
  CATALOGUE_CANARIES,
  type CollisionFinding,
  catalogueClasses,
  collectClassEffects,
  findCollisions,
  findUnbucketed
} from './bucket-agreement';
import { findNonEmittingClasses, isNonEmittingByDesign } from './tailwind-emit';
import { checkClassToken, collectThemeVars } from './theme-tokens';

const ENGINE = resolve(import.meta.dir, '../src/lib/utils/variants.ts');
const BLOCKS_LIB = resolve(import.meta.dir, '../src/lib');
const REPO = resolve(import.meta.dir, '../../..');
const SHOW_WARNINGS = process.argv.includes('--warnings');

// `**` rather than `*`: a Bun.Glob `*` does not cross a `/`, and component
// families nest (`components/Chat/<Component>/`, and one level deeper in
// `Chat/A2UIView/urbicon/`). With the single star those eleven configs matched
// no glob and ran through none of the guards below.
const GLOBS = [
  'packages/blocks/src/lib/primitives/**/*.variants.ts',
  'packages/blocks/src/lib/components/**/*.variants.ts',
  'packages/table/src/lib/variants/*.variants.ts',
  'packages/docs/src/lib/components/**/*.variants.ts'
];

type Cfg = {
  base?: string | string[];
  slots?: Record<string, string | string[]>;
  variants?: Record<string, Record<string, unknown>>;
  compoundVariants?: Record<string, unknown>[];
  defaultVariants?: Record<string, unknown>;
};

const { matchesCompound, tailwindBucket, tv } = await import(ENGINE);

// ─── config collection ───────────────────────────────────────────────────────

const files: string[] = [];
for (const g of GLOBS) {
  for await (const f of new Bun.Glob(g).scan({ cwd: REPO, absolute: true })) files.push(f);
}
files.sort();

if (files.length === 0) {
  console.error(
    '✖ variants-lint matched no *.variants.ts files — check GLOBS for directory drift.'
  );
  process.exit(1);
}

type Loaded = { file: string; name: string; fn: (props?: object) => unknown; cfg: Cfg };
const loaded: Loaded[] = [];
const fileErrors: string[] = [];

for (const file of files) {
  const src = await Bun.file(file).text();
  let rewritten = src
    .replaceAll("'$lib/utils/variants'", `'${ENGINE}'`)
    .replaceAll("'@urbicon-ui/blocks'", `'${ENGINE}'`);
  // A blocks config may pull shared style fragments from other $lib modules
  // (e.g. internal/field-chrome). The engine alias above is already resolved;
  // point any remaining $lib import at the real blocks lib dir so the temp
  // file resolves. Scoped to blocks files — table/docs $lib means their own lib.
  if (file.includes('/packages/blocks/')) {
    rewritten = rewritten.replaceAll("'$lib/", `'${BLOCKS_LIB}/`);
  }
  const tmp = file.replace(/\.ts$/, '.__variants_lint_tmp.ts');
  await Bun.write(tmp, rewritten);
  try {
    const mod = await import(tmp);
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === 'function' && 'config' in value) {
        loaded.push({
          file: file.replace(`${REPO}/`, ''),
          name,
          fn: value as Loaded['fn'],
          cfg: (value as { config: Cfg }).config
        });
      }
    }
  } catch (e) {
    fileErrors.push(`${file.replace(`${REPO}/`, '')}: ${e instanceof Error ? e.message : e}`);
  } finally {
    await unlink(tmp).catch(() => console.warn(`⚠ could not remove temp file ${tmp}`));
  }
}

// The repo carries ~117 configs; a collapse of this number means the export
// pattern or `.config` introspection drifted and the guard is checking air.
if (loaded.length < 50) {
  console.error(
    `✖ variants-lint loaded only ${loaded.length} configs (expected ≥ 50) — .config introspection or glob drift.`
  );
  process.exit(1);
}

// ─── theme truth (for the theme-existence guard) ─────────────────────────────

// The always-loaded @theme pipeline: Tailwind 4's default theme plus every
// @theme block the packages themselves ship (blocks' index.css imports
// foundation + semantic; table adds its own). Optional themes
// (style/themes/*.css) are deliberately excluded — they only override
// existing keys, and a class must not depend on an opt-in theme to exist.
const THEME_CSS = [
  Bun.resolveSync('tailwindcss/theme.css', REPO),
  resolve(REPO, 'packages/blocks/src/lib/style/foundation.css'),
  resolve(REPO, 'packages/blocks/src/lib/style/semantic.css'),
  resolve(REPO, 'packages/table/src/lib/style/table-theme.css')
];

const themeVars = new Set<string>();
for (const cssPath of THEME_CSS) {
  const fileVars = collectThemeVars(await Bun.file(cssPath).text());
  if (fileVars.size === 0) {
    console.error(
      `✖ variants-lint: no @theme variables parsed from ${cssPath} — the theme-existence guard would run blind.`
    );
    process.exit(1);
  }
  for (const v of fileVars) themeVars.add(v);
}

// One canary per source (+ Tailwind's deprecated compat block via --radius):
// a missing canary means @theme parsing or file-location drift, not a clean run.
const THEME_CANARIES = [
  '--text-xs', // tailwind default theme
  '--radius', // tailwind deprecated compat block
  '--text-2xs', // blocks foundation.css
  '--radius-commit', // blocks foundation.css (semantic radii)
  '--color-text-primary', // blocks semantic.css
  '--color-filter' // table-theme.css
];
const missingCanaries = THEME_CANARIES.filter((c) => !themeVars.has(c));
if (missingCanaries.length > 0) {
  console.error(
    `✖ variants-lint: theme canaries missing (${missingCanaries.join(', ')}) — @theme parsing or file-location drift.`
  );
  process.exit(1);
}

// ─── matrix + source activity ────────────────────────────────────────────────

function falsyToString(value: unknown): string | undefined {
  if (value === false) return 'false';
  if (value === true) return 'true';
  if (value === 0) return '0';
  if (value == null) return undefined;
  return String(value);
}

function keyToProp(key: string): unknown {
  if (key === 'true') return true;
  if (key === 'false') return false;
  return key;
}

function combosFor(cfg: Cfg): Record<string, unknown>[] {
  const combos = new Map<string, Record<string, unknown>>();
  const add = (c: Record<string, unknown> | null) => {
    if (c) combos.set(JSON.stringify(c, Object.keys(c).sort()), c);
  };
  add({});
  const axes = Object.entries(cfg.variants ?? {});
  for (const [name, values] of axes) {
    for (const key of Object.keys(values)) add({ [name]: keyToProp(key) });
  }
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      for (const ki of Object.keys(axes[i][1])) {
        for (const kj of Object.keys(axes[j][1])) {
          add({ [axes[i][0]]: keyToProp(ki), [axes[j][0]]: keyToProp(kj) });
        }
      }
    }
  }
  for (const cv of cfg.compoundVariants ?? []) {
    const sat: Record<string, unknown> = {};
    for (const k of Object.keys(cv)) {
      if (k === 'class') continue;
      const c = cv[k];
      sat[k] = Array.isArray(c) ? c[0] : c;
    }
    add(sat);
  }
  return [...combos.values()];
}

function flatTokens(value: unknown): string[] {
  if (value == null || value === false) return [];
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(flatTokens);
  return [];
}

/** Mirrors the engine's pickValue: slot maps route by name, plain values to 'base'. */
function tokenize(value: unknown, slot: string | null): string[] {
  if (slot == null) return flatTokens(value);
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return flatTokens((value as Record<string, unknown>)[slot]);
  }
  return slot === 'base' ? flatTokens(value) : [];
}

// ─── transform transitions (Tailwind 4 discrete properties) ──────────────────

/**
 * Tailwind 4 no longer funnels every transform through one `transform:`
 * declaration: `scale-*` emits `scale:`, `translate-*` emits `translate:`,
 * `rotate-*` emits `rotate:`. Only the SHORTHAND `transition-transform`
 * expands to `transform, translate, scale, rotate`; an arbitrary
 * `transition-[…]` list has to name them itself, and a list saying
 * `transform` covers none of them — the motion snaps to its end state.
 * 3-D transforms (`rotate-x/y/z-*`, `skew-*`, `transform-*`) do still compose
 * into `transform:`, so those map back to `transform`. Order matters:
 * `rotate-x-` must be tested before the plain `rotate-` rule.
 */
const TRANSFORM_PROPERTY: [RegExp, string][] = [
  [/^rotate-[xyz](-|$)/, 'transform'],
  [/^(skew|transform)(-|$)/, 'transform'],
  [/^scale(-|$)/, 'scale'],
  [/^translate(-|$)/, 'translate'],
  [/^rotate(-|$)/, 'rotate']
];

/**
 * Variant prefixes that retarget the rule at a DIFFERENT element. A transform
 * utility behind one of these must be matched against a transition list behind
 * the same prefix (Checkbox's `[&_path]:transition-[stroke-dashoffset]` styles
 * the inner path, not the box). State/breakpoint prefixes (`hover:`, `sm:`, …)
 * do NOT retarget — they are the trigger, and the list belongs on the element.
 */
const ELEMENT_PSEUDO_VARIANTS = new Set([
  'before',
  'after',
  'placeholder',
  'file',
  'marker',
  'selection',
  'first-line',
  'first-letter',
  'backdrop',
  'details-content'
]);

function isElementShifting(prefix: string): boolean {
  return (
    prefix.startsWith('[&') ||
    prefix === '*' ||
    prefix === '**' ||
    ELEMENT_PSEUDO_VARIANTS.has(prefix)
  );
}

/** Split `hover:[&_path]:scale-110` into its variant prefixes + the utility. */
function splitVariants(token: string): { prefixes: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(token.slice(start));
  const utility = parts.pop() as string;
  return { prefixes: parts, utility };
}

/** Strip the `!` important marker and a negative-utility leading `-`. */
function bareUtility(utility: string): string {
  return utility.replace(/^!/, '').replace(/!$/, '').replace(/^-/, '');
}

function transformPropertyOf(utility: string): string | null {
  const bare = bareUtility(utility);
  for (const [re, prop] of TRANSFORM_PROPERTY) if (re.test(bare)) return prop;
  return null;
}

/**
 * Named shorthands that declare a CLOSED property list. `transition-transform`
 * (transform + translate + scale + rotate), `transition` and `transition-all`
 * cover the discrete transform properties and are therefore absent here — they
 * can never be incomplete. The three below cannot animate a transform, so a
 * `scale-*`/`translate-*`/`rotate-*` next to them snaps just as it does next to
 * an arbitrary list that forgot the property. Values verified against the
 * installed Tailwind's compiled output.
 */
const TRANSITION_SHORTHANDS: Record<string, string[]> = {
  'transition-colors': [
    'color',
    'background-color',
    'border-color',
    'outline-color',
    'text-decoration-color',
    'fill',
    'stroke'
  ],
  'transition-opacity': ['opacity'],
  'transition-shadow': ['box-shadow']
};

/** Properties declared by a `transition-[a,b]` list or a closed-list shorthand (null if neither). */
function transitionListProperties(utility: string): Set<string> | null {
  const bare = bareUtility(utility);

  const shorthand = TRANSITION_SHORTHANDS[bare];
  if (shorthand) return new Set(shorthand);

  const m = /^transition-\[(.+)\]$/.exec(bare);
  if (m == null) return null;
  return new Set(
    m[1]
      // `_` is Tailwind's space escape — expand it BEFORE trimming, or
      // `transition-[opacity,_scale]` parses as ' scale' and never matches.
      .split(',')
      .map((p) => p.replaceAll('_', ' ').trim())
      .filter(Boolean)
  );
}

/**
 * Justified exemptions from the transform-transition rule — for slots where a
 * transform utility is LAYOUT, not motion, and animating it would be wrong.
 * Mirrors imports-lint's allowlist discipline: an unlisted finding errors, and
 * a listed-but-no-longer-occurring entry errors as stale, so the list cannot
 * quietly outlive its reason. `where` is the exact location string the rule
 * prints (`file › config › slot`).
 */
const TRANSITION_EXEMPTIONS: { where: string; property: string; why: string }[] = [
  {
    where: 'packages/blocks/src/lib/primitives/Badge/badge.variants.ts › badgeVariants › base',
    property: 'translate',
    why: 'the `placement` axis uses translate as layout — the half-overlap offset is paired with top/left/right/bottom, which cannot transition in step. Animating it would slide the badge *after* its anchor already jumped; both must land at once.'
  }
];
/**
 * Reading surfaces — the backdrops a component can find itself resting on.
 * Using one of them as a HOVER fill is a no-op wherever the element already
 * sits on that same surface, and the component cannot know that it does: the
 * one class string renders on the page (base), inside a Popover (elevated),
 * in a Dialog (overlay) and in a tinted zone (quiet).
 *
 * This is the third outing of that bug class, hence a rule rather than another
 * comment: `bg-surface-interactive hover:bg-surface-hover` (identical in light
 * mode, fixed 2026-07-25), Progress/Slider tracks vanishing on cards, and
 * `hover:bg-surface-subtle` across 8 components — invisible on every elevated
 * surface, because `surface-subtle` resolves to `surface-elevated` exactly
 * (fixed 2026-07-26). All three were invisible to the VR suite, which
 * screenshots resting states only.
 *
 * The fix is always the same: hover belongs on a step token (`surface-hover`,
 * `surface-active`, `surface-interactive-hover`, or an intent's own
 * `-hover`/`-active` rung), never on a resting surface. `semantic.test.ts`
 * guards the other half — that those step tokens differ from every reading
 * surface in both modes.
 */
const READING_SURFACE_FILLS = new Set([
  'bg-surface-base',
  'bg-surface-quiet',
  'bg-surface-elevated',
  'bg-surface-overlay',
  'bg-surface-subtle'
]);
const HOVER_PREFIXES = new Set(['hover', 'group-hover', 'peer-hover']);

/**
 * Base intent tokens used as TEXT. The base token is a fill — sized for
 * `text-on-fill` sitting on it — and as text on a calm ground it misses AA:
 * first measurement of the axis (2026-08-11) put 82 theme×mode×surface
 * combinations below 4.5:1, bottoming at 2.0:1 (warning on white). Each intent
 * carries a `-text` role at the nearest AA-clean stop for exactly this job,
 * gated hard in style/contrast.test.ts; `-emphasis` remains the near-ink tier.
 *
 * `text-neutral` is NOT in this set: its base clears AA as text on every
 * ground in every theme (measured; the contrast suite pins it), because the
 * chassis ramp was text-tuned from the start.
 *
 * Alpha'd forms (`text-danger/70`) are caught too — the modifier only lowers
 * the contrast further. Reach caveat as for every rule here: `*.variants.ts`
 * plus the spliced fragment tables; classes in `.svelte` markup are invisible
 * to this lint (see the header).
 */
const INTENT_AS_TEXT = new Set([
  'text-primary',
  'text-secondary',
  'text-success',
  'text-warning',
  'text-danger',
  'text-info'
]);

/**
 * Sites where a `text-<intent>` utility is NOT text: it feeds a
 * `stroke-current` / `bg-current` / `fill-current` MARK that must match a
 * sibling fill byte-for-byte (Progress's ring next to its `bg-primary` bar,
 * Slider's rail dot on its `bg-primary` range, the Spinner arc). Migrating
 * these to the `-text` tier put the pair one stop apart — an adversarial
 * review caught a warning slider rendering an amber-brown dot on a yellow
 * line. Marks answer to WCAG 1.4.11's 3:1 floor, not the 4.5 text floor
 * (warning stays on `-emphasis` in these configs for exactly that reason —
 * yellow at 2.27:1 misses even 3:1 on white).
 *
 * Same contract as TRANSITION_EXEMPTIONS: an unlisted finding errors, a
 * listed-but-gone entry errors as stale. `where` is the exact location string
 * the rule prints.
 */
const INTENT_AS_TEXT_EXEMPTIONS: { where: string; token: string; why: string }[] = [
  ...['primary', 'secondary', 'success', 'danger'].map((i) => ({
    where:
      'packages/blocks/src/lib/primitives/Progress/progress.variants.ts › progressVariants › circularFill',
    token: `text-${i}`,
    why: 'stroke-current ring must match the linear bar (bg-<intent>) of the same intent'
  })),
  ...['primary', 'secondary', 'success', 'warning', 'danger'].map((i) => ({
    where: 'packages/blocks/src/lib/primitives/Slider/slider.variants.ts › sliderVariants › thumb',
    token: `text-${i}`,
    why: 'bg-current rail dot must match the range line (bg-<intent>)'
  })),
  ...['primary', 'secondary', 'success', 'danger'].map((i) => ({
    where:
      'packages/blocks/src/lib/primitives/Spinner/spinner.variants.ts › spinnerVariants › base',
    token: `text-${i}`,
    why: 'border/fill-current arc — the intent as a mark, paired with intent fills elsewhere'
  })),
  {
    where:
      'packages/table/src/lib/variants/table-states.variants.ts › loadingStateVariants › spinner',
    token: 'text-primary',
    why: 'currentColor spinner mark, mirrors the blocks Spinner'
  }
];

const exemptionKey = (where: string, property: string) => `${where}\0${property}`;
const exemptions = new Map(
  TRANSITION_EXEMPTIONS.map((e) => [exemptionKey(e.where, e.property), e])
);
const exemptionsHit = new Set<string>();

type TransitionGroup = {
  /** raw class token → the properties its arbitrary list declares */
  lists: Map<string, Set<string>>;
  /** CSS property → the raw transform utilities that write it */
  byProp: Map<string, Set<string>>;
  /** properties whose utility sits behind a state/breakpoint variant */
  stateful: Set<string>;
};

/** Bucket one rendered class string by target element. */
function groupTransitionTokens(classString: string): Map<string, TransitionGroup> {
  const groups = new Map<string, TransitionGroup>();
  const groupFor = (key: string): TransitionGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { lists: new Map(), byProp: new Map(), stateful: new Set() };
      groups.set(key, g);
    }
    return g;
  };
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    const { prefixes, utility } = splitVariants(token);
    const shifting = prefixes.filter(isElementShifting);
    const key = shifting.join('|');
    const declared = transitionListProperties(utility);
    if (declared != null) {
      groupFor(key).lists.set(token, declared);
      continue;
    }
    const prop = transformPropertyOf(utility);
    if (prop == null) continue;
    const g = groupFor(key);
    let tokens = g.byProp.get(prop);
    if (!tokens) {
      tokens = new Set();
      g.byProp.set(prop, tokens);
    }
    tokens.add(token);
    if (prefixes.length > shifting.length) g.stateful.add(prop);
  }
  return groups;
}

// ─── lint ────────────────────────────────────────────────────────────────────

type Finding = { where: string; token: string; detail: string };
const dead: Finding[] = [];
const shadowed: Finding[] = [];
const partial: Finding[] = [];
const unknownTheme: Finding[] = [];
const unknownThemeSeen = new Set<string>();
/**
 * Every class the hand-modelled namespace guard waved through, and where it
 * came from. Compiled in one batch after the walk — Tailwind knows every
 * namespace, so this is what covers `bg-` and its nine colour-capable
 * siblings without a statics list to keep true (#61).
 */
const emitCandidates = new Map<string, string[]>();
const noCss: Finding[] = [];
const missingTransition: Finding[] = [];
const missingTransitionSeen = new Set<string>();
const readingSurfaceHover: Finding[] = [];
const readingSurfaceHoverSeen = new Set<string>();
const intentAsText: Finding[] = [];
const intentAsTextSeen = new Set<string>();
const intentTextExemptionKey = (where: string, token: string) => `${where}\0${token}`;
const intentTextExemptions = new Map(
  INTENT_AS_TEXT_EXEMPTIONS.map((e) => [intentTextExemptionKey(e.where, e.token), e])
);
const intentTextExemptionsHit = new Set<string>();

/** Remove every occurrence of `token` from a class value (string or nested array). */
function removeToken(value: unknown, token: string): unknown {
  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .filter((t) => t && t !== token)
      .join(' ');
  }
  if (Array.isArray(value)) return value.map((v) => removeToken(v, token));
  return value;
}

for (const { file, name, fn, cfg } of loaded) {
  const slots = cfg.slots && Object.keys(cfg.slots).length > 0 ? Object.keys(cfg.slots) : null;
  const combos = combosFor(cfg);
  const axes = Object.entries(cfg.variants ?? {});
  const compounds = cfg.compoundVariants ?? [];
  const slotList = slots ?? ['<single>'];

  // A source contributes tokens per slot and can be surgically cloned with
  // one token removed — leave-one-out attribution: if the outputs of every
  // sampled combination where the source is active are identical without
  // the token, the token is dead. Identical token strings in OTHER sources
  // cannot vouch for it (the string-membership approach failed there).
  type Source = {
    id: string;
    tokens: Map<string, string[]>;
    activeIn: (eff: Record<string, unknown>) => boolean;
    cloneWithout: (slot: string, token: string) => Cfg;
  };
  const sources: Source[] = [];

  const mkTokens = (value: unknown): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    for (const slot of slotList) {
      m.set(slot, tokenize(value, slots ? slot : null));
    }
    return m;
  };

  const cloneCfg = (): Cfg => structuredClone(cfg);
  const editValue = (value: unknown, slot: string, token: string): unknown => {
    if (slots != null && value != null && typeof value === 'object' && !Array.isArray(value)) {
      const map = { ...(value as Record<string, unknown>) };
      map[slot] = removeToken(map[slot], token);
      return map;
    }
    // Plain values route to 'base' (slot mode) or apply directly (no-slot).
    return removeToken(value, token);
  };

  {
    const baseTokens = new Map<string, string[]>();
    for (const slot of slotList) {
      baseTokens.set(slot, slots ? flatTokens(cfg.slots?.[slot]) : flatTokens(cfg.base));
    }
    sources.push({
      id: 'base',
      tokens: baseTokens,
      activeIn: () => true,
      cloneWithout: (slot, token) => {
        const c = cloneCfg();
        if (slots && c.slots) c.slots[slot] = removeToken(c.slots[slot], token) as string;
        else c.base = removeToken(c.base, token) as string;
        return c;
      }
    });
  }

  for (const [axis, values] of axes) {
    for (const [valueName, value] of Object.entries(values)) {
      sources.push({
        id: `${axis}=${valueName}`,
        tokens: mkTokens(value),
        activeIn: (eff) => falsyToString(eff[axis]) === valueName,
        cloneWithout: (slot, token) => {
          const c = cloneCfg();
          const v = c.variants?.[axis];
          if (v) v[valueName] = editValue(v[valueName], slot, token);
          return c;
        }
      });
    }
  }
  for (const [i, cv] of compounds.entries()) {
    sources.push({
      id: `compound[${i}]`,
      tokens: mkTokens(cv.class),
      activeIn: (eff) => matchesCompound(cv, eff),
      cloneWithout: (slot, token) => {
        const c = cloneCfg();
        const entry = c.compoundVariants?.[i];
        if (entry) entry.class = editValue(entry.class, slot, token);
        return c;
      }
    });
  }

  // Theme-existence guard: every class token in a theme-driven namespace
  // must resolve to a key in the collected @theme truth. Independent of the
  // fold replay below — a dead-AND-unknown token reports on both axes.
  for (const src of sources) {
    for (const slot of slotList) {
      for (const token of new Set(src.tokens.get(slot) ?? [])) {
        const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}`;
        const miss = checkClassToken(token, themeVars);
        if (miss == null) {
          // Out of the hand-modelled namespaces' reach — hand it to the
          // compiler pass below, which knows every namespace but can only say
          // "no rule", not which variable was missing.
          emitCandidates.set(
            token,
            (emitCandidates.get(token) ?? []).concat(`${where} (${src.id})`)
          );
          continue;
        }
        const seenKey = `${where}\0${token}`;
        if (unknownThemeSeen.has(seenKey)) continue;
        unknownThemeSeen.add(seenKey);
        unknownTheme.push({
          where,
          token,
          detail: `${src.id} — no @theme key: looked for ${miss.lookedFor.join(' / ')}`
        });
      }
    }
  }

  // Baseline outputs per combo per slot.
  const baseline = combos.map((combo) => {
    const resolved = fn(combo);
    const bySlot = new Map<string, string>();
    for (const slot of slotList) {
      bySlot.set(
        slot,
        slots == null ? (resolved as string) : (resolved as Record<string, () => string>)[slot]()
      );
    }
    return bySlot;
  });
  const active = combos.map((combo) => {
    const eff = { ...(cfg.defaultVariants ?? {}), ...combo };
    return sources.map((src) => src.activeIn(eff));
  });

  // Transform-transition guard. Runs over the RENDERED output per slot, so it
  // sees exactly what the browser sees: base + axes + compounds after the fold,
  // including class fragments spliced in from shared *.system.ts tables. A
  // property is only *required* in the list when it can actually change — it
  // sits behind a state variant, or its utility set differs between sampled
  // combos. A constant, unprefixed transform (the Slider thumb's centring
  // `-translate-x-1/2`, which never moves — the thumb travels via `left`) is
  // therefore not demanded.
  for (const slot of slotList) {
    const perCombo = baseline.map((bySlot) => groupTransitionTokens(bySlot.get(slot) as string));
    const elementKeys = new Set(perCombo.flatMap((groups) => [...groups.keys()]));
    for (const elementKey of elementKeys) {
      const props = new Set(
        perCombo.flatMap((groups) => [...(groups.get(elementKey)?.byProp.keys() ?? [])])
      );
      const dynamic = new Set<string>();
      for (const prop of props) {
        const stateful = perCombo.some((groups) => groups.get(elementKey)?.stateful.has(prop));
        const signatures = new Set(
          perCombo.map((groups) =>
            [...(groups.get(elementKey)?.byProp.get(prop) ?? [])].sort().join(' ')
          )
        );
        if (stateful || signatures.size > 1) dynamic.add(prop);
      }
      for (const groups of perCombo) {
        const group = groups.get(elementKey);
        if (group == null) continue;
        for (const [listToken, declared] of group.lists) {
          for (const [prop, utilities] of group.byProp) {
            if (declared.has(prop) || !dynamic.has(prop)) continue;
            const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}${
              elementKey ? ` › ${elementKey}` : ''
            }`;
            const exemptKey = exemptionKey(where, prop);
            if (exemptions.has(exemptKey)) {
              exemptionsHit.add(exemptKey);
              continue;
            }
            const seenKey = `${where}\0${listToken}\0${prop}`;
            if (missingTransitionSeen.has(seenKey)) continue;
            missingTransitionSeen.add(seenKey);
            missingTransition.push({
              where,
              token: listToken,
              detail: `'${[...utilities].sort()[0]}' writes the discrete CSS property '${prop}', which the list does not name — the state change jumps instead of animating. Add '${prop}' to the list (or use the 'transition-transform' shorthand, which expands to transform,translate,scale,rotate)`
            });
          }
        }
      }
    }
  }

  // Reading-surface hover guard. Also runs over the RENDERED output, so it
  // catches a hover fill spliced in from a shared fragment table
  // (`internal/field-chrome.ts`) exactly like an inline one.
  for (const slot of slotList) {
    for (const bySlot of baseline) {
      for (const token of (bySlot.get(slot) as string).split(/\s+/).filter(Boolean)) {
        const { prefixes, utility } = splitVariants(token);
        if (!prefixes.some((p) => HOVER_PREFIXES.has(p))) continue;
        if (!READING_SURFACE_FILLS.has(utility)) continue;
        const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}`;
        const seenKey = `${where}\0${token}`;
        if (readingSurfaceHoverSeen.has(seenKey)) continue;
        readingSurfaceHoverSeen.add(seenKey);
        readingSurfaceHover.push({
          where,
          token,
          detail: `'${utility}' is a resting surface, not an interaction step — this hover is invisible wherever the element already rests on it. Use 'bg-surface-hover' (element on a reading surface), 'bg-surface-interactive-hover' (element on a filled control) or the intent's own '-hover' rung`
        });
      }
    }
  }

  // Intent-as-text guard — same rendered-output walk, so a class spliced in
  // from a shared fragment table is caught exactly like an inline one. The
  // alpha modifier is stripped before the lookup (`text-danger/70` bans the
  // same as `text-danger`; the modifier only lowers the contrast further).
  for (const slot of slotList) {
    for (const bySlot of baseline) {
      for (const token of (bySlot.get(slot) as string).split(/\s+/).filter(Boolean)) {
        const { utility } = splitVariants(token);
        const bare = bareUtility(utility);
        // Named form (`text-danger`, `text-danger/70`, `!text-danger`) and the
        // arbitrary-value spellings of the same token
        // (`text-[--color-danger]`, `text-(--color-danger)`,
        // `text-[var(--color-danger)]`) — the latter reach the identical CSS
        // and would otherwise be a silent bypass of this rule.
        const named = INTENT_AS_TEXT.has(bare.split('/')[0]);
        // The delimiter right after the name keeps `--color-danger-text` and
        // `--color-danger-500` out — only the bare intent variable is banned.
        const arbitrary =
          /^text-[[(]/.test(bare) &&
          [...INTENT_AS_TEXT].some((u) =>
            new RegExp(`--color-${u.slice('text-'.length)}[)\\]]`).test(bare)
          );
        if (!named && !arbitrary) continue;
        const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}`;
        const exemption = intentTextExemptions.get(intentTextExemptionKey(where, token));
        if (exemption) {
          intentTextExemptionsHit.add(intentTextExemptionKey(where, token));
          continue;
        }
        const seenKey = `${where}\0${token}`;
        if (intentAsTextSeen.has(seenKey)) continue;
        intentAsTextSeen.add(seenKey);
        intentAsText.push({
          where,
          token,
          detail: `'${utility}' is the intent's FILL tone and misses WCAG AA as text on calm grounds (measured down to 2.0:1). Use the text tier '${utility}-text', or '${utility}-emphasis' for the near-ink tier`
        });
      }
    }
  }

  for (const [si, src] of sources.entries()) {
    for (const slot of slotList) {
      // Deduplicate per source+slot; leave-one-out removes all occurrences.
      for (const token of new Set(src.tokens.get(slot) ?? [])) {
        const clone = src.cloneWithout(slot, token);
        // biome-ignore lint/suspicious/noExplicitAny: dynamic tv() replay
        const cloneFn = (tv as any)(clone);
        let activeCount = 0;
        let changed = 0;
        let present = 0;
        for (const [ci, combo] of combos.entries()) {
          if (!active[ci][si]) continue;
          activeCount++;
          const base = baseline[ci].get(slot) as string;
          if (base.split(/\s+/).includes(token)) present++;
          const out =
            slots == null
              ? (cloneFn(combo) as string)
              : (cloneFn(combo) as Record<string, () => string>)[slot]();
          if (out !== base) changed++;
        }
        if (activeCount === 0) continue;
        const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}`;
        if (present === 0) {
          // The token never reaches the output anywhere its source is
          // active — silently lost to the fold. This is the gate.
          dead.push({
            where,
            token,
            detail: `${src.id} — stripped in all ${activeCount} sampled combos`
          });
        } else if (changed === 0) {
          // The string appears in the output, but removing THIS source's
          // copy changes nothing — a later source supplies the identical
          // token. Redundant (often deliberately defensive), not lost.
          shadowed.push({
            where,
            token,
            detail: `${src.id} — a later source supplies the same token in all ${activeCount} sampled combos`
          });
        } else if (changed < activeCount) {
          partial.push({
            where,
            token,
            detail: `${src.id} — inert in ${activeCount - changed}/${activeCount} sampled combos`
          });
        }
      }
    }
  }
}

// ─── emitted-CSS guard ───────────────────────────────────────────────────────
//
// The namespace model above covers nine namespaces exactly and says which
// variable was missing. This pass covers the rest — every colour-capable
// namespace (`bg-`, `border-`, `ring-`, `outline-`, `divide-`, `fill-`,
// `stroke-`, `accent-`, `caret-`, `decoration-`) plus anything Tailwind gains
// later — by compiling the classes and reporting the ones that yield no rule.
// A mistyped colour token emits NO CSS and renders unstyled, which is the
// whole reason this guard exists; `bg-` held five of the library's on-colour
// references and was unguarded (#61).
//
// Two canaries first, because a compile that silently returns nothing would
// make this pass vacuously green: a class that must live, and one that must
// not.
const EMIT_CANARY_ALIVE = 'bg-text-on-fill';
const EMIT_CANARY_DEAD = 'bg-text-on-fill-nonexistent-key';

/**
 * Classes that are hand-written CSS rather than Tailwind utilities, so the
 * compiler is right to emit nothing for them and this guard would otherwise
 * report every one. Each needs a reason and the file that defines it.
 *
 * Same contract as `imports:lint` and `registry:lint`: an entry that stops
 * being needed is an error, so the list cannot quietly outlive its cause.
 */
const HAND_WRITTEN_CSS: Record<string, string> = {
  'animate-progress-indeterminate':
    'keyframes + class in Progress.svelte (component-local :global) — the animation is bound to that component, not a theme token',
  'animate-progress-striped': 'keyframes + class in Progress.svelte (component-local :global)',
  'blocks-avatar-status-pulse': 'keyframes + class in Avatar.svelte (component-local :global)',
  // Deliberately styles nothing. It is a state marker for consumers and tests
  // to target — `utils/variants.ts` names it as the example of a semantic hook
  // the conflict resolver passes through untouched, and `variants.test.ts`
  // asserts that. "Emits no CSS" is the point, not a defect.
  'blocks-menu--open': 'consumer-facing state hook, styled by nobody on purpose (menu.variants.ts)',
  // NOT a `@theme` font key — there is no `--font-meta` anywhere. It is the
  // class rule `.docs-rooms .font-meta` in the docs app's rooms stylesheet, so
  // it applies only under that opt-in theme. Call sites must carry their own
  // mono + size utilities and treat it as a refinement; `Section`'s `meta`
  // slot did not, which this guard surfaced and that file now fixes.
  'font-meta': 'theme-scoped class rule in the docs app (.docs-rooms .font-meta), not a theme key',
  'meta-marker': 'docs-app decorative class, defined in the docs app stylesheet (rooms-docs.css)'
};

const tailwindCss = [
  "@import 'tailwindcss';",
  ...(await Promise.all(THEME_CSS.slice(1).map((p) => Bun.file(p).text())))
].join('\n');

// Canaries on the INPUT, not just on the compiler. The two above are appended
// to the candidate list, so they prove the compiler and the theme load — they
// say nothing about whether the walk collected anything. Measured: a
// regression dropping `bg-` and `border-` from `emitCandidates` still left
// 1201 of 1322 classes and both compiler canaries green, so a plain size
// floor would not catch it either.
//
// Per-namespace instead, on the four that cannot plausibly go to zero in this
// library (measured: bg- 128, border- 84, text- 80, ring- 64). Reaching zero
// means either the walk broke or the namespace genuinely emptied — both worth
// stopping for. `accent-`/`caret-` get no canary: the repo uses neither today,
// so they are covered by the compiler like everything else but not asserted to
// arrive.
const NAMESPACE_CANARIES = ['bg-', 'border-', 'text-', 'ring-'];
// `splitVariants` rather than a fourth hand-rolled `lastIndexOf(':')` in this
// file — that one mangles bracketed values (`[color:red]` → `red]`).
const candidateSplits = [...emitCandidates.keys()].map((t) => splitVariants(t));
const missingNamespaces = NAMESPACE_CANARIES.filter(
  (ns) => !candidateSplits.some(({ utility }) => utility.startsWith(ns))
);
// The namespace check deliberately looks past the prefix, which leaves it
// blind along that axis: a regression dropping variant-PREFIXED tokens keeps
// every namespace alive through the unprefixed ones. Measured — filtering them
// out lost 422 of 1322 classes (32 %) with all four namespace canaries green,
// all six allowlist entries still hit, and a planted `hover:bg-primaryx`
// unreported. Prefixed classes are a third of what this guard reads and the
// case its own docs advertise catching, so their arrival is asserted too.
const prefixedArrived = candidateSplits.some(({ prefixes }) => prefixes.length > 0);

// And that every GLOB root is represented. The namespace canaries all pass
// on blocks alone, so dropping the table or docs configs from the candidate
// set is invisible to them — measured: losing table's 97 classes hid the
// `from-surface-2` finding this PR is built on, with all five canaries green.
// The blocks-only version of that failure is caught today only because the
// stale-HAND_WRITTEN_CSS check happens to have entries in `packages/docs`,
// which is coverage by accident. One assertion covers both by design.
const candidateOrigins = [...emitCandidates.values()].flat();
const rootsMissing = [...new Set(GLOBS.map((g) => g.split('/src/')[0]))].filter(
  (root) => !candidateOrigins.some((where) => where.startsWith(root))
);
if (missingNamespaces.length > 0 || !prefixedArrived || rootsMissing.length > 0) {
  const missing = [
    ...missingNamespaces,
    ...(prefixedArrived ? [] : ['variant-prefixed']),
    ...rootsMissing.map((r) => `${r}/*`)
  ];
  console.error(
    `✖ variants-lint: no ${missing.join(' / ')} class reached the emitted-CSS guard — the collection walk is not seeing the configs it claims to check.`
  );
  process.exit(1);
}

const probe = await findNonEmittingClasses(
  [...emitCandidates.keys(), EMIT_CANARY_ALIVE, EMIT_CANARY_DEAD],
  { css: tailwindCss, base: REPO }
);
const deadSet = new Set(probe.dead);
if (deadSet.has(EMIT_CANARY_ALIVE) || !deadSet.has(EMIT_CANARY_DEAD)) {
  console.error(
    `✖ variants-lint: the emitted-CSS canaries failed (alive='${EMIT_CANARY_ALIVE}' reported ${
      deadSet.has(EMIT_CANARY_ALIVE) ? 'dead' : 'alive'
    }, dead='${EMIT_CANARY_DEAD}' reported ${deadSet.has(EMIT_CANARY_DEAD) ? 'dead' : 'alive'}) — the compiler probe is not measuring what it claims.`
  );
  process.exit(1);
}

const handWrittenHit = new Set<string>();
for (const token of probe.dead) {
  if (token === EMIT_CANARY_DEAD) continue;
  if (token in HAND_WRITTEN_CSS) {
    handWrittenHit.add(token);
    continue;
  }
  for (const where of emitCandidates.get(token) ?? []) {
    noCss.push({
      where,
      token,
      detail:
        'Tailwind emits no rule for this class, so it renders as if it were not there. Usually a mistyped theme key (a colour, most often) — check it against the tokens in style/semantic.css. If it is hand-written CSS, add it to HAND_WRITTEN_CSS in this script with the file that defines it'
    });
  }
}
const staleHandWritten = Object.keys(HAND_WRITTEN_CSS).filter((t) => !handWrittenHit.has(t));

// ─── bucket-agreement guard ──────────────────────────────────────────────────
//
// The fold picks a winner per conflict bucket, and the buckets come from 218
// hand-written regexes in `utils/variants.ts` — a copy of Tailwind's namespace
// kept by hand. A gap in the copy is invisible from the table: the class
// buckets as `null`, both classes survive the fold, and the compiled
// stylesheet's emit order decides again, which is the state the fold removed.
// An over-reach is invisible the same way, until something renders wrong
// (`text-2xs` read as a colour and stripped by `text-primary`, dba97fe8).
//
// So the table is compared against the compiler: which CSS properties each
// class actually declares, taken from the design system's own per-candidate AST
// (scripts/bucket-agreement.ts). No second model of Tailwind — a gate restating
// the table would only ever agree with itself — and no CSS text to parse, which
// is what an earlier version got silently wrong in two ways at once.
//
// Deriving the table from the compiler instead was built and measured
// (2026-08-28, 1 546 classes / 2 388 570 ordered pairs): 0,04 % disagreement,
// but a breaking change — it reintroduces the dba97fe8 bug through a missing
// theme sub-key — and +7,8 KB gzip in every consumer bundle. The gate ships
// nothing and changes no behaviour.
//
// Grouped by the resolver's OWN key, modifier prefix included, because that is
// the only comparison it ever makes: `hover:text-2xs` can never be stripped by
// a plain `text-primary`, so a disagreement across prefixes is not a defect.
// Merging the prefixes also compares rules on different elements — Tailwind
// injects `content: var(--tw-content)` into every `before:`/`after:` rule, so
// `before:z-0` reads as a second effect next to `z-0` while nothing is wrong.
// The EXEMPTIONS are looked up per family (prefix stripped): a prefix moves a
// rule to another selector, never to another property, so one entry covers
// `scale` and `active:scale` alike.
const bucketFamily = (key: string): string => key.slice(key.lastIndexOf(':') + 1);

const design = await __unstable__loadDesignSystem(tailwindCss, { base: REPO });
const classEffects = collectClassEffects(design, [...emitCandidates.keys()]);

// The collision half runs over Tailwind's whole catalogue as well, because a
// bucket that over-reaches outside the library's vocabulary still ships to
// every consumer: `bg-primary + bg-blend-multiply` lost the colour, and
// `border-primary + border-be-2` lost it to a WIDTH, on a table where the
// shipped classes reported nothing. Both halves stay, over different
// populations — `getClassList` enumerates no arbitrary value and no
// variant-prefixed form (measured), so the shipped classes are the only place
// `stroke-[2px]` and `active:scale-95` can be checked, while the unbucketed
// half over the catalogue would report 13 242 classes in families this library
// never writes.
const catalogueEffects = collectClassEffects(design, catalogueClasses(design));
// Named canaries rather than a size floor — see CATALOGUE_CANARIES. A floor is
// exactly the shape this file rejects 100 lines above, where the measurement is
// written down: losing two whole namespaces left 91 % of the classes in place.
const missingCatalogueCanaries = CATALOGUE_CANARIES.filter((cls) => !catalogueEffects.has(cls));
if (missingCatalogueCanaries.length > 0) {
  console.error(
    `✖ variants-lint: ${missingCatalogueCanaries.join(', ')} reached no effect set out of Tailwind's class catalogue (${catalogueEffects.size} classes read) — the full-list collision pass is not seeing the families it is meant to check.`
  );
  process.exit(1);
}
// Union, not two runs: a bucket can legitimately hold one class from each
// population, and comparing them separately would never put those two side by
// side. That is not hypothetical — `break-words` (shipped, `overflow-wrap`) and
// `break-all` (catalogue, `word-break`) shared a bucket, and only the union
// reported it. The shipped map wins on a duplicate key: same compiler, same
// answer.
const bucketedEffects = new Map([...catalogueEffects, ...classEffects]);

// Canary on the READING, not just on the compiler: every class that got a rule
// must have reached an effect set. Per-candidate ASTs removed the attribution
// step that made the first version of this pass lose its place, but not the
// failure MODE — a reader that drops a subset stays silent, and the subset is
// what the history is made of. Measured on this file: discarding every
// variant-prefixed class loses 501 of 1454 (34 %) and the run still exits 0,
// because the four BUCKET_EFFECT_EXEMPTIONS are all still hit. Those excuse
// specific effect sets and so only notice TOTAL loss; nothing else here reads
// a per-class result.
//
// The reachable cause is not a Tailwind bug. `tailwindCss` now feeds two
// loaders — `compile()` inside findNonEmittingClasses and the design system
// here — so a refactor that hands one of them an @theme file or a repo-defined
// custom variant the other gets would make every class using the missing piece
// resolve to nothing on one side while the other stays green.
const unread = [...emitCandidates.keys()].filter(
  (cls) => !deadSet.has(cls) && !isNonEmittingByDesign(cls) && !classEffects.has(cls)
);
if (unread.length > 0) {
  console.error(
    `✖ variants-lint: ${unread.length} class(es) emit CSS but reached no effect set (${unread
      .slice(0, 5)
      .join(', ')}) — the bucket pass is not reading every class it compiled.`
  );
  process.exit(1);
}

/**
 * Families whose members are meant to be worn TOGETHER, so the fold must stay
 * silent about them: each writes its own `--tw-*` sub-axis variable and they
 * compose into one property (`touch-pan-x touch-pan-y` is one touch-action,
 * `ordinal tabular-nums` one font-variant-numeric). Giving such a family a
 * bucket would make it strip itself — the one repair the unbucketed diagnosis
 * must NOT be read as recommending.
 *
 * Three checks keep an entry honest, on the same contract as the two lists
 * above. Every sample must still match its own pattern and still bucket as
 * null, so an entry cannot outlive the day its family gains a pattern; and must
 * still emit CSS, so it cannot outlive the day Tailwind drops the family —
 * without which a typo (`touch-pan-xx`) vouches for nothing while looking
 * right, bucketing as null precisely BECAUSE it is not a utility.
 *
 * The third is the one the samples cannot give. Members are open-ended, so what
 * an entry suppresses is whatever its PATTERN matches, and nothing tied that
 * back to the family: widening entry 0 to `/^(touch-(pan-|pinch-zoom$)|fill-)/`
 * swallows all eleven `fill-*` findings with every sample still green. So the
 * entry's actual claim — each member writes its own `--tw-*` sub-axis and
 * therefore composes — is asserted on every class it suppresses, not just on
 * the ones it names. That also covers the claim going stale on its own: were
 * Tailwind to reduce `touch-pan-x` to a plain `touch-action`, the family would
 * need a bucket, and the three checks above would all stay green.
 */
const COMPOSING_UTILITIES: { pattern: RegExp; samples: string[]; why: string }[] = [
  {
    pattern: /^touch-(pan-|pinch-zoom$)/,
    samples: ['touch-pan-x', 'touch-pan-y', 'touch-pinch-zoom'],
    why: 'each writes its own --tw-pan-x/--tw-pan-y/--tw-pinch-zoom, composed into one touch-action — `touch-pan-x touch-pan-y` is a single allowed gesture set. The keyword forms (auto/none/manipulation) ARE bucketed, because those do replace each other.'
  },
  {
    pattern: /^(ordinal|slashed-zero|(?:lining|oldstyle)-nums|(?:diagonal|stacked)-fractions)$/,
    samples: ['ordinal', 'slashed-zero', 'lining-nums', 'diagonal-fractions'],
    why: 'four independent font-variant-numeric sub-axes (--tw-ordinal, --tw-slashed-zero, --tw-numeric-figure, --tw-numeric-fraction) that compose into one property. Only the spacing axis is bucketed, because the library writes it. A component that starts writing one of these wants a bucket for THAT sub-axis (`lining-nums` and `oldstyle-nums` do replace each other), never one for the family.'
  }
];
const composingBroken: string[] = [];
const composingOverreach = new Map<number, string[]>();
/**
 * The property shape that makes a utility composable: its own `--tw-*` axis
 * variable beside the shared property. `touch-pan-x` writes `--tw-pan-x` and
 * `touch-action`, so two pan utilities combine; `touch-none` writes
 * `touch-action` alone and therefore replaces rather than composes.
 */
const composesOwnAxis = (properties: readonly string[]): boolean =>
  properties.some((property) => property.startsWith('--tw-'));

// Read through the same reader the gate uses, so a sample that emits nothing
// and a reader that returns nothing both surface here.
const composingSampleEffects = collectClassEffects(
  design,
  COMPOSING_UTILITIES.flatMap((e) => e.samples)
);
for (const [i, entry] of COMPOSING_UTILITIES.entries()) {
  for (const sample of entry.samples) {
    if (!entry.pattern.test(sample)) {
      composingBroken.push(`sample '${sample}' does not match its own pattern ${entry.pattern}`);
    } else if (tailwindBucket(sample) != null) {
      composingBroken.push(
        `sample '${sample}' now buckets as '${tailwindBucket(sample)}' — the family gained a pattern, so entry ${i} of COMPOSING_UTILITIES is stale; drop it`
      );
    } else if (!composingSampleEffects.has(sample)) {
      composingBroken.push(
        `sample '${sample}' emits no CSS — it is a typo or a utility Tailwind no longer ships, so entry ${i} of COMPOSING_UTILITIES excuses nothing; fix the sample or drop the entry`
      );
    } else if (!composesOwnAxis(composingSampleEffects.get(sample) as string[])) {
      composingBroken.push(
        `sample '${sample}' writes ${(composingSampleEffects.get(sample) as string[]).join(', ')} — no --tw-* sub-axis of its own, so it REPLACES its siblings instead of composing with them and entry ${i} of COMPOSING_UTILITIES no longer describes the family; it wants a bucket instead`
      );
    }
  }
}

/**
 * Buckets where the compiler reports more than one declared-property set and
 * the bucket is nonetheless right. Each entry pins the exact sets it excuses,
 * so members may come and go but a NEW effect in the bucket still reports —
 * a bucket-name-only exemption would swallow the next mis-bucket.
 *
 * Same contract as HAND_WRITTEN_CSS and imports-lint: an entry that stops
 * being needed is an error.
 */
const BUCKET_EFFECT_EXEMPTIONS: { bucket: string; effects: string[]; why: string }[] = [
  {
    bucket: 'bg-image',
    effects: ['--tw-gradient-position background-image', 'background-image'],
    why: "Tailwind's gradient utilities set a position variable beside background-image; an arbitrary `bg-[linear-gradient(…)]` writes the property alone. Both write background-image and the browser replaces an image whole, so the later class does supersede the earlier one."
  },
  {
    bucket: 'scale',
    effects: ['--tw-scale-x --tw-scale-y --tw-scale-z scale', 'scale'],
    why: 'the named steps set the three factor variables that the composed `scale` reads; an arbitrary `scale-[…]` writes `scale` directly. Both write the `scale` property, which is replaced whole — the variables are how Tailwind composes it, not a second effect.'
  },
  {
    bucket: 'text-overflow',
    effects: ['overflow text-overflow white-space', 'text-overflow'],
    why: '`truncate` is the composite of the three properties, `text-ellipsis` the property alone. Splitting them would let `truncate text-clip` keep the ellipsis, so the shared bucket is the right call — at the price that a later `text-ellipsis` leaves `overflow`/`white-space` behind.'
  },
  {
    bucket: 'text-size',
    effects: ['font-size', 'font-size line-height'],
    why: 'a named step ships its line-height only where `--text-<key>--line-height` exists. The library’s own sub-xs steps (`--text-2xs`, `--text-3xs`) define no such sub-key, and no arbitrary size can. All of them are sizes and must replace each other; the differing set is a missing theme sub-key, not a mis-bucket.'
  },
  {
    bucket: 'gradient-via',
    effects: [
      '--tw-gradient-stops --tw-gradient-via --tw-gradient-via-stops',
      '--tw-gradient-via-stops'
    ],
    why: '`via-none` removes the middle stop and a `via-<colour>` places one — the same either/or as `bg-none` against a gradient, and the same nesting. Only the stop POSITIONS were a real second effect in this bucket, and those now have one of their own.'
  },
  {
    bucket: 'outline-style',
    effects: [
      '--tw-outline-style outline outline-offset outline-style',
      '--tw-outline-style outline-style'
    ],
    why: '`outline-hidden` is `outline-style: none` plus a forced-colors escape hatch (`outline: 2px solid transparent` inside `@media (forced-colors: active)`), so it replaces any other style keyword and carries two more properties while doing it. The bucket lost bare `outline` on the way here, and that has a price: the library writes `outline-none` at 7 slot sites unprefixed and 106 more behind `focus-visible:` / `focus:` / `focus-within:`. A bare consumer `outline` used to strip the first 7; a prefixed override strips the share of its own spelling, and cross-prefix pairs resolved in neither engine. Two combinations start resolving (`outline-2 + outline`, which never did before). So this closes an inconsistency and loses the one spelling that happened to work. Buying it back with a DOMINANCE edge is not available: it would re-break `outline outline-dashed`, the pairing the repair exists for.'
  },
  {
    bucket: 'sr-only',
    effects: [
      'border-width clip-path height margin overflow padding position white-space width',
      'clip-path height margin overflow padding position white-space width'
    ],
    why: '`sr-only` and `not-sr-only` are each other’s undo; `sr-only` additionally zeroes `border-width`, which `not-sr-only` has no value to restore. They must replace each other, and across sources they do — the later one wins whole.'
  },
  {
    bucket: 'text-shadow',
    effects: ['color text-shadow', 'text-shadow'],
    why: 'the `color` is this repo’s theme, not Tailwind: `semantic.css` declares the box-shadow scale as `--color-shadow-xs…lg` INSIDE the colour namespace, so `text-shadow-lg` is also a valid `text-<colour>` spelling and the compiler emits both readings. All six are text-shadow steps and replace each other, which is what this bucket has to get right. The colour half is NOT harmless and is not this bucket’s to fix: a multi-layer shadow is invalid at computed-value time as a `color`, which for an inherited property means `inherit` rather than "ignored" — and `.text-shadow-lg` is emitted after `.text-primary` at equal specificity, so `text-primary text-shadow-lg` renders the parent’s colour (measured in Chromium; `text-primary` alone renders the token). The fix is to move the shadow scale out of the colour namespace — #368.'
  },
  {
    bucket: 'text-shadow-color',
    effects: ['--tw-text-shadow-color', 'color'],
    why: 'same root as the `text-shadow` entry, one class further: `text-shadow-base` has no `--text-shadow-base` size key to match, so `text-<colour:shadow-base>` is its ONLY reading and it writes `color` alone. No pattern can tell it from a real `text-shadow-<colour>` without restating the theme’s colour keys — the second Tailwind model this gate exists to prevent. Renaming `--color-shadow-*` out of the colour namespace would remove this entry and the one above; that is a breaking theme change.'
  },
  {
    bucket: 'transition',
    effects: [
      'transition-duration transition-property transition-timing-function',
      'transition-property'
    ],
    why: '`transition-none` is the family’s off switch and must replace any property list, which across sources it does — the later one wins whole. The duration and timing function live in their own buckets and survive on their own, transitioning nothing once no property is listed.'
  },
  {
    bucket: 'transition-duration',
    effects: ['--tw-duration', '--tw-duration transition-duration'],
    why: '`duration-initial` resets the variable the named steps compose through without writing `transition-duration` itself. It replaces a step and is replaced by one; the property it omits is the one that variable feeds.'
  },
  {
    bucket: 'transition-timing-function',
    effects: ['--tw-ease', '--tw-ease transition-timing-function'],
    why: 'the `ease-initial` counterpart of the `duration-initial` entry above — same shape, same reason.'
  },
  {
    bucket: 'translate',
    effects: ['--tw-translate-x --tw-translate-y translate', 'translate'],
    why: 'the same shape as the `scale` entry: the named steps set the axis variables the composed `translate` reads, while `translate-3d` and `translate-none` write the property directly. All replace each other, the property being replaced whole.'
  }
];
const bucketExemptions = new Map(BUCKET_EFFECT_EXEMPTIONS.map((e) => [e.bucket, e]));
const bucketExemptionsHit = new Set<string>();

const unbucketed: Finding[] = [];
for (const { cls, properties } of findUnbucketed(classEffects, tailwindBucket)) {
  // Suppressed, and deliberately not counted as "this entry earned its keep":
  // these families are unused on purpose, and the day one is used is exactly
  // the day the entry must already be there. What must not go stale is the
  // entry's CLAIM — which is why suppression is conditional on the class
  // actually composing, and a match that does not is reported as an
  // over-reaching pattern rather than quietly swallowed.
  const matched = COMPOSING_UTILITIES.findIndex((e) => e.pattern.test(cls));
  if (matched !== -1) {
    if (composesOwnAxis(properties)) continue;
    composingOverreach.set(matched, [...(composingOverreach.get(matched) ?? []), cls]);
  }
  for (const where of emitCandidates.get(cls) ?? []) {
    unbucketed.push({
      where,
      token: cls,
      detail: `Tailwind writes ${properties.join(', ')} for this class, but BUCKET_PATTERNS in utils/variants.ts matches nothing — the resolver returns null, so a consumer's override and this class both survive the fold and the stylesheet's emit order decides which one renders. Two ways out, and picking the wrong one is worse than the gap: add the pattern for its family if these classes REPLACE each other, or — if they are meant to be worn together and each writes its own --tw-* sub-axis (a bucket would make the family strip itself) — add a COMPOSING_UTILITIES entry in this script`
    });
  }
}
// `relation` first, because it ranks the list: a bucket whose effect sets share
// no property cannot hold classes that replace each other, so it always strips
// something for nothing, while nesting is what a composition looks like. The
// first run over both populations returned 20 collisions — 6 DISJOINT, 11
// NESTED, 3 OVERLAP. Every DISJOINT bucket was stripping for nothing; five were
// repaired by narrowing a pattern and one could not be. Every NESTED one was
// legitimate. All 3 OVERLAP buckets needed a human, and all 3 hid a defect.
const RELATION_HINT: Record<CollisionFinding['relation'], string> = {
  disjoint:
    'the sets share NO property, so neither class can replace the other — the pattern that catches them is too wide',
  nested:
    'one set contains the other, the shape of a composition — probably an exemption, at the price that the smaller class leaves the extra properties behind',
  overlap: 'the sets intersect without containment — neither reading is automatic, decide it'
};
const bucketCollisions: { bucket: string; detail: string }[] = [];
for (const collision of findCollisions(bucketedEffects, tailwindBucket)) {
  const signatures = collision.effects.map((e) => e.properties.join(' ')).sort();
  const family = bucketFamily(collision.bucket);
  const exemption = bucketExemptions.get(family);
  if (exemption && exemption.effects.join('\0') === signatures.join('\0')) {
    bucketExemptionsHit.add(family);
    continue;
  }
  const odd = collision.effects.slice(1).flatMap((e) => e.classes);
  bucketCollisions.push({
    bucket: collision.bucket,
    detail: `[${collision.relation.toUpperCase()}] ${collision.bucket}: ${
      collision.effects.length
    } distinct effects among ${collision.total} classes — ${odd.slice(0, 12).join(' ')}${
      odd.length > 12 ? ` … (${odd.length} total)` : ''
    }\n    ${collision.effects
      .map((e) => `[${e.classes.length}] ${e.properties.join(', ')} — e.g. ${e.classes[0]}`)
      .join('\n    ')}\n    ${
      RELATION_HINT[collision.relation]
    }. The bucket claims these classes replace each other; the compiler says they write different properties. Either the pattern that catches them is too wide, or the disagreement is Tailwind's own — then pin it in BUCKET_EFFECT_EXEMPTIONS with its effect sets and the reason`
  });
}
const staleBucketExemptions = BUCKET_EFFECT_EXEMPTIONS.filter(
  (e) => !bucketExemptionsHit.has(e.bucket)
);

// ─── report ──────────────────────────────────────────────────────────────────

console.log(
  `variants-lint: ${loaded.length} configs in ${files.length} files, ${themeVars.size} @theme keys, ${probe.checked} classes compiled — ${dead.length} lost, ${unknownTheme.length} unknown-theme, ${noCss.length} no-CSS, ${missingTransition.length} incomplete transition list(s), ${readingSurfaceHover.length} reading-surface hover(s), ${intentAsText.length} intent-as-text, ${unbucketed.length} unbucketed, ${bucketCollisions.length} bucket collision(s), ${shadowed.length} shadowed, ${partial.length} partially-stripped token(s)`
);

for (const err of fileErrors) console.error(`✖ ${err}`);
for (const f of dead) console.error(`✖ lost token '${f.token}' in ${f.where} (${f.detail})`);
for (const f of unknownTheme) {
  console.error(`✖ unknown theme key for '${f.token}' in ${f.where} (${f.detail})`);
}
for (const f of noCss) {
  console.error(`✖ no CSS emitted for '${f.token}' in ${f.where}\n    ${f.detail}`);
}
for (const f of unbucketed) {
  console.error(`✖ no conflict bucket for '${f.token}' in ${f.where}\n    ${f.detail}`);
}
for (const c of bucketCollisions)
  console.error(`✖ bucket disagrees with the compiler — ${c.detail}`);
for (const problem of composingBroken) {
  console.error(`✖ COMPOSING_UTILITIES: ${problem}.`);
}
for (const [i, classes] of composingOverreach) {
  console.error(
    `✖ COMPOSING_UTILITIES: entry ${i}'s pattern ${COMPOSING_UTILITIES[i].pattern} also matches ${classes.length} class(es) that write no --tw-* sub-axis (${classes
      .slice(0, 5)
      .join(
        ', '
      )}) — those REPLACE each other and want a bucket, so the pattern is too wide and would have hidden them.`
  );
}
for (const e of staleBucketExemptions) {
  console.error(
    `✖ stale BUCKET_EFFECT_EXEMPTIONS entry '${e.bucket}' — the bucket no longer holds those effect sets; drop the entry from variants-lint.ts.`
  );
}
for (const token of staleHandWritten) {
  console.error(
    `✖ stale HAND_WRITTEN_CSS entry '${token}' — no tv() config references it any more; drop the entry from variants-lint.ts.`
  );
}
for (const f of missingTransition) {
  console.error(`✖ incomplete transition list '${f.token}' in ${f.where}\n    ${f.detail}`);
}
for (const f of readingSurfaceHover) {
  console.error(`✖ hover on a resting surface '${f.token}' in ${f.where}\n    ${f.detail}`);
}
for (const f of intentAsText) {
  console.error(`✖ intent fill used as text '${f.token}' in ${f.where}\n    ${f.detail}`);
}
const staleIntentTextExemptions = [...intentTextExemptions.values()].filter(
  (e) => !intentTextExemptionsHit.has(intentTextExemptionKey(e.where, e.token))
);
for (const e of staleIntentTextExemptions) {
  console.error(
    `✖ stale intent-as-text exemption '${e.token}' for ${e.where} — the slot no longer carries that class; drop the entry from INTENT_AS_TEXT_EXEMPTIONS.`
  );
}
const staleExemptions = [...exemptions.values()].filter(
  (e) => !exemptionsHit.has(exemptionKey(e.where, e.property))
);
for (const e of staleExemptions) {
  console.error(
    `✖ stale transition exemption '${e.property}' for ${e.where} — the slot no longer writes that property; drop the entry from TRANSITION_EXEMPTIONS.`
  );
}

if (SHOW_WARNINGS) {
  for (const f of shadowed) console.warn(`⚠ shadowed '${f.token}' in ${f.where} (${f.detail})`);
  for (const f of partial) console.warn(`⚠ '${f.token}' in ${f.where} (${f.detail})`);
} else if (partial.length + shadowed.length > 0) {
  console.log(
    `  (run with --warnings to list the ${shadowed.length} shadowed + ${partial.length} partially-stripped tokens)`
  );
}

if (
  fileErrors.length > 0 ||
  dead.length > 0 ||
  unknownTheme.length > 0 ||
  noCss.length > 0 ||
  staleHandWritten.length > 0 ||
  unbucketed.length > 0 ||
  bucketCollisions.length > 0 ||
  staleBucketExemptions.length > 0 ||
  composingBroken.length > 0 ||
  composingOverreach.size > 0 ||
  missingTransition.length > 0 ||
  readingSurfaceHover.length > 0 ||
  intentAsText.length > 0 ||
  staleIntentTextExemptions.length > 0 ||
  staleExemptions.length > 0
) {
  process.exit(1);
}
