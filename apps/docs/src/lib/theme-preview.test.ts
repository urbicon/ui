import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildTokenGraph,
  derivedDeclarations,
  parseDeclarations,
  references
} from './css-declarations';
import {
  generateChassis,
  neutralRamp,
  oklch,
  parseTheme,
  previewVars,
  UNTINTED_NEUTRAL_STOP
} from './theme-preview';

/**
 * theme-preview.ts derives the preview scope's re-declarations from the shipped
 * stylesheets instead of mirroring them by hand. What can go wrong is therefore
 * no longer "the list is stale" but one of two things, and both are tested here:
 *
 *   - UNDER-emission — a role that reads a re-tinted ramp is left out, so a
 *     component inside the preview keeps wearing the site's own chassis. That
 *     is the bug that shipped once (ten neutral-derived roles missing, Toggle
 *     thumbs and on-fill labels wrong);
 *   - OVER-emission — something that does NOT read the ramps gets re-declared,
 *     which pins a value the preview has no business pinning.
 *
 * The assertions run against `packages/blocks/src/lib/style/*`, the source of
 * truth, rather than against the built package the module itself imports.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(__dirname, '../../../../packages/blocks/src/lib/style');
const read = (file: string) => readFileSync(resolve(styleDir, file), 'utf8');
const foundation = read('foundation.css');
const semantic = read('semantic.css');
const interaction = read('interaction.css');
const mint = readFileSync(resolve(styleDir, '../mint/styles.css'), 'utf8');

/**
 * Every stylesheet `style/index.css` pulls in, in its order — which is what
 * `library-tokens.ts` builds the shipped graph from. mint/styles.css is part of
 * it: its two glow tokens read `--color-primary`, so by the closure's own rule
 * they belong in a preview scope.
 */
const SOURCES = [
  ['foundation.css', foundation],
  ['semantic.css', semantic],
  ['interaction.css', interaction],
  ['mint/styles.css', mint]
] as const;

const graph = buildTokenGraph(SOURCES.map(([, css]) => css));

/**
 * semantic.css up to its first at-rule — the base cascade, which is what a
 * preview scope re-declares. Below it, `@media (prefers-contrast: more)`
 * re-declares a handful of roles against different stops (`--color-border-hairline`
 * becomes neutral-derived there, having been an alpha literal above), and those
 * are deliberately NOT in the closure: an inline declaration on the container
 * outranks them anyway, so pinning them would only freeze the base value into a
 * high-contrast session.
 */
const semanticBase = semantic.slice(0, semantic.indexOf('@media'));

/** Every role the base block derives from the neutral ramp, by pattern rather
 * than through the parser — a second opinion on what the closure must find. */
function neutralDerivedRoles(): string[] {
  return [
    ...semanticBase.matchAll(
      /(--color-[a-z0-9-]+):\s*light-dark\(\s*var\(--color-neutral-\d+\),\s*var\(--color-neutral-\d+\)\s*\)/g
    )
  ].map((m) => m[1]);
}

/**
 * Names declared as a library DEFAULT more than once — the same name in a
 * top-level `:root` or `@theme` rule twice, whether in one file or across them.
 * Read off `parseDeclarations` rather than `baseDeclarations`, which is already
 * first-wins-deduped and could therefore never report one.
 */
function duplicateDefaults(sources: readonly (readonly [string, string])[]): string[] {
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const [file, css] of sources) {
    for (const { name, depth, selector } of parseDeclarations(css)) {
      if (depth !== 1 || !/^(@theme|:root)$/.test(selector)) continue;
      const first = seen.get(name);
      if (first) collisions.push(`${name}: ${first} + ${file}`);
      else seen.set(name, file);
    }
  }
  return collisions;
}

/** What a themes-gallery preview overrides: the three ramps plus both knobs. */
const RAMP_SEEDS = [
  ...neutralRamp.map((s) => `--color-neutral-${s.shade}`),
  ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].flatMap((stop) => [
    `--color-primary-${stop}`,
    `--color-secondary-${stop}`
  ]),
  '--blocks-shadow-tint',
  '--neutral-chrome-hue'
];

