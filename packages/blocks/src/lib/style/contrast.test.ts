import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast audit for the filled intent surfaces — light AND dark, for
 * the default palette and every shipped theme.
 *
 * Why this exists: the intent ramps in foundation.css carry a comment
 * promising that the solid intent backgrounds clear WCAG AA against their
 * foreground token. That promise was hand-computed and had drifted. This
 * test measures it instead: it parses the real CSS, resolves the same
 * token graph the browser resolves (`light-dark()`, `var()` chains, the
 * `oklch(from …)` relative-color syntax used by the neutral intent), and
 * computes the contrast ratio from first principles.
 *
 * Zero-dependency by construction: the OKLCH → OKLab → LMS → linear sRGB →
 * sRGB → WCAG-luminance conversion is implemented here rather than pulled
 * from a color library. `describe('color math')` below validates it against
 * known reference values before any token is judged, because a test that
 * measures wrongly is worse than no test at all.
 *
 * Gamut note: several intent tokens sit outside sRGB (e.g. primary-600 has
 * a linear-light red of −0.39). This file *clamps* the linear-sRGB channels,
 * which was verified to match what Chromium, WebKit and Firefox actually
 * rasterize for these colors — all three agree byte-for-byte with the values
 * asserted here (verified 2026-07-14 by screenshotting `background-color`
 * swatches and reading back the pixels). If a browser ever switches to true
 * CSS Color 4 gamut mapping (chroma reduction), out-of-gamut colors would
 * render *lighter* than modelled and these ratios would become optimistic.
 */

// ---------------------------------------------------------------------------
// Color math — OKLCH → sRGB → WCAG relative luminance → contrast ratio
// ---------------------------------------------------------------------------

type Oklch = { l: number; c: number; h: number };
type Rgb = [number, number, number];

/** OKLCH → linear-light sRGB (Björn Ottosson's matrices, unclamped). */
function oklchToLinearSrgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → LMS' → LMS
  const lp = L + 0.3963377774 * a + 0.2158037573 * b;
  const mp = L - 0.1055613458 * a - 0.0638541728 * b;
  const sp = L - 0.0894841775 * a - 1.291485548 * b;
  const l_ = lp ** 3;
  const m_ = mp ** 3;
  const s_ = sp ** 3;

  // LMS → linear sRGB
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  ];
}

