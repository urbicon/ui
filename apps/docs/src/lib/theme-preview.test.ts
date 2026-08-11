import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DERIVED_RADIUS_TIERS,
  generateChassis,
  LITERAL_RADIUS_TIERS,
  neutralRamp,
  oklch,
  parseThemeRamps,
  SEMANTIC_MIRROR,
  UNTINTED_NEUTRAL_STOP
} from './theme-preview';

/**
 * theme-preview.ts claims to mirror three library files: the neutral-ramp
 * profile and tier radii of foundation.css, and the per-mode role→stop
 * mappings of semantic.css. Every copy here is checked against the real file,
 * in BOTH directions — the mirror having fewer roles than semantic.css is the
 * failure that shipped once already (ten neutral-derived roles missing, so the
 * previews rendered Toggle thumbs and on-fill labels in the site's own chassis
 * instead of the previewed theme's).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(__dirname, '../../../../packages/blocks/src/lib/style');
const foundation = readFileSync(resolve(styleDir, 'foundation.css'), 'utf8');
const semantic = readFileSync(resolve(styleDir, 'semantic.css'), 'utf8');

/**
 * The base `:root` block only. The `@media (prefers-contrast: more)` and
 * `@media print` blocks below re-declare a handful of the same roles with
 * different stops; a preview scope must mirror the base cascade, and the
 * accessibility overrides keep applying on top of it as they do everywhere
 * else.
 */
const baseBlock = semantic.slice(0, semantic.indexOf('@media'));

