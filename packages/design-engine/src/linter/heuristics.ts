/**
 * The slop-floor — stage 2 of the validator (DESIGN-MCP-V2 §6). Unlike the
 * deterministic correctness rules (which are Urbicon-specific: token whitelist,
 * `dark:`/`focus:`), these are **system-agnostic** judgements about whether the
 * markup *looks generic* — the faceless, default-everything output that reads as
 * "an AI made this". They operationalise the Design-Quality guidance ("Color =
 * meaning", "Spacing = hierarchy", "Vary visual weight", "Commit to a radius")
 * plus the impeccable slop-floor signals (generic fonts, animated dimensions,
 * grey-on-colour, touch targets, line length, heading jumps).
 *
 * All findings are `info`/`heuristic`, so they score on the **slop** axis (never
 * the correctness gate) and are advisory: a judgement can have false positives,
 * and these never block. Each heuristic fires **at most once** — it is one
 * holistic verdict about the page, carrying the first occurrence's line plus a
 * count, so a repeated sin costs one flat slop weight, not N.
 *
 * Thresholds are named constants so the eval-suite (§9) can tune them with data
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
  minSurfacesForRadius: 3,
  /** Minimum explicit font-weight utilities before uniformity is judged. */
  minFontWeights: 5,
  /** `h-`/`size-` scale step (×4px) on an interactive element at/below which it is too small to tap (≤28px). */
  touchTargetUnitCeil: 7,
  /** Arbitrary `…-[Npx]` dimensions below this many px are hairlines/dividers, not magic numbers. */
  hairlinePxFloor: 3
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

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

/** A located occurrence of a slop pattern. */
interface Hit {
  line: number;
  match: string;
}

/** Collect every match of a global regex across lines, tagged with a 1-based line number. */
function collectHits(lines: string[], re: RegExp): Hit[] {
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(re)) hits.push({ line: i + 1, match: m[0] });
  });
  return hits;
}

/** 1-based line number of a character offset in the full source. */
function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

/** Each `class="…"` / `class={…}` value on a line (the raw utility string). */
function classValues(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bclass=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return out;
}

/**
 * Reduce N occurrences to a single slop finding: the first occurrence anchors the
 * line/match. `message` is a plain string, or a factory `(count, first) => string`
 * for rules that fold the total count / first match into the text — the factory is
 * called only when there is ≥1 hit, so it never reaches for `hits[0]` defensively.
 * Empty hits → no finding.
 */