const RADIUS_SEEDS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].map(
  (step) => `--radius-${step}`
);

const closure = derivedDeclarations(graph, RAMP_SEEDS);
const closureNames = new Set(closure.map((d) => d.name));

describe('the token graph the closure walks', () => {
  it('reads all three layers, base values only', () => {
    const names = new Set(graph.declarations.map((d) => d.name));
    expect(names.has('--color-neutral-500'), 'foundation.css').toBe(true);
    expect(names.has('--color-surface-base'), 'semantic.css').toBe(true);
    expect(names.has('--blocks-shadow-md'), 'interaction.css').toBe(true);
    // Declared only under `@media (pointer: coarse)` / `(pointer: fine)`, so it
    // is not a library default and must not be published as one.
    expect(names.has('--blocks-touch-target-min'), 'at-rule-only token').toBe(false);
  });

  it('declares no base name twice, in one file or across them', () => {
    // first-wins is unambiguous only while that holds — CSS resolves the LAST
    // declaration, so a duplicate default means the graph and the browser
    // disagree. Counted off `parseDeclarations`, not `baseDeclarations`: the
    // latter is already first-wins-deduped, so asking it could only ever
    // surface cross-file collisions and never the intra-file one its own
    // docstring calls a bug in that file.
    expect(duplicateDefaults(SOURCES)).toEqual([]);
  });

  it('can tell a duplicate when there is one', () => {
    // Positive control on the guard above: same shape, one file, one repeat.
    expect(duplicateDefaults([['probe', ':root { --a: 1; } :root { --a: 2; }']])).toEqual([
      '--a: probe + probe'
    ]);
  });

  it('does not call a conditional rule a duplicate of the default', () => {
    // mint/styles.css sets --blocks-mint-glow-color under :root and then under
    // six .blocks-intent-* classes. That is a cascade, not a collision.
    expect(
      duplicateDefaults([['probe', ':root { --glow: blue; } .intent-success { --glow: green; }']])
    ).toEqual([]);
  });
});

