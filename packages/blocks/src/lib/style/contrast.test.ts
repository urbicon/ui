import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

/** Every regex metacharacter, not just the `-` a token name happens to contain. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

/** Grab a custom property's raw value, paren-aware. Last declaration wins. */
function readDecl(css: string, name: string): string | null {
  const re = new RegExp(`${escapeRegExp(name)}\\s*:\\s*`, 'g');
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

  // Lightness may be a fraction (`0.52`, how this repo writes it) or a
  // percentage (`52%`, how Tailwind's own palette writes it). CSS treats them as
  // the same value, so the parser has to as well — a table intent resolving
  // through `--color-cyan-700` reaches the percent form.
  const literal = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (literal) {
    const l = +literal[1];
    return { l: literal[2] === '%' ? l / 100 : l, c: +literal[3], h: +literal[4] };
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
  // `primary` keeps its own token so a theme can repaint the primary label alone;
  // every other solid fill pairs with the shared `--color-text-on-fill`. Both
  // resolve to the same value by default (on-primary is defined as var(on-fill)),
  // so the measured ratios are identical — the split is about which lever moves
  // what, not about two different colours. See semantic.css.
  primary: '--color-text-on-primary',
  secondary: '--color-text-on-fill',
  neutral: '--color-text-on-fill',
  success: '--color-text-on-fill',
  warning: '--color-text-on-warning',
  danger: '--color-text-on-fill',
  info: '--color-text-on-fill'
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
 * === SHORTFALL LEDGER: EMPTY ===
 *
 * Every theme × intent × mode × state combination meets AA. This block used
 * to be a predicate over the known failures; keep the history so the ledger's
 * emptiness stays a *claim about work done*, not an assumption:
 *
 * - Until 2026-07-14 it carried EVERY dark-mode filled intent — 125 of 126
 *   combinations, bottoming out at 1.51:1 — because `--color-text-on-primary`
 *   was unconditional white while the intent fills resolve to their *lighter*
 *   -400/-500 shades in dark mode. Making that token mode-aware (plus a
 *   companion nudge to the neutral theme's grey primary) cleared 107 of them.
 *
 * - Until 2026-07-20 the remaining 24 were all `warning`, which paired with
 *   `--color-text-on-surface` — a *surface* token that flips light in dark
 *   mode while warning's fill is a light amber in BOTH modes. That put
 *   `warning/dark/*` at 1.51–2.80:1 (under even the 3:1 UI floor) and
 *   `warning/light/active` at 3.90–4.05:1. Cleared by `--color-text-on-warning`
 *   (a deliberately non-mode-aware warm dark = warning-950) plus lifting the
 *   warning-700 press stop from L 0.55 to 0.59 — see the dark-mode describe
 *   block below, which pins both mechanisms.
 *
 * Any combination that falls below AA now fails the suite in two places: its
 * own `it.each` case and the aggregate `the shortfall ledger stays empty`.
 */

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
  //
  // The sources are DISCOVERED (every `*.variants.ts` in blocks plus the
  // table package's), not a hardcoded list: the original four-file list
  // silently missed 5 of the 9 files wired in 00d046d (Checkbox, Stepper,
  // Select, Tab, Calendar — plus table-states/-features next door), so a
  // revert there would not have failed this suite. A glob keeps the NEXT
  // wired component inside the guard by construction. Files without a
  // filled-bg/on-color pairing contribute no matches and cost nothing.
  function findVariantFiles(dir: string): string[] {
    return readdirSync(dir, { recursive: true })
      .map(String)
      .filter((p) => p.endsWith('.variants.ts'))
      .map((p) => resolve(dir, p))
      .sort();
  }

  const variantFiles = [
    ...findVariantFiles(resolve(STYLE_DIR, '..')),
    // The table package wires the same on-color vocabulary (00d046d); its
    // variants live one package over, pinned by the workspace layout.
    ...findVariantFiles(resolve(STYLE_DIR, '../../../../table/src/lib'))
  ];

  it('discovers the variant sources (glob sanity: blocks + table, incl. the original four)', () => {
    // Lower bound only — the point of discovery is that additions join
    // automatically. The four originally scanned files must be among them.
    expect(variantFiles.length).toBeGreaterThanOrEqual(40);
    for (const name of [
      'button.variants.ts',
      'badge.variants.ts',
      'alert.variants.ts',
      'tooltip.variants.ts',
      'table-states.variants.ts'
    ]) {
      expect(
        variantFiles.some((f) => f.endsWith(name)),
        `${name} discovered`
      ).toBe(true);
    }
  });

  const variantSources = variantFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

  it.each(INTENTS)('bg-%s pairs with exactly one on-color', (intent) => {
    // Stay inside one class string: stop at any quote that could end it.
    // (The backtick is spelled via charCode — vite's oxc transform mis-lexes
    // a literal backtick inside a single-quoted string.)
    const notQuote = `[^'"${String.fromCharCode(96)}]`;
    const re = new RegExp(
      `bg-${intent}(?![\\w-])${notQuote}*?text-text-(on-fill|on-primary|on-surface|on-warning)`,
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
    it.each(ids)('%s', (id) => {
      expect(
        measured[id],
        `${id} measures ${measured[id]}:1, below AA ${AA_NORMAL}:1`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('clears the 3:1 UI-component floor (WCAG 1.4.11)', () => {
    it.each(ids)('%s', (id) => {
      expect(measured[id], `${id} measures ${measured[id]}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  it('the shortfall ledger stays empty — every combination meets AA', () => {
    // The headline guarantee, aggregated: one failure message listing every
    // regression at once instead of 126 scattered it.each cases. See the
    // SHORTFALL LEDGER block above for what it took to get here.
    const failing = ids.filter((id) => measured[id] < AA_NORMAL).sort();
    expect(
      failing,
      `Contrast regressions (below AA ${AA_NORMAL}:1):\n` +
        failing.map((id) => `  ${id} = ${measured[id]}:1`).join('\n')
    ).toEqual([]);
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
          // Only the intents the mode-aware on-color governs. Since 2026-07-31
          // that is two token names for one value — `--color-text-on-fill` (the
          // shared one) and `--color-text-on-primary` (defined as var(on-fill),
          // kept so a theme can move the primary label alone). `warning` pairs
          // with its own non-mode-aware text-on-warning and was never affected.
          const fg = INTENT_FOREGROUND[intent];
          if (fg !== '--color-text-on-fill' && fg !== '--color-text-on-primary') continue;
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

    it('--color-text-on-warning is deliberately NOT mode-aware, and rides the warning ramp', () => {
      // Warning is the one intent whose fill is light in BOTH modes, so its
      // on-color is dark in both — the deliberate opposite of the mode-aware
      // text-on-primary above. Asserted on the RESOLVED values: the token
      // must collapse to one color across modes (its whole point), and that
      // color is the ramp's own 950 stop, so theme re-hues flow through
      // (forest 60, sunset 92) instead of a fixed neutral soot.
      for (const theme of ['default', ...THEMES] as Theme[]) {
        const css = stylesheetFor(theme);
        const light = resolveToken(css, '--color-text-on-warning', 'light');
        const dark = resolveToken(css, '--color-text-on-warning', 'dark');
        expect(
          light,
          `${theme}: text-on-warning went mode-aware — its fill never flips, so neither may it`
        ).toEqual(dark);
        expect(light).toEqual(resolveToken(css, '--color-warning-950', 'light'));
      }
      // And warning is the only intent on this token.
      expect(INTENTS.filter((i) => INTENT_FOREGROUND[i] === '--color-text-on-warning')).toEqual([
        'warning'
      ]);
    });

    it('counterfactual: the old text-on-surface pairing fails every dark warning fill', () => {
      // What the dedicated on-color bought (pre-2026-07-20 pairing): in dark
      // mode text-on-surface flips to light text on warning's light amber —
      // 1.51–2.80:1, under even the 3:1 UI floor. Measured so the reason for
      // the token cannot decay into folklore.
      for (const theme of ['default', ...THEMES] as Theme[]) {
        const css = stylesheetFor(theme);
        const onSurface = resolveToken(css, '--color-text-on-surface', 'dark');
        for (const state of STATE_NAMES) {
          const bg = resolveToken(css, STATES[state]('warning'), 'dark');
          expect(ratioOf(bg, onSurface)).toBeLessThan(AA_LARGE);
        }
      }
    });

    it('the companion: warning-700 sits at the lowest press-stop step that clears AA', () => {
      // warning/light/active is the fill the on-color alone could not save:
      // warning's ramp is inverted, so pressing moves TOWARD the dark label.
      // At the ramp's original L 0.55 the press state measured 3.90–4.05:1;
      // lifting the stop to 0.59 is minimal on the 0.01 grid the ramps are
      // authored on — 0.58 still fails for forest's hue 60 (4.46:1).
      const forest = stylesheetFor('forest');
      const onWarning = resolveToken(forest, '--color-text-on-warning', 'light');
      expect(resolveToken(stylesheetFor('default'), '--color-warning-700', 'light').l).toBe(0.59);
      expect(resolveToken(forest, '--color-warning-700', 'light').l).toBe(0.59);
      for (const theme of ['default', ...THEMES] as Theme[]) {
        expect(measured[key(theme, 'warning', 'light', 'active')]).toBeGreaterThanOrEqual(
          AA_NORMAL
        );
      }
      expect(ratioOf({ l: 0.58, c: 0.13, h: 60 }, onWarning)).toBeLessThan(AA_NORMAL);
      expect(ratioOf({ l: 0.55, c: 0.13, h: 60 }, onWarning)).toBeLessThan(AA_NORMAL);
    });

    it("warning's press direction is preserved: light darkens toward the label, dark lightens away", () => {
      // The 2026-07-20 decision kept the inverted ramp: pressing in light
      // mode still darkens (0.75 → 0.65 → 0.59), so contrast falls but stays
      // above AA; in dark mode pressing lightens, so contrast improves —
      // matching every other intent's post-2026-07-14 behaviour.
      expect(measured['default/warning/light/base']).toBeGreaterThan(
        measured['default/warning/light/hover']
      );
      expect(measured['default/warning/light/hover']).toBeGreaterThan(
        measured['default/warning/light/active']
      );
      expect(measured['default/warning/dark/active']).toBeGreaterThan(
        measured['default/warning/dark/hover']
      );
      expect(measured['default/warning/dark/hover']).toBeGreaterThan(
        measured['default/warning/dark/base']
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Informative text on the reading surfaces
// ---------------------------------------------------------------------------

/**
 * The second half of the contrast contract: not the filled intent fills above,
 * but plain informative text on the calm surfaces it sits on. This is the axis
 * the pre-2026-07-24 suite did NOT cover — the docs Rooms skin's tertiary/
 * quaternary AA misses lived entirely off it (see docs/technical-debt.md).
 *
 * Reading surfaces only — base/quiet/elevated/overlay/subtle, the grounds body
 * text actually sits on. Interactive/hover/active/selected surfaces are transient
 * states (a label on a pressed segment is momentary), covered by the 3:1 UI floor
 * elsewhere, and deliberately excluded from the 4.5 text contract.
 */
describe('informative text on reading surfaces — WCAG contrast', () => {
  const READING_SURFACES = ['base', 'quiet', 'elevated', 'overlay', 'subtle'] as const;
  const surfaceToken = (s: string) => `--color-surface-${s}`;

  // primary/secondary/tertiary are the informative ramp: each MUST clear AA 4.5
  // on every reading surface, in both modes, in every theme.
  const INFORMATIVE = [
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-tertiary'
  ] as const;

  const measured: Record<string, number> = {};
  for (const theme of ['default', ...THEMES] as Theme[]) {
    const css = stylesheetFor(theme);
    for (const token of INFORMATIVE) {
      for (const mode of MODES) {
        for (const surface of READING_SURFACES) {
          const id = `${theme}/${token.replace('--color-text-', '')}/${mode}/${surface}`;
          const fg = resolveToken(css, token, mode);
          const bg = resolveToken(css, surfaceToken(surface), mode);
          measured[id] = round2(ratioOf(bg, fg));
        }
      }
    }
  }
  const ids = Object.keys(measured);

  it('covers primary/secondary/tertiary × reading surface × mode × theme', () => {
    expect(ids).toHaveLength(6 * 3 * 2 * 5);
    expect(ids).toContain('default/tertiary/light/subtle');
  });

  describe('meets WCAG AA (4.5:1) for normal text', () => {
    it.each(ids)('%s', (id) => {
      expect(
        measured[id],
        `${id} measures ${measured[id]}:1, below AA ${AA_NORMAL}:1`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  it('the informative-text ledger stays empty — every combination meets AA', () => {
    const failing = ids.filter((id) => measured[id] < AA_NORMAL).sort();
    expect(
      failing,
      `Informative-text contrast regressions (below AA ${AA_NORMAL}:1):\n` +
        failing.map((id) => `  ${id} = ${measured[id]}:1`).join('\n')
    ).toEqual([]);
  });

  /**
   * quaternary is a MARK token, not body text (placeholders, dense-grid marks,
   * disabled glyphs, decoration — see semantic.css). It is held to the 3:1 UI
   * floor on reading surfaces, NOT the 4.5 text floor: it sits at the AA edge on
   * calm surfaces (4.58–4.85 light) and drops below it on interactive/pressed
   * surfaces and hard below it under the docs Rooms skin. This block pins that
   * contract — a regression that pushes quaternary below 3:1 (unusable even as a
   * mark) fails; using it for body text is a review concern, not a token defect.
   */
  describe('quaternary is a mark token — clears the 3:1 UI floor, not the 4.5 text floor', () => {
    const quat: Record<string, number> = {};
    for (const theme of ['default', ...THEMES] as Theme[]) {
      const css = stylesheetFor(theme);
      for (const mode of MODES) {
        for (const surface of READING_SURFACES) {
          const id = `${theme}/quaternary/${mode}/${surface}`;
          quat[id] = round2(
            ratioOf(
              resolveToken(css, surfaceToken(surface), mode),
              resolveToken(css, '--color-text-quaternary', mode)
            )
          );
        }
      }
    }
    it('covers quaternary × reading surface × mode × theme (loop is not empty)', () => {
      expect(Object.keys(quat)).toHaveLength(6 * 2 * 5);
      expect(quat).toHaveProperty('default/quaternary/light/subtle');
    });

    it.each(Object.keys(quat))('%s clears 3:1', (id) => {
      expect(quat[id], `${id} measures ${quat[id]}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  /**
   * Disabled text is held to the same 3:1 UI floor. WCAG 1.4.3 exempts inactive
   * controls, so this is a house rule rather than a conformance one — but a
   * disabled field's LABEL is the part that still has to say what the field is,
   * and the token used to sit at roughly 1.5:1 (light) / 2:1 (dark), i.e.
   * invisible rather than muted. Nothing caught it: the dark-axe gate only ever
   * saw it on PinInput, because axe honours the exemption wherever a
   * `<label for>` points at a disabled control.
   *
   * SCOPE, deliberately: the reading surfaces plus the disabled fill — the
   * backgrounds a disabled control actually renders on. The interaction surfaces
   * (`interactive`, `interactive-hover`, `hover`, `active`) are excluded because
   * a disabled control does not reach them; several would fail if measured, so
   * this is an exclusion to revisit if a disabled element ever paints one.
   *
   * And it measures the TOKEN, not the composition. A component that stacks
   * `opacity-*` on top (Calendar's disabled day does) lands far below what this
   * asserts — see the technical-debt entry.
   */
  describe('disabled text stays legible — clears the 3:1 UI floor', () => {
    const disabled: Record<string, number> = {};
    for (const theme of ['default', ...THEMES] as Theme[]) {
      const css = stylesheetFor(theme);
      for (const mode of MODES) {
        for (const surface of [...READING_SURFACES, 'disabled'] as const) {
          const id = `${theme}/disabled-text/${mode}/${surface}`;
          disabled[id] = round2(
            ratioOf(
              resolveToken(css, surfaceToken(surface), mode),
              resolveToken(css, '--color-text-disabled', mode)
            )
          );
        }
      }
    }

    it('covers disabled text × surface (incl. the disabled fill) × mode × theme', () => {
      expect(Object.keys(disabled)).toHaveLength(6 * 2 * 6);
      expect(disabled).toHaveProperty('default/disabled-text/dark/disabled');
    });

    it.each(Object.keys(disabled))('%s clears 3:1', (id) => {
      expect(disabled[id], `${id} measures ${disabled[id]}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  /**
   * The intent colours used AS TEXT — the axis neither half above covered.
   * The filled-surface block asserts `text-on-fill` ON `bg-danger`; the
   * informative block asserts the ink ramp on calm grounds. Between them sat
   * the most common thing an intent colour actually does: `text-danger` on a
   * form, `text-primary` on the active nav link — found not by reading tokens
   * but by measuring a rendered page (the docs table-of-contents' active
   * entry: 4.08:1, dark, surface-elevated, every gate green).
   *
   * First measurement of the axis (2026-08-11) put 82 theme×mode×surface
   * combinations below AA, bottoming at 2.0:1 (warning as text in light mode —
   * yellow on white, reachable by no stop of a yellow ramp). The shared cause:
   * the BASE tokens are tuned as fills and were never sized for this job. The
   * fix is the `--color-<intent>-text` roles in semantic.css — the same hue at
   * the nearest ramp stop that clears AA on every ground — and variants-lint
   * errors on a base intent used as a text utility, which is what retires the
   * 82-entry ledger that briefly lived here: the failing combination can no
   * longer be written, and the roles are gated hard below.
   *
   * Grounds include the intent's OWN `-subtle`: an Alert pairs
   * `bg-danger-subtle` with danger text, so the role has to read there too,
   * and it is the binding constraint for most stops (see the worst-case notes
   * in semantic.css).
   */
  describe('intent text roles on reading surfaces — WCAG contrast', () => {
    const AS_TEXT = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as const;

    const roleText: Record<string, number> = {};
    for (const theme of ['default', ...THEMES] as Theme[]) {
      const css = stylesheetFor(theme);
      for (const intent of AS_TEXT) {
        for (const mode of MODES) {
          const fg = resolveToken(css, `--color-${intent}-text`, mode);
          for (const surface of READING_SURFACES) {
            roleText[`${theme}/${intent}-text/${mode}/${surface}`] = round2(
              ratioOf(resolveToken(css, surfaceToken(surface), mode), fg)
            );
          }
          roleText[`${theme}/${intent}-text/${mode}/own-subtle`] = round2(
            ratioOf(resolveToken(css, `--color-${intent}-subtle`, mode), fg)
          );
        }
      }
    }
    const roleIds = Object.keys(roleText);

    it('covers every text role × ground (incl. own -subtle) × mode × theme', () => {
      expect(roleIds).toHaveLength(6 * 6 * 2 * 6);
      expect(roleIds).toContain('default/primary-text/dark/elevated');
    });

    it.each(roleIds)('%s clears AA', (id) => {
      expect(roleText[id], `${id} measures ${roleText[id]}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    /**
     * `neutral` is the one intent WITHOUT a `-text` role, and this is the
     * measurement that justifies it: the base token already clears AA as text
     * on every ground in every theme (worst 5.29 light / 5.20 dark), because
     * the chassis ramp was text-tuned from the start. If a theme retune ever
     * turns this red, the answer is a `--color-neutral-text` role like the
     * others — not an entry in an exception list.
     */
    describe('neutral needs no -text role — its base already reads as text', () => {
      const neutral: Record<string, number> = {};
      for (const theme of ['default', ...THEMES] as Theme[]) {
        const css = stylesheetFor(theme);
        for (const mode of MODES) {
          const fg = resolveToken(css, '--color-neutral', mode);
          for (const surface of READING_SURFACES) {
            neutral[`${theme}/neutral/${mode}/${surface}`] = round2(
              ratioOf(resolveToken(css, surfaceToken(surface), mode), fg)
            );
          }
          neutral[`${theme}/neutral/${mode}/own-subtle`] = round2(
            ratioOf(resolveToken(css, '--color-neutral-subtle', mode), fg)
          );
        }
      }

      it.each(Object.keys(neutral))('%s clears AA', (id) => {
        expect(neutral[id], `${id} measures ${neutral[id]}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    });
  });
});

/**
 * The surface ladder has to be *visible as a ladder*, not just legible.
 *
 * In light mode `base` sits at the white ceiling, so every other reading rung
 * must differentiate downward — and the ramp barely let it: quiet and elevated
 * were ΔL 0.01 / 0.02 from base, against 0.03 / 0.08 in dark mode. A tinted
 * in-flow surface with no border and no shadow was effectively invisible there,
 * which is why components kept adding a border purely to make a surface show up
 * (the chat bubble, the table-cell progress track). `neutral-25`/`-50` were
 * lowered to 0.985/0.965 in 2026-07 to fix it at the ramp.
 *
 * Measured in OKLCH ΔL, deliberately NOT in WCAG contrast ratio: the ratio is
 * defined for text against its background and its +0.05 offset compresses hard
 * at the dark end (dark base→elevated is a ratio of 1.014 while being a clearly
 * visible ΔL 0.08). OKLCH L is perceptually uniform, so it is the honest measure
 * for one surface against another.
 *
 * This is exactly the failure class the interaction-fill guard in
 * semantic.test.ts covers, one level down: that test catches a rung resolving to
 * the *same token*, this one catches rungs that resolve to distinct tokens whose
 * values are too close to tell apart.
 */
describe('surface ladder — perceptual separation', () => {
  /** Below this the tint is not reliably visible without a border or shadow. */
  const MIN_DELTA_L = 0.012;

  const separations: Record<string, number> = {};
  for (const theme of ['default', ...THEMES] as Theme[]) {
    const css = stylesheetFor(theme);
    for (const mode of MODES) {
      const base = resolveToken(css, '--color-surface-base', mode);
      for (const surface of ['quiet', 'elevated', 'subtle'] as const) {
        const rung = resolveToken(css, `--color-surface-${surface}`, mode);
        separations[`${theme}/${mode}/base-vs-${surface}`] = round2(
          Math.abs(base.l - rung.l) * 1000
        );
      }
    }
  }
  const ids = Object.keys(separations);

  it('covers quiet/elevated/subtle against base × mode × theme', () => {
    expect(ids).toHaveLength(6 * 2 * 3);
    expect(ids).toContain('default/light/base-vs-elevated');
  });

  it.each(ids)('%s is far enough from base to read as its own surface', (id) => {
    expect(
      separations[id],
      `${id} is ΔL ${separations[id] / 1000} from surface-base — below the ${MIN_DELTA_L} ` +
        `floor, so the tint alone cannot be seen and the component needs a border to show up`
    ).toBeGreaterThanOrEqual(MIN_DELTA_L * 1000);
  });

  /**
   * `overlay` is exempt from the floor above: in the light default it is
   * deliberately the same white as `base` and relies on its shadow plus the
   * backdrop dim instead (documented in semantic.css). Pinning that here means
   * nobody "fixes" it into a tint by accident.
   */
  it('overlay is the documented exception — it leans on shadow, not tint', () => {
    const css = stylesheetFor('default');
    const base = resolveToken(css, '--color-surface-base', 'light');
    const overlay = resolveToken(css, '--color-surface-overlay', 'light');
    expect(overlay.l).toBe(base.l);
  });
});

// ---------------------------------------------------------------------------
// The on-fill / on-primary split
// ---------------------------------------------------------------------------

/**
 * Why two token names for one value.
 *
 * `--color-text-on-primary` reads as "the label colour for the primary fill",
 * but until 2026-07-31 it was composed onto *every* solid intent — success,
 * danger, neutral, secondary, info. The name promised something narrower than
 * the job, and that mismatch handed consumers the wrong lever: retheming
 * primary invites you to retune "the on-primary colour", which silently
 * repainted the labels of every other intent too. Measured in the wild on a
 * channel-scoped orange primary, where a `success` filled Badge rendered
 * dark-orange text on dark green at roughly 1.5:1.
 *
 * The fix is naming, not colour: `--color-text-on-fill` carries the shared role,
 * `--color-text-on-primary` is defined as `var(--color-text-on-fill)` and now
 * governs the primary fills alone. Nothing moves by default — these tests exist
 * because "nothing moves by default" is exactly what makes a regression here
 * invisible.
 */
describe('the on-fill / on-primary split', () => {
  /** A dark orange, standing in for a consumer whose primary went orange. */
  const RETHEMED = 'oklch(0.35 0.12 60)';
  const overridden = (token: string) =>
    `${stylesheetFor('default')}\n:root { ${token}: ${RETHEMED}; }`;

  it('the two resolve to the same value by default, in both modes', () => {
    const css = stylesheetFor('default');
    for (const mode of MODES) {
      const onFill = resolveToken(css, '--color-text-on-fill', mode);
      const onPrimary = resolveToken(css, '--color-text-on-primary', mode);
      // All three channels: lightness alone would accept an alias that silently
      // re-hued the label.
      expect(
        [onPrimary.l, onPrimary.c, onPrimary.h],
        `on-primary must alias on-fill in ${mode} mode`
      ).toEqual([onFill.l, onFill.c, onFill.h]);
    }
  });

  it('overriding on-primary moves the primary label', () => {
    const css = overridden('--color-text-on-primary');
    const before = resolveToken(stylesheetFor('default'), '--color-text-on-primary', 'light');
    const after = resolveToken(css, '--color-text-on-primary', 'light');
    expect(after.l).not.toBe(before.l);
  });

  it('…and leaves every other intent readable — the regression this split prevents', () => {
    const css = overridden('--color-text-on-primary');
    for (const intent of INTENTS) {
      if (intent === 'primary') continue;
      const bg = resolveToken(css, STATES.base(intent), 'light');
      const fg = resolveToken(css, INTENT_FOREGROUND[intent], 'light');
      expect(
        round2(ratioOf(bg, fg)),
        `${intent} must not follow a primary retheme — it pairs with ` +
          `${INTENT_FOREGROUND[intent]}, not with the overridden on-primary`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('the old coupling would have broken them — counterfactual', () => {
    // Same override, but read through on-primary for every intent, i.e. what the
    // pre-split markup did. If this ever stops failing AA, the override above is
    // too gentle to prove anything and the test has quietly stopped testing.
    const css = overridden('--color-text-on-primary');
    const fg = resolveToken(css, '--color-text-on-primary', 'light');
    const broken = INTENTS.filter((intent) => {
      if (intent === 'primary' || intent === 'warning') return false;
      return ratioOf(resolveToken(css, STATES.base(intent), 'light'), fg) < AA_NORMAL;
    });
    // Named, not counted `> 0`: with five non-primary non-warning intents, a
    // threshold of "at least one" stays green while four of them quietly stop
    // breaking — i.e. while the counterfactual stops being one.
    expect(
      [...broken].sort(),
      'every non-warning intent must break under the old coupling, or this proves nothing'
    ).toEqual(['danger', 'info', 'neutral', 'secondary', 'success']);
  });

  it('overriding on-fill moves every solid label at once — the wholesale lever', () => {
    const css = overridden('--color-text-on-fill');
    // `primary` is the only load-bearing case. success/danger read
    // `--color-text-on-fill` directly, so asserting they moved is asserting the
    // override took — tautological. primary reads `--color-text-on-primary`, and
    // moves only because that token is *defined as* `var(on-fill)`; replace the
    // alias with a same-valued literal and this is the case that goes red.
    const primary = resolveToken(css, '--color-text-on-primary', 'light');
    expect(primary.l, 'primary must follow an on-fill override through the alias').toBeCloseTo(
      0.35,
      2
    );
    for (const intent of ['success', 'danger'] as const) {
      expect(resolveToken(css, INTENT_FOREGROUND[intent], 'light').l).toBeCloseTo(0.35, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// The table package's own intents
// ---------------------------------------------------------------------------

/**
 * `filter` / `group` / `summary` are declared by `@urbicon-ui/table`, not by
 * blocks, and they wire the same on-color vocabulary. This suite already globs
 * the table variant files for the pairing check above — but until 2026-07-31 the
 * `INTENTS` list held only the seven blocks intents, so the WCAG sweep walked
 * straight past these three. They had been three intents no gate covered, and
 * they measured 3.60–3.67:1 with white on the solid fill: under AA, in the plain
 * default theme.
 *
 * The cause is that they ride Tailwind's stock cyan/teal/emerald ramps. The
 * blocks intent ramps were hand-darkened precisely so white would clear AA on
 * them (foundation.css); Tailwind's were not. Hence the -700 stop in light mode
 * where blocks uses -600.
 *
 * Reading Tailwind's palette from `node_modules` rather than copying the six
 * values in is deliberate: a copy would keep passing after an upstream palette
 * change, which is the one event this test exists to catch.
 */
describe('table intents — WCAG contrast', () => {
  const TABLE_INTENTS = ['filter', 'group', 'summary'] as const;

  const tableStylesheet = () => {
    const require_ = createRequire(import.meta.url);
    const tailwindTheme = readFileSync(require_.resolve('tailwindcss/theme.css'), 'utf8');
    const tableTheme = readFileSync(
      resolve(STYLE_DIR, '../../../../table/src/lib/style/table-theme.css'),
      'utf8'
    );
    return stripMediaBlocks(
      `${tailwindTheme}\n${read('./foundation.css')}\n${read('./semantic.css')}\n${tableTheme}`
    );
  };

  const css = tableStylesheet();

  it('resolves the table tokens at all (guards the node_modules read)', () => {
    // If Tailwind drops `theme.css` or renames the cyan ramp, `resolveToken`
    // throws (`Token … not declared` / `Cannot resolve color expression`), so
    // the failure is loud either way. What this case adds is a *named* place for
    // that failure: without it, an upstream rename surfaces as eighteen
    // identical-looking AA failures with no hint that the cause is the read.
    const filter = resolveToken(css, '--color-filter', 'light');
    expect(filter.l).toBeGreaterThan(0);
    expect(filter.l).toBeLessThan(1);
  });

  /**
   * The same rule `semantic.test.ts` enforces for the surface ladder, applied to
   * these three: *"a hover token that resolves to its own resting value is not a
   * subtle bug — it is no hover."* That suite's PAIRS list covers only
   * `--color-surface-*`, and no table-side token test existed, so the table
   * intents had no such guard.
   *
   * They needed one immediately. Moving the base from -600 to -700 for AA landed
   * it on the stop `-hover` already used, making the light-mode hover a no-op on
   * all three — invisible to the AA cases above, which measure each state
   * against text and are perfectly happy for two states to be the same colour.
   * The whole ladder moved instead (-700/-800/-900); this is what says so.
   */
  for (const intent of TABLE_INTENTS) {
    for (const [rest, step] of [
      ['', '-hover'],
      ['-hover', '-active']
    ] as const) {
      it(`${intent}${step} steps away from ${intent}${rest || ' (resting)'}`, () => {
        for (const mode of MODES) {
          const a = resolveToken(css, `--color-${intent}${rest}`, mode);
          const b = resolveToken(css, `--color-${intent}${step}`, mode);
          expect(
            [b.l, b.c, b.h],
            `--color-${intent}${step} resolves to the same value as ` +
              `--color-${intent}${rest || ''} in ${mode} mode — any hover/press built ` +
              `on this pair is a silent no-op there`
          ).not.toEqual([a.l, a.c, a.h]);
        }
      });
    }
  }

  for (const intent of TABLE_INTENTS) {
    for (const state of STATE_NAMES) {
      it(`${intent}/${state} — light mode clears AA against text-on-fill`, () => {
        const bg = resolveToken(css, STATES[state](intent as never), 'light');
        const fg = resolveToken(css, '--color-text-on-fill', 'light');
        expect(
          round2(ratioOf(bg, fg)),
          `--color-${intent} (light) rides a Tailwind ramp that is not darkened for AA; ` +
            `it must sit at the -700 stop, not -600`
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it(`${intent}/${state} — dark mode clears AA against text-on-fill`, () => {
        const bg = resolveToken(css, STATES[state](intent as never), 'dark');
        const fg = resolveToken(css, '--color-text-on-fill', 'dark');
        expect(round2(ratioOf(bg, fg))).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});
