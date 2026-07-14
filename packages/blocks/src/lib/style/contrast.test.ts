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
 * Combinations that do NOT meet AA today. Both are escalations awaiting a
 * design decision, NOT excuses — and both are structural, which is why this
 * is a predicate rather than a list of magic numbers: the shape of the
 * failure is the finding.
 *
 * (1) EVERY dark-mode filled intent (125 of 126 combinations, 1.5–4.1:1).
 *     One root cause: `--color-text-on-primary` is `var(--color-neutral-0)`
 *     — white, unconditionally, with no `light-dark()` branch — while every
 *     `--color-<intent>` resolves to the *lighter* -400 shade in dark mode,
 *     and hover/active step lighter still (so pressing a dark-mode button
 *     makes its label *less* readable, bottoming out at 1.51:1).
 *     The remedy is to pair dark-mode fills with a dark on-color (the
 *     Material-3 `onPrimary` pattern). The shape already exists one line
 *     above it in semantic.css — `--color-text-on-dark` is exactly
 *     `light-dark(var(--color-neutral-0), var(--color-neutral-900))`; the
 *     bug is that `text-on-primary` never grew the same branch. The tests
 *     below measure that remedy: it clears AA for 125 of 126 and needs one
 *     companion change. It is NOT applied here because it repaints the label
 *     of every filled Button/Badge/Alert/Tooltip/Stepper/Checkbox in dark
 *     mode: a design decision for a human, not a token nudge.
 *     The lone exception, `neutral/primary/dark/base`, only passes because
 *     the neutral *theme* desaturates primary to a dark grey (5.26:1) — and
 *     it is precisely the one the remedy would regress (see below).
 *
 * (2) `warning/light/active` in all six themes (3.89–4.05:1). Warning's ramp
 *     is deliberately inverted — it is the one intent paired with dark text,
 *     so its press state getting *darker* moves it *toward* its foreground.
 *     Fixing it means deciding which way warning's press state should travel,
 *     which is a design call, not a lightness nudge.
 *
 * Escalated 2026-07-14 (audit D.1). Any combination that starts or stops
 * failing fails the suite — see `the AA shortfalls are exactly as documented`.
 */
function isKnownShortfall(id: string): boolean {
  // (1) dark mode — the neutral theme's grey primary is the one that clears AA.
  if (id.includes('/dark/')) return id !== 'neutral/primary/dark/base';
  // (2) warning's inverted ramp, press state only.
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

  describe('dark mode — the escalation, and the proposed remedy', () => {
    it('root cause: --color-text-on-primary is not mode-aware', () => {
      // The single reason all 125 dark-mode shortfalls exist. When this
      // grows a light-dark() branch, this test fails — by design: that is
      // the signal to re-measure and shrink KNOWN SHORTFALLS.
      const raw = readDecl(stylesheetFor('default'), '--color-text-on-primary');
      expect(raw, 'text-on-primary gained a light-dark() branch — re-run the dark-mode audit').toBe(
        'var(--color-neutral-0)'
      );
    });

    it('the sibling on-color token already has the shape text-on-primary needs', () => {
      // --color-text-on-dark demonstrates the fix in the very same file:
      // white in light mode, neutral-900 in dark. text-on-primary just never
      // grew that branch. Asserted so the recommendation cannot go stale.
      const css = stylesheetFor('default');
      expect(resolveToken(css, '--color-text-on-dark', 'light')).toEqual(
        resolveToken(css, '--color-text-on-primary', 'light')
      );
      expect(resolveToken(css, '--color-text-on-dark', 'dark')).not.toEqual(
        resolveToken(css, '--color-text-on-primary', 'dark')
      );
      // …and its dark branch is exactly the on-color the remedy needs.
      expect(resolveToken(css, '--color-text-on-dark', 'dark')).toEqual(
        resolveToken(css, '--color-text-on-surface', 'light')
      );
    });

    it('dark-mode fills get LIGHTER on hover/active, so pressing hurts legibility', () => {
      // Documents the counter-intuitive direction that makes the bug worse.
      expect(measured['default/primary/dark/base']).toBeGreaterThan(
        measured['default/primary/dark/hover']
      );
      expect(measured['default/primary/dark/hover']).toBeGreaterThan(
        measured['default/primary/dark/active']
      );
    });

    /** The remedy under evaluation: give text-on-primary a dark branch. */
    const remedyRatios = () => {
      const out: Record<string, number> = {};
      for (const theme of ['default', ...THEMES] as Theme[]) {
        const css = stylesheetFor(theme);
        for (const intent of INTENTS) {
          for (const state of STATE_NAMES) {
            const bg = resolveToken(css, STATES[state](intent), 'dark');
            // text-on-surface's LIGHT branch *is* the dark on-color (neutral-900).
            const fg = resolveToken(css, '--color-text-on-surface', 'light');
            out[key(theme, intent, 'dark', state)] = round2(ratioOf(bg, fg));
          }
        }
      }
      return out;
    };

    it('proposed remedy clears AA for 125 of 126 dark fills', () => {
      // Proof for the escalated design decision: swapping the dark branch of
      // text-on-primary to the dark on-color fixes every dark-mode
      // combination in every theme — except one, asserted below.
      const remedy = remedyRatios();
      const failures = Object.keys(remedy).filter((id) => remedy[id] < AA_NORMAL);
      expect(failures).toEqual(['neutral/primary/dark/base']);
      expect(Object.keys(remedy).filter((id) => remedy[id] >= AA_NORMAL)).toHaveLength(125);
    });

    it('the remedy needs one companion change: the neutral theme grey primary', () => {
      // neutral/primary/dark/base is the single combination that passes today
      // (5.26:1 on white) and would regress under the remedy (3.74:1).
      const remedy = remedyRatios();
      expect(measured['neutral/primary/dark/base']).toBeCloseTo(5.26, 2);
      expect(remedy['neutral/primary/dark/base']).toBeCloseTo(3.74, 2);
    });

    it('proves a per-mode on-color is unavoidable: no grey satisfies both', () => {
      // The neutral theme's primary is a near-achromatic mid grey. There is no
      // lightness at which BOTH white and the dark on-color clear AA — which is
      // exactly why the on-color has to become mode-aware rather than the ramps
      // being nudged. (Its dark fill would need L >= ~0.58 to take dark text.)
      const grey = (l: number) => ({ l, c: 0.012, h: 240 });
      const white = resolveToken(stylesheetFor('default'), '--color-text-on-primary', 'dark');
      const onDark = resolveToken(stylesheetFor('default'), '--color-text-on-surface', 'light');

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
  });
});