function slop(
  ruleId: string,
  hits: Hit[],
  message: string | ((count: number, first: Hit) => string),
  fix: string
): Finding[] {
  if (hits.length === 0) return [];
  const first = hits[0]!;
  return [
    {
      ruleId,
      severity: 'info',
      kind: 'heuristic',
      message: typeof message === 'function' ? message(hits.length, first) : message,
      fix,
      line: first.line,
      match: first.match
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1 — Distribution heuristics (the original four + font-weight)
// ─────────────────────────────────────────────────────────────────────────────

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

/** "Vary visual weight" (type axis): flag many explicit font-weights that never vary. */
function checkFontWeightUniformity(atoms: string[]): Finding[] {
  const weightRe = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
  const values = new Set<string>();
  let total = 0;
  for (const atom of atoms) {
    const m = atom.match(weightRe);
    if (m) {
      values.add(m[1]!);
      total++;
    }
  }
  if (total >= HEURISTIC_THRESHOLDS.minFontWeights && values.size === 1) {
    return [
      {
        ruleId: 'font-weight-uniform',
        severity: 'info',
        kind: 'heuristic',
        message: `All ${total} explicit font-weights are \`font-${[...values][0]}\`. No typographic hierarchy.`,
        fix: 'Vary weight to rank content: headings `font-semibold`/`font-bold`, body `font-normal`, captions `font-medium text-text-tertiary`.'
      }
    ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 2 — Token-system bypass & generic-default atoms (per-line regex scans)
// ─────────────────────────────────────────────────────────────────────────────

/** Generic system font stacks — the "no identity typeface" tell. */
const GENERIC_FONT_NAMES =
  'arial|helvetica|system-ui|-apple-system|blinkmacsystemfont|segoe ui|segoe|roboto|times new roman|times|georgia|courier|verdana|tahoma|sans-serif|monospace';
const GENERIC_FONT_RE = new RegExp(
  `(?:font-\\[[^\\]]*?(?:${GENERIC_FONT_NAMES})[^\\]]*?\\]|font-family\\s*:\\s*[^;"'}]*(?:${GENERIC_FONT_NAMES}))`,
  'gi'
);

function checkGenericFont(lines: string[]): Finding[] {
  return slop(
    'generic-font',
    collectHits(lines, GENERIC_FONT_RE),
    'Hardcoded generic font stack (Arial/Helvetica/system-ui…). Defaults look like an unstyled draft, not a brand.',
    'Use the design-system typeface via the `font-*` family tokens (e.g. `font-sans`/`font-display`) so type carries identity.'
  );
}

/** Arbitrary colour value (`bg-[#…]`, `text-[rgb(…)]`) — bypasses the token system entirely. */
const ARBITRARY_COLOR_RE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide|accent|caret|placeholder)-\[(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)\()/gi;

function checkArbitraryColor(lines: string[]): Finding[] {
  return slop(
    'arbitrary-color',
    collectHits(lines, ARBITRARY_COLOR_RE),
    'Arbitrary colour literal in a utility — outside the token system, so no dark-mode adaptation, no theming, no cohesion.',
    'Use a semantic token (`bg-surface-*`, `text-text-*`, intents) or `…-[var(--color-*)]` if you must reference a token by variable.'
  );
}

/** `transition-all` — animates every property, including layout (janky), and over-animates. */
const TRANSITION_ALL_RE = /\btransition-all\b/g;

function checkTransitionAll(lines: string[]): Finding[] {
  return slop(
    'transition-all',
    collectHits(lines, TRANSITION_ALL_RE),
    '`transition-all` animates every property that changes — including layout — which is janky and rarely intended.',
    'Transition only what changes: `transition-colors`, `transition-opacity`, `transition-transform`.'
  );
}

/**
 * Transitioning a layout dimension — width/height/top/… cannot be GPU-composited,
 * so it janks. The bracket body is captured in a single linear `[^\]]*` pass to the
 * literal `]` (no overlapping quantifier → no quadratic backtracking on an
 * unterminated `transition-[…`); the keyword is then tested on the small captured
 * group.
 */
const ANIMATED_DIM_BRACKET_RE = /\btransition-\[([^\]]*)\]/g;
const ANIMATED_DIM_KEYWORD_RE = /\b(?:width|height|size|top|left|right|bottom|margin|padding)\b/;

function checkAnimatedDimensions(lines: string[]): Finding[] {
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(ANIMATED_DIM_BRACKET_RE)) {
      if (ANIMATED_DIM_KEYWORD_RE.test(m[1]!)) hits.push({ line: i + 1, match: m[0] });
    }
  });
  return slop(
    'animated-dimensions',
    hits,
    'Transitioning a layout dimension (width/height/inset). These trigger layout on every frame and stutter.',
    'Animate `transform` (`scale`/`translate`) or `opacity` instead — they composite on the GPU. For size, use a `grid-template` trick or accept an instant change.'
  );
}

/**
 * Arbitrary px box-dimension (`w-[317px]`) — a magic number off the spacing scale.
 * Box/spacing utilities only; font-size/leading/tracking are a separate typographic
 * axis where small arbitrary px (`text-[10px]` micro-labels) is a common, legit choice.
 */
const MAGIC_DIM_RE =
  /\b(?:w|h|min-w|min-h|max-w|max-h|size|gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|top|left|right|bottom|inset)-\[(\d+(?:\.\d+)?)px\]/g;

function checkMagicDimensions(lines: string[]): Finding[] {
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(MAGIC_DIM_RE)) {
      // Skip 1–2px values: those are hairlines/dividers, a legitimate use of arbitrary px.
      if (Number.parseFloat(m[1]!) >= HEURISTIC_THRESHOLDS.hairlinePxFloor) {
        hits.push({ line: i + 1, match: m[0] });
      }
    }
  });
  return slop(
    'magic-dimension',
    hits,
    (count, first) =>
      `Arbitrary px dimension(s) off the spacing scale (${count} found, first \`${first.match}\`). Magic numbers drift from the rhythm.`,
    'Use scale utilities (`w-64`, `h-12`, `max-w-md`) or a relative bound (`max-w-prose`, `w-full`). Reserve arbitrary px for true one-offs.'
  );
}