/** Linear-light channel → gamma-encoded sRGB (IEC 61966-2-1). */
function encodeSrgb(channel: number): number {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/** Gamma-encoded sRGB channel (0–255) → linear-light, per WCAG 2.x. */
function decodeSrgb(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** OKLCH → the 8-bit sRGB triplet a browser rasterizes (clamped; see header). */
export function oklchToRgb(color: Oklch): Rgb {
  return oklchToLinearSrgb(color).map((channel) =>
    Math.round(Math.min(1, Math.max(0, encodeSrgb(channel))) * 255)
  ) as Rgb;
}

/** WCAG 2.2 relative luminance (§ "relative luminance"). */
function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * decodeSrgb(r) + 0.7152 * decodeSrgb(g) + 0.0722 * decodeSrgb(b);
}

/** WCAG 2.2 contrast ratio — (L1 + 0.05) / (L2 + 0.05), lighter first. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const ratioOf = (bg: Oklch, fg: Oklch) => contrastRatio(oklchToRgb(bg), oklchToRgb(fg));
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// CSS token graph — parse the real files, resolve like the browser does
// ---------------------------------------------------------------------------

const STYLE_DIR = import.meta.dirname;
const read = (file: string) => readFileSync(resolve(STYLE_DIR, file), 'utf8');

const THEMES = ['ocean', 'forest', 'sunset', 'rose', 'neutral'] as const;
type Theme = 'default' | (typeof THEMES)[number];

/** Split on top-level commas only (`light-dark(a, oklch(from x l c h))`). */
function splitArgs(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Grab a custom property's raw value, paren-aware. Last declaration wins. */
function readDecl(css: string, name: string): string | null {
  const re = new RegExp(`${name.replace(/-/g, '\\-')}\\s*:\\s*`, 'g');
  let value: string | null = null;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic exec loop
  while ((match = re.exec(css)) !== null) {
    // Reject prefix collisions: --color-primary must not match --color-primary-500.
    const nextChar = css.slice(match.index + name.length, match.index + name.length + 1);
    if (/[\w-]/.test(nextChar)) continue;
    let i = match.index + match[0].length;
    let depth = 0;
    let raw = '';
    while (i < css.length && !(depth === 0 && css[i] === ';')) {
      if (css[i] === '(') depth++;
      else if (css[i] === ')') depth--;
      raw += css[i];
      i++;
    }
    value = raw.trim();
  }
  return value;
}

/**
 * Drop every `@media` block. `readDecl` takes the LAST declaration, so the
 * `@media (prefers-contrast: more)` overrides in semantic.css would otherwise
 * masquerade as the default value of --color-secondary / --color-neutral.
 * Those are a conditional scenario (measured separately below), not the
 * cascade a default user sees.
 */
function stripMediaBlocks(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    const open = css.indexOf('{', at);
    if (open === -1) break;
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return out;
}

/**
 * The cascade for one theme: base tokens, then the theme's @theme overrides.
 * Mirrors the documented import order (`index.css` then `themes/<name>.css`).
 */
function stylesheetFor(theme: Theme): string {
  const base = `${read('./foundation.css')}\n${read('./semantic.css')}`;
  const cascade = theme === 'default' ? base : `${base}\n${read(`./themes/${theme}.css`)}`;
  return stripMediaBlocks(cascade);
}

/** Resolve a color expression to OKLCH, following var() chains. */
function resolveColor(css: string, expr: string, mode: 'light' | 'dark'): Oklch {
  const value = expr.trim();

  const lightDark = /^light-dark\((.*)\)$/s.exec(value);
  if (lightDark) {
    const [light, dark] = splitArgs(lightDark[1]);
    return resolveColor(css, mode === 'light' ? light : dark, mode);
  }

  // Relative color syntax: oklch(from <color> l c <hue>) — used by the
  // neutral intent to re-hue the warm-neutral ramp per theme.
  const relative = /^oklch\(\s*from\s+(.+?)\s+([\w.]+)\s+([\w.]+)\s+(.+?)\s*\)$/s.exec(value);
  if (relative) {
    const [, source, lExpr, cExpr, hExpr] = relative;
    const origin = resolveColor(css, source, mode);
    const channel = (token: string, fallback: number): number => {
      if (token === 'l') return origin.l;
      if (token === 'c') return origin.c;
      if (token === 'h') return origin.h;
      const varRef = /^var\((--[\w-]+)\)$/.exec(token.trim());
      if (varRef) {
        const raw = readDecl(css, varRef[1]);
        if (raw === null) throw new Error(`Unresolved channel var ${varRef[1]}`);
        return Number.parseFloat(raw);
      }
      const num = Number.parseFloat(token);
      return Number.isNaN(num) ? fallback : num;
    };
    return {
      l: channel(lExpr, origin.l),
      c: channel(cExpr, origin.c),
      h: channel(hExpr, origin.h)
    };
  }

  const literal = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (literal) {
    return { l: +literal[1], c: +literal[2], h: +literal[3] };
  }

  const varRef = /^var\((--[\w-]+)\)$/.exec(value);
  if (varRef) {
    const raw = readDecl(css, varRef[1]);
    if (raw === null) throw new Error(`Unresolved token ${varRef[1]}`);
    return resolveColor(css, raw, mode);
  }

  throw new Error(`Cannot resolve color expression: ${value}`);
}

function resolveToken(css: string, token: string, mode: 'light' | 'dark'): Oklch {
  const raw = readDecl(css, token);
  if (raw === null) throw new Error(`Token ${token} not declared`);
  return resolveColor(css, raw, mode);
}

// ---------------------------------------------------------------------------
// The design contract under test
// ---------------------------------------------------------------------------

/**
 * Which foreground each filled intent pairs with. This is a *declaration* of
 * the contract; `describe('foreground pairing')` below re-derives it from the
 * component variants so the table can never silently drift from the markup.
 */
const INTENT_FOREGROUND = {
  primary: '--color-text-on-primary',
  secondary: '--color-text-on-primary',
  neutral: '--color-text-on-primary',
  success: '--color-text-on-primary',
  warning: '--color-text-on-surface',
  danger: '--color-text-on-primary',
  info: '--color-text-on-primary'
} as const;

type Intent = keyof typeof INTENT_FOREGROUND;
const INTENTS = Object.keys(INTENT_FOREGROUND) as Intent[];

/** The three background tokens a filled surface cycles through. */
const STATES = {
  base: (intent: Intent) => `--color-${intent}`,
  hover: (intent: Intent) => `--color-${intent}-hover`,
  active: (intent: Intent) => `--color-${intent}-active`
} as const;

type State = keyof typeof STATES;
const STATE_NAMES = Object.keys(STATES) as State[];
const MODES = ['light', 'dark'] as const;

/** WCAG 2.2 §1.4.3 — normal-size body text. */
const AA_NORMAL = 4.5;
/** WCAG 2.2 §1.4.11 — non-text/UI-component boundary, and §1.4.3 large text. */
const AA_LARGE = 3;

const key = (theme: Theme, intent: Intent, mode: string, state: State) =>
  `${theme}/${intent}/${mode}/${state}`;

/**
 * === KNOWN SHORTFALLS ===
 *
 * Combinations that do NOT meet AA today. All 24 are one intent — `warning` —
 * and both faces below trace to the same unresolved design question, which is
 * why this is a predicate rather than a list of magic numbers: the shape of
 * the failure is the finding.
 *
 * Warning is the only intent paired with dark text (`--color-text-on-surface`
 * rather than `--color-text-on-primary`), because its fill is a light amber in
 * BOTH modes. That pairing is the defect: `text-on-surface` is a *surface*
 * token — it tracks the page (dark text on light surfaces, light text on dark
 * ones), which is right for its own name and wrong as an on-*fill* color for a
 * swatch that never darkens. The two faces:
 *
 * (1) `warning/dark/*` in all six themes (1.51–2.80:1, i.e. also under the 3:1
 *     UI floor). In dark mode `text-on-surface` flips to neutral-100 — light
 *     text on a light amber fill. Making `--color-text-on-primary` mode-aware
 *     (2026-07-14, below) fixed the other six intents but could not reach this
 *     one: warning does not use that token. The fix is to give warning an
 *     on-color that does NOT track the surface — either its own token, or
 *     repointing the variants at `text-on-dark`, which is already dark-on-
 *     light-fill by construction. That touches the component variants, not
 *     just the token layer.
 *
 * (2) `warning/light/active` in all six themes (3.89–4.05:1). Warning's ramp
 *     is deliberately inverted, so its press state getting *darker* moves it
 *     *toward* its dark foreground. Fixing it means deciding which way
 *     warning's press state should travel.
 *
 * Both are escalations awaiting a design decision, NOT excuses. Any
 * combination that starts or stops failing fails the suite — see
 * `the AA shortfalls are exactly as documented`.
 *
 * History: until 2026-07-14 this block also carried EVERY dark-mode filled
 * intent — 125 of 126 combinations, bottoming out at 1.51:1 — because
 * `--color-text-on-primary` was unconditional white while the intent fills
 * resolve to their *lighter* -400/-500 shades in dark mode. Making that token
 * mode-aware (plus one companion nudge to the neutral theme's grey primary)
 * cleared 107 of those 125 and moved them into the AA gate below. It also
 * unmasked face (1): warning's dark shortfall used to hide inside the blanket
 * dark-mode failure, and is now the only thing left in it.
 */
function isKnownShortfall(id: string): boolean {
  // (1) warning's surface-tracking on-color, whole dark ramp.
  if (id.includes('/warning/dark/')) return true;
  // (2) warning's inverted ramp, light press state only.
  return id.endsWith('/warning/light/active');
}

describe('color math — validated against known references', () => {
  // If these drift, every ratio below is meaningless.
  it.each([
    ['white', { l: 1, c: 0, h: 0 }, [255, 255, 255]],
    ['black', { l: 0, c: 0, h: 0 }, [0, 0, 0]],
    ['sRGB red', { l: 0.62796, c: 0.25768, h: 29.234 }, [255, 0, 0]],
    ['sRGB green', { l: 0.86644, c: 0.29483, h: 142.495 }, [0, 255, 0]],
    ['sRGB blue', { l: 0.45201, c: 0.31321, h: 264.052 }, [0, 0, 255]],
    ['sRGB cyan', { l: 0.9054, c: 0.15455, h: 194.769 }, [0, 255, 255]],
    ['sRGB magenta', { l: 0.7017, c: 0.32249, h: 328.363 }, [255, 0, 255]],
    ['sRGB yellow', { l: 0.96798, c: 0.21101, h: 109.769 }, [255, 255, 0]],
    ['mid grey #808080', { l: 0.59987, c: 0, h: 0 }, [128, 128, 128]]
  ] as [string, Oklch, Rgb][])('OKLCH → sRGB: %s', (_name, oklch, expected) => {
    expect(oklchToRgb(oklch)).toEqual(expected);
  });

  it('black on white is exactly 21:1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 10);
  });

  it('white on white is exactly 1:1', () => {
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 10);
  });

  it('is symmetric in its arguments', () => {
    expect(contrastRatio([18, 52, 86], [200, 190, 180])).toBeCloseTo(
      contrastRatio([200, 190, 180], [18, 52, 86]),
      10
    );
  });

  // The canonical WCAG boundary pair: #767676 is the lightest grey that
  // still clears AA on white, #777777 is the first that does not.
  it('reproduces the #767676 / #777777 AA boundary on white', () => {
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });
});