describe('the closure covers what reads the ramps', () => {
  it('reaches every neutral-derived role semantic.css declares', () => {
    const declared = neutralDerivedRoles();
    expect(declared.length).toBeGreaterThan(20);
    expect(declared.filter((name) => !closureNames.has(name))).toEqual([]);
  });

  it('reaches every accent-derived role, the ramp-named ones and the rest', () => {
    const declared = [
      ...semanticBase.matchAll(
        /(--color-[a-z0-9-]+):\s*light-dark\(\s*var\(--color-(?:primary|secondary)-\d+\),/g
      )
    ].map((m) => m[1]);
    expect(declared).toContain('--color-primary-hover');
    expect(declared).toContain('--color-surface-selected');
    expect(declared).toContain('--color-chart-1');
    expect(declared).toContain('--color-chart-4');
    expect(declared.filter((name) => !closureNames.has(name))).toEqual([]);
  });

  it('follows the chains a hand-written list kept missing', () => {
    // Each of these is one hop further than the mirror ever reached.
    for (const [name, why] of [
      ['--color-text-on-primary', 'alias of a re-declared role'],
      ['--color-interactive-hover', 'primary-derived in relative-colour syntax'],
      ['--color-shadow-md', 'shadow tint → semantic shadow'],
      ['--blocks-shadow-md', 'semantic shadow → interaction alias'],
      ['--color-neutral-emphasis', 'chrome hue → neutral intent'],
      ['--blocks-focus-ring', 'primary → focus ring colour → composed ring']
    ] as const) {
      expect(closureNames.has(name), `${name} (${why})`).toBe(true);
    }
  });

  it('re-declares the derived radius tiers, and only those, when the scale moves', () => {
    const names = derivedDeclarations(graph, RADIUS_SEEDS).map((d) => d.name);
    // Derived from the base scale, so a scope overriding it has to repeat them.
    expect(names).toContain('--radius-modify');
    expect(names).toContain('--radius-contain');
    expect(names).toContain('--radius-bridge');
    // Literals in foundation.css: a base-radius override does not move them,
    // and pinning them here would be the over-emission failure. No tier name is
    // hardcoded to reach that verdict — the value's shape decides.
    expect(names).not.toContain('--radius-commit');
    expect(names).not.toContain('--radius-control');
  });
});

describe('the closure emits nothing it should not', () => {
  it('leaves the intents the preview does not re-tint alone', () => {
    for (const role of [
      '--color-success',
      '--color-warning-subtle',
      '--color-danger-emphasis',
      '--color-info',
      '--color-feedback-error',
      '--color-text-on-warning',
      '--color-live',
      '--color-avatar-1',
      '--blocks-duration-fast',
      '--blocks-transition-colors'
    ]) {
      expect(closureNames.has(role), role).toBe(false);
    }
  });

  it('never repeats a name the caller already overrides', () => {
    for (const seed of RAMP_SEEDS) expect(closureNames.has(seed), seed).toBe(false);
  });

  it('emits every declaration verbatim, so no formula is retyped here', () => {
    const declared = new Map(graph.declarations.map((d) => [d.name, d.value]));
    for (const { name, value } of closure) expect(value, name).toBe(declared.get(name));
  });

  it('leaves no dangling reference: every var() resolves in scope or at :root', () => {
    const known = new Set([...RAMP_SEEDS, ...graph.declarations.map((d) => d.name)]);
    const dangling = closure.flatMap(({ name, value }) =>
      references(value)
        .filter((ref) => !known.has(ref))
        .map((ref) => `${name} → ${ref}`)
    );
    expect(dangling).toEqual([]);
  });
});

describe('positive controls on the closure oracle', () => {
  it('finds nothing when nothing is overridden', () => {
    expect(derivedDeclarations(graph, [])).toEqual([]);
  });

  it('would report the neutral-derived roles as missing if the seeds were empty', () => {
    // The completeness assertions above are only worth their green if they can
    // go red. Same oracle, no seeds: every role has to come back missing.
    const empty = new Set(derivedDeclarations(graph, []).map((d) => d.name));
    const declared = neutralDerivedRoles();
    expect(declared.filter((name) => !empty.has(name))).toEqual(declared);
  });

  it('walks a chain rather than one hop', () => {
    const chain = buildTokenGraph([
      ':root { --seed: 1; --hop-1: var(--seed); --hop-2: var(--hop-1); --unrelated: 2; }'
    ]);
    expect(derivedDeclarations(chain, ['--seed']).map((d) => d.name)).toEqual([
      '--hop-1',
      '--hop-2'
    ]);
  });

  it('holds for the built stylesheets the pages actually read', () => {
    // Everything above measures `packages/blocks/src`; `library-tokens.ts`
    // imports the package exports, i.e. `dist`. Vite stubs `.css` imports
    // outside a browser build, so that module cannot be imported here to
    // compare — but the files it resolves to can be read directly, which is the
    // same question without the stub.
    const distDir = resolve(styleDir, '../../../dist');
    let built: string[];
    try {
      built = [
        'style/foundation.css',
        'style/semantic.css',
        'style/interaction.css',
        'mint/styles.css'
      ].map((f) => readFileSync(resolve(distDir, f), 'utf8'));
    } catch (error) {
      throw new Error(
        `packages/blocks/dist is missing — run \`bun run build:packages\`. (${error})`
      );
    }
    const shipped = new Set(buildTokenGraph(built).declarations.map((d) => d.name));
    const source = graph.declarations.map((d) => d.name);
    expect(
      source.filter((name) => !shipped.has(name)),
      'packages/blocks/dist is stale — the previews render it, these tests measure src'
    ).toEqual([]);
  });

  it('refuses to emit a scope at all when the stylesheets did not load', () => {
    // Vite serves `.css` imports as empty modules outside a browser build, so
    // an empty graph is a real shape this code can be handed. Emitting the
    // ramps alone would look plausible and render the surrounding page's theme
    // — the exact bug the closure exists to prevent — so it has to be loud.
    expect(() =>
      previewVars([['--color-primary-500', 'oklch(0.5 0.1 0)']], buildTokenGraph([]))
    ).toThrow(/empty token graph/);
  });
});

describe('neutralRamp mirrors foundation.css', () => {
  it('matches lightness and chroma of every shipped neutral stop', () => {
    for (const { shade, l, c } of neutralRamp) {
      const match = foundation.match(
        new RegExp(`--color-neutral-${shade}:\\s*oklch\\(([\\d.]+) ([\\d.]+) 240\\)`)
      );
      expect(match, `--color-neutral-${shade} missing from foundation.css`).toBeTruthy();
      expect(
        { shade, l: Number(match?.[1]), c: Number(match?.[2]) },
        `--color-neutral-${shade} profile diverged`
      ).toEqual({ shade, l, c });
    }
  });

  it('covers every foundation stop except the untinted neutral-0', () => {
    // Set equality, deliberately order-insensitive: re-ordering the
    // declarations in foundation.css (or re-declaring one in a media block)
    // changes no shipped colour and must not turn this gate red.
    const shipped = new Set(
      [...foundation.matchAll(/--color-neutral-(\d+):/g)].map((m) => Number(m[1]))
    );
    shipped.delete(UNTINTED_NEUTRAL_STOP);
    expect(new Set(neutralRamp.map((s) => s.shade))).toEqual(shipped);
  });
});

describe('parseTheme against the shipped themes', () => {
  const themesDir = resolve(styleDir, 'themes');
  const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith('.css') && f !== 'index.css');
  const usable = (value: string | undefined) =>
    typeof value === 'string' &&
    value.length > 0 &&
    // balanced parentheses: a truncated value is the failure mode a `[^)]+`
    // scan produces on relative-color syntax
    value.split('(').length === value.split(')').length;

  it('finds the shipped themes', () => {
    expect(themeFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of themeFiles) {
    it(`${file}: every stop a re-declared role reads is present and usable`, () => {
      const ramps = parseTheme(readFileSync(join(themesDir, file), 'utf8'));
      const byShade = new Map(ramps.neutral.map((s) => [s.shade, s.value]));
      const available = (ref: string) => {
        const stop = /^--color-(primary|secondary|neutral)-(\d+)$/.exec(ref);
        if (!stop) return true; // not a re-tinted ramp: resolves at :root
        const shade = Number(stop[2]);
        // neutral-0 is pure white and deliberately never re-tinted.
        if (stop[1] === 'neutral') {
          return shade === UNTINTED_NEUTRAL_STOP || usable(byShade.get(shade));
        }
        return usable((stop[1] === 'primary' ? ramps.primary : ramps.secondary)[shade]);
      };

      const missing = closure.flatMap(({ name, value }) =>
        references(value)
          .filter((ref) => !available(ref))
          .map((ref) => `${name} → ${ref}`)
      );
      expect(missing).toEqual([]);
    });
  }

  it('carries the two :root knobs the four coloured themes set', () => {
    const sunset = parseTheme(readFileSync(join(themesDir, 'sunset.css'), 'utf8'));
    const byName = new Map(sunset.declarations.map((d) => [d.name, d.value]));
    expect(byName.get('--blocks-shadow-tint')).toBe('0.22 0.03 55');
    expect(byName.get('--neutral-chrome-hue')).toBe('50');
  });

  it('carries no knobs for the theme that deliberately ships none', () => {
    // neutral.css is grayscale: it has no temperature to match, so the library
    // defaults are correct and the preview must not pin anything.
    const neutral = parseTheme(readFileSync(join(themesDir, 'neutral.css'), 'utf8'));
    const names = neutral.declarations.map((d) => d.name);
    expect(names).not.toContain('--blocks-shadow-tint');
    expect(names).not.toContain('--neutral-chrome-hue');
  });

  it('carries the intent ramps a theme re-tunes, not just the accents', () => {
    // forest.css moves success to hue 172 and warning to 60 because its green
    // primary collides with the default success. Dropping those would make the
    // preview exhibit the very collision the file exists to avoid — beside the
    // prose telling the reader to fix it.
    const forest = parseTheme(readFileSync(join(themesDir, 'forest.css'), 'utf8'));
    const names = new Set(forest.declarations.map((d) => d.name));
    expect(names.has('--color-success-500'), 'forest re-tunes success').toBe(true);
    expect(names.has('--color-warning-500'), 'forest re-tunes warning').toBe(true);
    // …and the closure then reaches the roles that read them.
    const derived = derivedDeclarations(graph, names).map((d) => d.name);
    expect(derived).toContain('--color-success');
    expect(derived).toContain('--color-feedback-warning');
  });

  it('does not mistake the warm-neutral ramp for the chassis', () => {
    const parsed = parseTheme(`@theme {
      --color-warm-neutral-500: oklch(0.5 0.008 45);
      --color-neutral-500: oklch(0.55 0.016 200);
    }`);
    expect(parsed.neutral).toEqual([{ shade: 500, value: 'oklch(0.55 0.016 200)' }]);
  });
});

describe('previewVars', () => {
  const vars = previewVars(
    [
      ['--color-primary-500', 'oklch(0.58 0.15 320)'],
      ['--color-primary-600', 'oklch(0.52 0.15 320)'],
      ['--color-secondary-500', 'oklch(0.55 0.12 0)'],
      ['--color-neutral-900', 'oklch(0.15 0.012 320)'],
      ['--blocks-shadow-tint', '0.2 0.025 320'],
      ['--neutral-chrome-hue', '320']
    ],
    graph
  );
  const declared = new Map(
    vars.split('; ').map((pair) => {
      const at = pair.indexOf(': ');
      return [pair.slice(0, at), pair.slice(at + 2)];
    })
  );

  it('leads with the values the caller passed in', () => {
    expect(declared.get('--color-primary-500')).toBe('oklch(0.58 0.15 320)');
    expect(declared.get('--blocks-shadow-tint')).toBe('0.2 0.025 320');
  });

  it('declares each name exactly once, so no re-declaration undoes another', () => {
    const names = vars.split('; ').map((pair) => pair.slice(0, pair.indexOf(': ')));
    expect(names.length).toBe(new Set(names).size);
  });

  it('omits the radius tiers until the scale is actually overridden', () => {
    expect(declared.has('--radius-modify')).toBe(false);
    const withRadii = previewVars([['--radius-sm', '0rem']], graph);
    expect(withRadii).toContain('--radius-modify: var(--radius-sm)');
  });

  it('pins no chroma knob the caller did not pass', () => {
    const withoutKnobs = previewVars([['--color-primary-500', 'oklch(0.58 0.15 320)']], graph);
    expect(withoutKnobs).not.toContain('--blocks-shadow-tint');
    expect(withoutKnobs).not.toContain('--neutral-chrome-hue');
    // …and without the tint seeded, the shadow chain stays at :root too.
    expect(withoutKnobs).not.toContain('--blocks-shadow-md');
  });
});

describe('oklch output hygiene', () => {
  it('rounds float artifacts out of generated values', () => {
    // 0.12 × 0.87 = 0.10439999999999999 in IEEE 754; the copy-paste CSS
    // output must never contain that tail.
    expect(oklch(0.66, 0.12 * 0.87, 280)).toBe('oklch(0.66 0.1044 280)');
  });

  it('keeps a grayscale chassis chroma-free at every stop', () => {
    for (const { value } of generateChassis(200, 0)) {
      expect(value).toMatch(/oklch\([\d.]+ 0 200\)/);
    }
  });
});