/**
 * `!important` modifier — a specificity hack that signals fighting the system.
 * Lookbehind on the class boundary (quote/space/brace) keeps the boundary char
 * out of the match, and requires a `utility-` shape so JS negation (`!isOpen`)
 * never matches.
 */
const IMPORTANT_RE = /(?<=[\s"'`])![a-z][a-z0-9]*-[a-z0-9[]/g;

function checkImportant(lines: string[]): Finding[] {
  return slop(
    'important-modifier',
    collectHits(lines, IMPORTANT_RE),
    (count, first) =>
      `\`!important\` modifier(s) (${count} found, first \`${first.match}\`). Overriding the cascade by force is a smell, not a fix.`,
    'Remove the `!` and resolve the specificity conflict at its source (ordering, the component’s own props, or `slotClasses`).'
  );
}

/**
 * Inline `style="…"` that hardcodes a *paint or type* property — colour,
 * background, border-colour, shadow, font. Those are exactly what the token system
 * owns, so inlining them bypasses theming and dark-mode. Deliberately narrow:
 * positioning/layout inline (`position`, `inset`, `transform`, `overflow`) is often
 * functional (JS-driven overlays, SVG transforms) and not flagged, and interpolated
 * runtime values (`width: {pct}%`) have no static utility equivalent.
 */
const INLINE_PAINT_RE =
  /(?:^|;|\s)(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?-color|box-shadow|text-shadow|font-family|font-size|font-weight|fill|stroke|opacity)\s*:/i;

function checkInlineStyle(lines: string[]): Finding[] {
  const hits: Hit[] = [];
  const styleRe = /\bstyle=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  lines.forEach((line, i) => {
    for (const m of line.matchAll(styleRe)) {
      const body = m[1] ?? m[2] ?? m[3] ?? '';
      // Any interpolation marks the *whole* declaration set dynamic and skips it.
      // Trade-off: a mixed `color: red; width: {w}%` escapes the static `color` too —
      // accepted, because suppressing the FP on dynamic styles matters more than that edge.
      if (/\{[^}]*\}|\$\{/.test(body)) continue;
      if (INLINE_PAINT_RE.test(body)) hits.push({ line: i + 1, match: 'style=…' });
    }
  });
  return slop(
    'inline-style',
    hits,
    (count) =>
      `Inline \`style\` hardcodes colour/typography (${count} found). Bypasses the token system — no theming, no dark-mode adaptation.`,
    'Use semantic utilities/tokens (`bg-surface-*`, `text-text-*`, `font-*`). Keep inline `style` for genuinely dynamic values (interpolated sizes/positions, CSS custom properties).'
  );
}

/** Gradient text (`bg-clip-text` + transparent fill) — a stock "hero" flourish. */
const GRADIENT_TEXT_RE = /\bbg-clip-text\b/g;

function checkGradientText(lines: string[]): Finding[] {
  return slop(
    'gradient-text',
    collectHits(lines, GRADIENT_TEXT_RE),
    'Gradient-clipped text (`bg-clip-text` + transparent fill) — a stock flourish that reads as generic and often fails contrast.',
    'Prefer a solid `text-*` token. If you need emphasis, vary weight/size or use a single intent colour.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 3 — Contrast & content slop
// ─────────────────────────────────────────────────────────────────────────────

/** A solid/emphasis chromatic intent background (not the light `-subtle` or scale tints). */
const INTENT_BG_RE = /\bbg-(?:primary|secondary|success|warning|danger|info)(?:-emphasis)?\b(?!-)/;
/** A muted/low-contrast text token (ours or a raw grey mid-step). */
const MUTED_TEXT_RE =
  /\btext-(?:text-(?:tertiary|quaternary|disabled|secondary)|muted|neutral-[345]00|gray-[345]00|slate-[345]00|zinc-[345]00|stone-[345]00)\b/;

/** Grey-on-colour: muted text on a saturated intent surface — a recurring contrast failure. */
function checkGreyOnIntent(lines: string[]): Finding[] {
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    for (const value of classValues(line)) {
      if (INTENT_BG_RE.test(value) && MUTED_TEXT_RE.test(value)) {
        hits.push({ line: i + 1, match: value.trim().slice(0, 40) });
      }
    }
  });
  return slop(
    'grey-on-intent',
    hits,
    'Muted/grey text on a saturated intent background. Low contrast and muddy — the colour stops carrying meaning.',
    'On an intent surface use the on-colour token (`text-on-primary`/`text-on-dark`). Reserve muted greys for neutral surfaces.'
  );
}

/**
 * Centred body copy: `text-center` on a `<p>` — hurts readability past one line.
 * Scanned against the full source: the opening tag routinely wraps across lines
 * under the repo's Prettier width, so a per-line scan would miss it. The class
 * value is captured in a single linear pass (no overlapping `[^"]*` around the
 * keyword → ReDoS-safe) and tested afterwards.
 */
const PARA_CLASS_RE = /<p\b[^>]*?\bclass=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;

function checkCenteredBodyText(code: string): Finding[] {
  const hits: Hit[] = [];
  for (const m of code.matchAll(PARA_CLASS_RE)) {
    const cls = m[1] ?? m[2] ?? m[3] ?? '';
    if (/\btext-center\b/.test(cls)) {
      hits.push({ line: lineOf(code, m.index ?? 0), match: '<p … text-center>' });
    }
  }
  return slop(
    'centered-bodytext',
    hits,
    'Centred paragraph text. Ragged left edges make multi-line copy hard to scan.',
    'Left-align body copy (`text-left`). Reserve `text-center` for short headings, single labels, or empty states.'
  );
}

/** Justified text — uneven word spacing and "rivers" hurt readability on the web. */
const JUSTIFIED_RE = /\btext-justify\b/g;

function checkJustifiedText(lines: string[]): Finding[] {
  return slop(
    'justified-text',
    collectHits(lines, JUSTIFIED_RE),
    'Justified text. Without hyphenation the browser stretches word spacing into uneven "rivers" that hurt readability.',
    'Use `text-left` (`text-right` for RTL). Justification needs typographic control the web does not give by default.'
  );
}

/** Placeholder filler copy left in the markup — an unfinished tell. */
const PLACEHOLDER_RE =
  /\b(?:lorem ipsum|dolor sit amet|consectetur adipiscing|sed do eiusmod|the quick brown fox)\b/gi;

function checkPlaceholderContent(lines: string[]): Finding[] {
  return slop(
    'placeholder-content',
    collectHits(lines, PLACEHOLDER_RE),
    'Lorem-ipsum / filler copy in the output. Placeholder text ships as "unfinished".',
    'Replace with real, representative content — it changes layout, length, and tone decisions.'
  );
}

/**
 * Emoji used where the icon system belongs. Three tiers:
 * 1. Pictographic blocks (U+1F300–1FAFF: emoticons, symbols, transport) — always.
 * 2. BMP symbols whose Unicode default presentation is *emoji* (✅❌✨⭐⭕❓❗➕… —
 *    render in colour with or without VS16, and LLMs emit them bare as status icons) — always.
 * 3. The remaining misc-symbols / dingbats / arrows — only with an explicit
 *    emoji-presentation selector (U+FE0F), so a bare monochrome text glyph
 *    (`✓`, `⚠`, `→`, `★`) is not flagged, only its deliberate emoji form (`⚠️`).
 * Excludes text symbols (©®™) and maths.
 */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2705}\u{2728}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2795}-\u{2797}\u{27B0}\u{27BF}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{26A1}\u{2614}\u{2615}]|[\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}]\u{FE0F}/gu;