describe('CSS token graph — resolver', () => {
  const css = stylesheetFor('default');

  it('resolves a plain var() chain to the foundation ramp', () => {
    // --color-primary → light-dark(primary-600, primary-500)
    expect(resolveToken(css, '--color-primary', 'light')).toEqual({ l: 0.52, c: 0.15, h: 240 });
    expect(resolveToken(css, '--color-primary', 'dark')).toEqual({ l: 0.58, c: 0.15, h: 240 });
  });

  it('resolves the oklch(from …) relative-color syntax of the neutral intent', () => {
    // warm-neutral-500 is oklch(0.5 0.008 45), re-hued to --neutral-chrome-hue (240).
    expect(resolveToken(css, '--color-neutral', 'light')).toEqual({ l: 0.5, c: 0.008, h: 240 });
  });

  it('picks the theme override over the foundation ramp', () => {
    // ocean re-points the info ramp from hue 220 to 255.
    expect(resolveToken(stylesheetFor('ocean'), '--color-info', 'light').h).toBe(255);
    expect(resolveToken(css, '--color-info', 'light').h).toBe(220);
  });

  it('does not confuse --color-primary with --color-primary-500', () => {
    expect(readDecl(css, '--color-primary')).toContain('light-dark');
    expect(readDecl(css, '--color-primary-500')).toBe('oklch(0.58 0.15 240)');
  });

  it('fails loudly on an unknown token rather than defaulting', () => {
    expect(() => resolveToken(css, '--color-does-not-exist', 'light')).toThrow(/not declared/);
  });

  it('ignores the @media (prefers-contrast: more) overrides', () => {
    // Regression guard: semantic.css re-declares --color-secondary and
    // --color-neutral inside that block. Reading the last declaration
    // blindly made light and dark resolve to the same high-contrast shade.
    expect(resolveToken(css, '--color-secondary', 'light')).toEqual({ l: 0.55, c: 0.12, h: 280 });
    expect(resolveToken(css, '--color-secondary', 'dark')).toEqual({ l: 0.66, c: 0.13, h: 280 });
    expect(resolveToken(css, '--color-neutral', 'light')).not.toEqual(
      resolveToken(css, '--color-neutral', 'dark')
    );
  });

  it('still sees the high-contrast block in the raw file (guard is meaningful)', () => {
    expect(read('./semantic.css')).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
  });
});