describe('the base-block slice the mirrors are checked against', () => {
  it('is a real prefix containing the role declarations', () => {
    expect(semantic.indexOf('@media')).toBeGreaterThan(0);
    expect(baseBlock).toContain('--color-text-primary:');
    expect(baseBlock).toContain('--color-interactive-disabled:');
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

describe('role mappings mirror semantic.css', () => {
  /** First (base-block) declaration of a role as a light-dark stop pair. */
  function shipped(role: string, base: string): [number, number] | null {
    const match = baseBlock.match(
      new RegExp(
        `--color-${role}:\\s*light-dark\\(\\s*var\\(--color-${base}-(\\d+)\\),\\s*var\\(--color-${base}-(\\d+)\\)\\s*\\)`
      )
    );
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  it('chassis-derived roles read the same neutral stops per mode', () => {
    for (const [role, pair] of Object.entries(SEMANTIC_MIRROR.CHASSIS_ROLES)) {
      expect(shipped(role, 'neutral'), `--color-${role}`).toEqual(pair);
    }
  });

  it('mirrors EVERY neutral-derived role semantic.css declares', () => {
    const declared = new Set(
      [
        ...baseBlock.matchAll(
          /--color-([a-z0-9-]+):\s*light-dark\(\s*var\(--color-neutral-\d+\),\s*var\(--color-neutral-\d+\)\s*\)/g
        )
      ].map((m) => m[1])
    );
    expect(declared.size).toBeGreaterThan(20);
    expect(new Set(Object.keys(SEMANTIC_MIRROR.CHASSIS_ROLES))).toEqual(declared);
  });

  it('accent roles read the same ramp stops per mode', () => {
    for (const [intent, roles] of Object.entries(SEMANTIC_MIRROR.ACCENT_ROLES)) {
      for (const [suffix, pair] of Object.entries(roles)) {
        expect(shipped(`${intent}${suffix}`, intent), `--color-${intent}${suffix}`).toEqual(pair);
      }
    }
  });

  it('primary-derived roles that do not carry the ramp name still match', () => {
    for (const [role, pair] of Object.entries(SEMANTIC_MIRROR.PRIMARY_RAMP_ROLES)) {
      expect(shipped(role, 'primary'), `--color-${role}`).toEqual(pair);
    }
  });

  it('relative-color roles match semantic.css verbatim', () => {
    for (const [role, expression] of Object.entries(SEMANTIC_MIRROR.RELATIVE_PRIMARY_ROLES)) {
      expect(baseBlock, `--color-${role}`).toContain(`--color-${role}: ${expression};`);
    }
  });
});

describe('radius tiers mirror foundation.css', () => {
  it('derived tiers read the base radius the module claims', () => {
    for (const [token, value] of Object.entries(DERIVED_RADIUS_TIERS)) {
      expect(foundation, token).toContain(`${token}: ${value};`);
    }
  });

  it('literal tiers are literals, so a base-radius override cannot move them', () => {
    for (const [token, value] of Object.entries(LITERAL_RADIUS_TIERS)) {
      expect(foundation, token).toContain(`${token}: ${value};`);
    }
  });

  it('knows every tier token foundation.css declares', () => {
    const declared = new Set(
      [...foundation.matchAll(/(--radius-(?:commit|modify|contain|bridge|control)):/g)].map(
        (m) => m[1]
      )
    );
    const covered = new Set([
      ...Object.keys(DERIVED_RADIUS_TIERS),
      ...Object.keys(LITERAL_RADIUS_TIERS)
    ]);
    expect(covered).toEqual(declared);
  });
});

describe('parseThemeRamps against the shipped themes', () => {
  const themesDir = resolve(styleDir, 'themes');
  const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith('.css') && f !== 'index.css');

  it('finds the shipped themes', () => {
    expect(themeFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of themeFiles) {
    it(`${file}: every stop the preview roles read is present and a usable colour`, () => {
      const ramps = parseThemeRamps(readFileSync(join(themesDir, file), 'utf8'));
      const usable = (value: string | undefined) =>
        typeof value === 'string' &&
        value.length > 0 &&
        // balanced parentheses: a truncated value is the failure mode a
        // `[^)]+` scan produces on relative-color syntax
        value.split('(').length === value.split(')').length;

      for (const roles of Object.values(SEMANTIC_MIRROR.ACCENT_ROLES)) {
        for (const pair of Object.values(roles)) {
          for (const stop of pair) {
            expect(usable(ramps.primary[stop]), `primary-${stop} in ${file}`).toBe(true);
            expect(usable(ramps.secondary[stop]), `secondary-${stop} in ${file}`).toBe(true);
          }
        }
      }
      for (const pair of Object.values(SEMANTIC_MIRROR.PRIMARY_RAMP_ROLES)) {
        for (const stop of pair) {
          expect(usable(ramps.primary[stop]), `primary-${stop} in ${file}`).toBe(true);
        }
      }

      const byShade = new Map(ramps.neutral.map((s) => [s.shade, s.value]));
      for (const pair of Object.values(SEMANTIC_MIRROR.CHASSIS_ROLES)) {
        for (const stop of pair) {
          // neutral-0 is pure white and deliberately never re-tinted: roles
          // reading it resolve from :root inside the preview scope.
          if (stop === UNTINTED_NEUTRAL_STOP) continue;
          expect(usable(byShade.get(stop)), `neutral-${stop} in ${file}`).toBe(true);
        }
      }
    });
  }

  it('keeps nested parentheses intact instead of truncating at the inner one', () => {
    const parsed = parseThemeRamps(`@theme {
      --color-primary-500: oklch(from var(--color-primary-600) calc(l + 0.08) c h);
      --color-neutral-500: color-mix(in oklab, #fff 20%, #000);
    }`);
    expect(parsed.primary[500]).toBe('oklch(from var(--color-primary-600) calc(l + 0.08) c h)');
    expect(parsed.neutral).toContainEqual({
      shade: 500,
      value: 'color-mix(in oklab, #fff 20%, #000)'
    });
  });

  it('ignores ramp names mentioned only in comments', () => {
    const parsed = parseThemeRamps(`@theme {
      /* … all shades --color-primary-200 to --color-primary-800 … */
      --color-primary-500: oklch(0.58 0.15 280);
    }`);
    expect(Object.keys(parsed.primary)).toEqual(['500']);
  });

  it('does not mistake the warm-neutral ramp for the chassis', () => {
    const parsed = parseThemeRamps(`@theme {
      --color-warm-neutral-500: oklch(0.5 0.008 45);
      --color-neutral-500: oklch(0.55 0.016 200);
    }`);
    expect(parsed.neutral).toEqual([{ shade: 500, value: 'oklch(0.55 0.016 200)' }]);
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
