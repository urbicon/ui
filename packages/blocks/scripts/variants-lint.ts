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
 *   ✖ ERROR  transform property missing from an arbitrary transition list —
 *            Tailwind 4 emits `scale-*` / `translate-*` / `rotate-*` as the
 *            DISCRETE CSS properties `scale:` / `translate:` / `rotate:`, not
 *            as `transform:`. A list like `transition-[…,transform]` therefore
 *            covers none of them and the motion jumps instead of animating.
 *            (The shorthand `transition-transform` expands to all four and is
 *            never flagged.) See "transform transitions" below.
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
import { checkClassToken, collectThemeVars } from './theme-tokens';

const ENGINE = resolve(import.meta.dir, '../src/lib/utils/variants.ts');
const BLOCKS_LIB = resolve(import.meta.dir, '../src/lib');
const REPO = resolve(import.meta.dir, '../../..');
const SHOW_WARNINGS = process.argv.includes('--warnings');

const GLOBS = [
  'packages/blocks/src/lib/primitives/*/*.variants.ts',
  'packages/blocks/src/lib/components/*/*.variants.ts',
  'packages/table/src/lib/variants/*.variants.ts',
  'packages/docs/src/lib/components/*/*.variants.ts'
];

type Cfg = {
  base?: string | string[];
  slots?: Record<string, string | string[]>;
  variants?: Record<string, Record<string, unknown>>;
  compoundVariants?: Record<string, unknown>[];
  defaultVariants?: Record<string, unknown>;
};

const { matchesCompound, tv } = await import(ENGINE);

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

// The repo carries ~91 configs; a collapse of this number means the export
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

/** Properties declared by an arbitrary `transition-[a,b]` list (null if not one). */
function transitionListProperties(utility: string): Set<string> | null {
  const m = /^transition-\[(.+)\]$/.exec(bareUtility(utility));
  if (m == null) return null;
  return new Set(
    m[1]
      .split(',')
      .map((p) => p.trim().replaceAll('_', ' '))
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
const missingTransition: Finding[] = [];
const missingTransitionSeen = new Set<string>();

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
        const miss = checkClassToken(token, themeVars);
        if (miss == null) continue;
        const where = `${file} › ${name}${slots ? ` › ${slot}` : ''}`;
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

// ─── report ──────────────────────────────────────────────────────────────────

console.log(
  `variants-lint: ${loaded.length} configs in ${files.length} files, ${themeVars.size} @theme keys — ${dead.length} lost, ${unknownTheme.length} unknown-theme, ${missingTransition.length} incomplete transition list(s), ${shadowed.length} shadowed, ${partial.length} partially-stripped token(s)`
);

for (const err of fileErrors) console.error(`✖ ${err}`);
for (const f of dead) console.error(`✖ lost token '${f.token}' in ${f.where} (${f.detail})`);
for (const f of unknownTheme) {
  console.error(`✖ unknown theme key for '${f.token}' in ${f.where} (${f.detail})`);
}
for (const f of missingTransition) {
  console.error(`✖ incomplete transition list '${f.token}' in ${f.where}\n    ${f.detail}`);
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
  missingTransition.length > 0 ||
  staleExemptions.length > 0
) {
  process.exit(1);
}