describe('foreground pairing matches the component variants', () => {
  // Re-derive INTENT_FOREGROUND from the markup so the table cannot drift.
  const variantSources = [
    '../primitives/Button/button.variants.ts',
    '../primitives/Badge/badge.variants.ts',
    '../primitives/Alert/alert.variants.ts',
    '../primitives/Tooltip/tooltip.variants.ts'
  ]
    .map((file) => read(file))
    .join('\n');

  it.each(INTENTS)('bg-%s pairs with exactly one on-color', (intent) => {
    // Stay inside one class string: stop at any quote that could end it.
    // (The backtick is spelled via charCode — vite's oxc transform mis-lexes
    // a literal backtick inside a single-quoted string.)
    const notQuote = `[^'"${String.fromCharCode(96)}]`;
    const re = new RegExp(
      `bg-${intent}(?![\\w-])${notQuote}*?text-text-(on-primary|on-surface)`,
      'g'
    );
    const found = new Set([...variantSources.matchAll(re)].map((m) => `--color-text-${m[1]}`));
    // Intents absent from these four components are covered by the others.
    if (found.size === 0) return;
    expect([...found]).toEqual([INTENT_FOREGROUND[intent]]);
  });
});

describe('filled intent surfaces — WCAG contrast', () => {
  const measured: Record<string, number> = {};

  for (const theme of ['default', ...THEMES] as Theme[]) {
    const css = stylesheetFor(theme);
    for (const intent of INTENTS) {
      for (const mode of MODES) {
        for (const state of STATE_NAMES) {
          const id = key(theme, intent, mode, state);
          const bg = resolveToken(css, STATES[state](intent), mode);
          const fg = resolveToken(css, INTENT_FOREGROUND[intent], mode);
          measured[id] = round2(ratioOf(bg, fg));
        }
      }
    }
  }

  const ids = Object.keys(measured);

  it('covers every theme × intent × mode × state combination', () => {
    expect(ids).toHaveLength(6 * 7 * 2 * 3);
    expect(ids).toContain('default/primary/light/base');
    expect(ids).toContain('ocean/info/dark/active');
  });

  describe('meets WCAG AA (4.5:1) for normal text', () => {
    it.each(ids.filter((id) => !isKnownShortfall(id)))('%s', (id) => {
      expect(
        measured[id],
        `${id} measures ${measured[id]}:1, below AA ${AA_NORMAL}:1`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('clears the 3:1 UI-component floor (WCAG 1.4.11)', () => {
    it.each(ids.filter((id) => !isKnownShortfall(id)))('%s', (id) => {
      expect(measured[id], `${id} measures ${measured[id]}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  it('the AA shortfalls are exactly as documented', () => {
    // Fail-loud in BOTH directions: a new failure is a regression, and a
    // shortfall that starts passing means an escalation landed and the
    // KNOWN SHORTFALLS block above is now lying.
    const failing = ids.filter((id) => measured[id] < AA_NORMAL).sort();
    const documented = ids.filter(isKnownShortfall).sort();

    const undocumented = failing.filter((id) => !documented.includes(id));
    const noLongerFailing = documented.filter((id) => !failing.includes(id));

    expect(
      undocumented,
      `NEW contrast regressions (below AA, not in KNOWN SHORTFALLS):\n` +
        undocumented.map((id) => `  ${id} = ${measured[id]}:1`).join('\n')
    ).toEqual([]);
    expect(
      noLongerFailing,
      `These now meet AA — update the KNOWN SHORTFALLS block, the escalation landed:\n` +
        noLongerFailing.map((id) => `  ${id} = ${measured[id]}:1`).join('\n')
    ).toEqual([]);
  });

  it('light mode is fully AA-clean apart from warning press states', () => {
    // The headline guarantee the library can make today.
    const lightFailures = ids.filter((id) => id.includes('/light/') && measured[id] < AA_NORMAL);
    expect(lightFailures.sort()).toEqual(
      ['default', ...THEMES].map((t) => `${t}/warning/light/active`).sort()
    );
  });

  describe('dark mode — the mode-aware on-color contract', () => {
    it('--color-text-on-primary is mode-aware: white on light fills, dark on light-in-dark fills', () => {
      // THE load-bearing assertion. Every dark-mode AA pass in the table above
      // depends on it: reverting this token to unconditional white (its state
      // before 2026-07-14) puts all 108 non-warning dark fills back under AA.
      // Asserted on the RESOLVED values, not the source text, so it holds
      // however the branch is spelled — and fails the moment the two modes
      // collapse back onto one color.
      const css = stylesheetFor('default');
      const light = resolveToken(css, '--color-text-on-primary', 'light');
      const dark = resolveToken(css, '--color-text-on-primary', 'dark');

      expect(
        light,
        'text-on-primary is no longer mode-aware — the dark-mode fills lost their AA'
      ).not.toEqual(dark);
      expect(light).toEqual(resolveToken(css, '--color-neutral-0', 'light'));
      expect(dark).toEqual(resolveToken(css, '--color-neutral-900', 'dark'));
    });

    it('text-on-primary and text-on-dark carry the same value but are NOT aliased', () => {
      // They agree today because both pair text with a fill that flips
      // lightness with the mode. They are still two tokens, declared
      // independently, so a consumer can retheme either without dragging the
      // other: text-on-dark answers to the avatar identity palette (one fixed
      // lightness per mode), text-on-primary to the theme-tuned intent ramps.
      // See the rationale at semantic.css.
      const css = stylesheetFor('default');
      for (const mode of MODES) {
        expect(resolveToken(css, '--color-text-on-primary', mode)).toEqual(
          resolveToken(css, '--color-text-on-dark', mode)
        );
      }
      expect(
        readDecl(css, '--color-text-on-primary'),
        'text-on-primary was aliased to text-on-dark — that couples two independent override surfaces'
      ).not.toContain('--color-text-on-dark');
      expect(readDecl(css, '--color-text-on-dark')).not.toContain('--color-text-on-primary');
    });

    it('dark-mode press states now IMPROVE legibility instead of destroying it', () => {
      // The inverse of the pre-2026-07-14 behaviour: dark-mode fills step
      // LIGHTER on hover/active, so with a dark on-color the label gets
      // easier to read as it is pressed, matching light mode's direction.
      expect(measured['default/primary/dark/active']).toBeGreaterThan(
        measured['default/primary/dark/hover']
      );
      expect(measured['default/primary/dark/hover']).toBeGreaterThan(
        measured['default/primary/dark/base']
      );
    });

    /**
     * Counterfactual: the pre-2026-07-14 pairing, white on every dark fill.
     * Measures what the mode-aware branch is actually buying, so the reason
     * for it cannot decay into folklore.
     */
    const whiteOnDarkFills = () => {
      const out: Record<string, number> = {};
      for (const theme of ['default', ...THEMES] as Theme[]) {
        const css = stylesheetFor(theme);
        const white = resolveToken(css, '--color-neutral-0', 'light');
        for (const intent of INTENTS) {
          // Only the intents text-on-primary actually governs; warning pairs
          // with text-on-surface and was never affected either way.
          if (INTENT_FOREGROUND[intent] !== '--color-text-on-primary') continue;
          for (const state of STATE_NAMES) {
            const bg = resolveToken(css, STATES[state](intent), 'dark');
            out[key(theme, intent, 'dark', state)] = round2(ratioOf(bg, white));
          }
        }
      }
      return out;
    };

    it('unconditional white would fail EVERY one of the 108 fills this token governs', () => {
      // Before the companion nudge, neutral/primary/dark/base was the lone
      // combination white still served (5.26:1). Lifting that grey to L 0.58
      // removed the last one: there is now no dark-mode intent fill for which
      // white is a legal label, i.e. the mode-aware branch is load-bearing
      // everywhere, not a majority-rules compromise.
      const white = whiteOnDarkFills();
      const governed = Object.keys(white);
      expect(governed).toHaveLength(6 * 6 * 3);
      expect(governed.filter((id) => white[id] >= AA_NORMAL)).toEqual([]);
    });

    it('proves a per-mode on-color is unavoidable: no grey satisfies both', () => {
      // The neutral theme's primary is a near-achromatic mid grey — the worst
      // case, because it is the fill closest to the midpoint between the two
      // on-colors. There is no lightness at which BOTH white and the dark
      // on-color clear AA, which is why the on-color has to be mode-aware
      // rather than the ramps being nudged onto a single foreground.
      const css = stylesheetFor('default');
      const grey = (l: number) => ({ l, c: 0.012, h: 240 });
      const white = resolveToken(css, '--color-neutral-0', 'light');
      const onDark = resolveToken(css, '--color-text-on-primary', 'dark');

      const satisfiesBoth: number[] = [];
      for (let l = 0; l <= 1.0001; l += 0.005) {
        if (ratioOf(grey(l), white) >= AA_NORMAL && ratioOf(grey(l), onDark) >= AA_NORMAL) {
          satisfiesBoth.push(round2(l));
        }
      }
      expect(
        satisfiesBoth,
        'a single on-color would suffice after all — re-open the analysis'
      ).toEqual([]);
    });

    it('the companion: the neutral theme grey primary sits at the lowest step that clears AA', () => {
      // The one fill the mode-aware on-color regressed (5.26:1 on white →
      // 3.74:1 on neutral-900), lifted from L 0.53 to 0.58. 0.58 is minimal on
      // the 0.01 grid this ramp is authored on — 0.57 measures 4.40:1. The
      // true crossing is L 0.574 (4.50:1), which would ship zero margin.
      const css = stylesheetFor('neutral');
      const onDark = resolveToken(css, '--color-text-on-primary', 'dark');
      expect(resolveToken(css, '--color-primary-500', 'dark').l).toBe(0.58);
      expect(measured['neutral/primary/dark/base']).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(ratioOf({ l: 0.57, c: 0.012, h: 240 }, onDark)).toBeLessThan(AA_NORMAL);
    });

    it('warning is the sole holdout because it pairs with a SURFACE token', () => {
      // The mechanism behind the remaining 18 shortfalls, isolated so the
      // KNOWN SHORTFALLS block cannot go stale. text-on-surface tracks the
      // page — light text in dark mode — which is correct for its own name and
      // wrong for warning, whose fill is a light amber in BOTH modes.
      expect(INTENT_FOREGROUND.warning).toBe('--color-text-on-surface');
      const css = stylesheetFor('default');
      expect(resolveToken(css, '--color-text-on-surface', 'dark')).toEqual(
        resolveToken(css, '--color-neutral-100', 'dark')
      );
      // Every other intent takes the mode-aware fill on-color.
      const surfacePaired = INTENTS.filter(
        (i) => INTENT_FOREGROUND[i] === '--color-text-on-surface'
      );
      expect(surfacePaired).toEqual(['warning']);
    });
  });
});