function checkEmojiAsIcon(lines: string[]): Finding[] {
  return slop(
    'emoji-as-icon',
    collectHits(lines, EMOJI_RE),
    'Emoji in the markup as iconography. They render inconsistently across platforms and clash with a real icon set.',
    'Use the `Icon` component / a `*Icon` from the 315-icon set (`find_icons`) — consistent stroke, size, and theming.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 4 — Structural slop (need cross-element context)
// ─────────────────────────────────────────────────────────────────────────────

/** Heading-level skip (e.g. `<h1>` → `<h3>`) — breaks the document outline and a11y. */
function checkHeadingSkip(code: string): Finding[] {
  const headings: { level: number; index: number }[] = [];
  for (const m of code.matchAll(/<h([1-6])\b/g)) {
    headings.push({ level: Number(m[1]), index: m.index ?? 0 });
  }
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1]!;
    const cur = headings[i]!;
    // Going deeper by more than one level skips a rank. Going shallower is fine.
    if (cur.level - prev.level >= 2) {
      return [
        {
          ruleId: 'heading-skip',
          severity: 'info',
          kind: 'heuristic',
          message: `Heading jumps from <h${prev.level}> to <h${cur.level}>, skipping a level. Breaks the outline and screen-reader navigation.`,
          fix: `Use sequential ranks (<h${prev.level}> → <h${prev.level + 1}>). Style size with classes, not by picking a smaller heading tag.`,
          line: lineOf(code, cur.index)
        }
      ];
    }
  }
  return [];
}

/**
 * Interactive element pinned to a sub-touch-target height. Scanned against the
 * full source so an opening tag wrapping across lines still matches. The
 * `(?<![\w-])` boundary rejects `min-h-*`/`max-h-*`: a floor/cap is not a fixed
 * sub-44 height (and `min-h-11` is the idiomatic fix this rule recommends), so
 * matching the bare `h-` inside them would fire on correct code.
 */
const SMALL_TOUCH_RE = new RegExp(
  `<(?:button|a)\\b[^>]*?(?<![\\w-])(?:h|size)-(?:[1-${HEURISTIC_THRESHOLDS.touchTargetUnitCeil}]|0\\.5|1\\.5|2\\.5|3\\.5)\\b`,
  'g'
);

function checkTouchTarget(code: string): Finding[] {
  const hits: Hit[] = [];
  for (const m of code.matchAll(SMALL_TOUCH_RE)) {
    hits.push({ line: lineOf(code, m.index ?? 0), match: m[0].replace(/\s+/g, ' ').slice(0, 40) });
  }
  return slop(
    'touch-target-small',
    hits,
    'Interactive element with a fixed sub-44px height. Hard to tap; fails the 44×44 touch-target guideline.',
    'Give tappable controls ≥ `h-11` (44px) or enough padding (`py-2.5`+). Keep tiny sizes for decorative icons only.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Run all slop-floor heuristics over the (comment-masked) code. */
export function runHeuristics(code: string): Finding[] {
  const atoms = collectAtoms(code);
  const lines = code.split('\n');
  return [
    // Group 1 — distribution
    ...checkIntentRainbow(atoms),
    ...checkSpacingUniformity(atoms),
    ...checkCardMonotony(code),
    ...checkRadiusStrategy(code, atoms),
    ...checkFontWeightUniformity(atoms),
    // Group 2 — token-bypass & generic defaults
    ...checkGenericFont(lines),
    ...checkArbitraryColor(lines),
    ...checkTransitionAll(lines),
    ...checkAnimatedDimensions(lines),
    ...checkMagicDimensions(lines),
    ...checkImportant(lines),
    ...checkInlineStyle(lines),
    ...checkGradientText(lines),
    // Group 3 — contrast & content
    ...checkGreyOnIntent(lines),
    ...checkCenteredBodyText(code),
    ...checkJustifiedText(lines),
    ...checkPlaceholderContent(lines),
    ...checkEmojiAsIcon(lines),
    // Group 4 — structural
    ...checkHeadingSkip(code),
    ...checkTouchTarget(code)
  ];
}
