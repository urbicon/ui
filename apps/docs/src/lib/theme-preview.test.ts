import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  generateChassis,
  neutralRamp,
  oklch,
  parseThemeRamps,
  SEMANTIC_MIRROR
} from './theme-preview';

/**
 * theme-preview.ts claims to mirror two library files: the neutral-ramp
 * profile of foundation.css and the per-mode role→stop mappings of
 * semantic.css. Both copies had already drifted once before this module
 * existed (the pages carried an 0.99/0.002 neutral-25 against the shipped
 * 0.985/0.003), so each claim is checked against the real file here.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(__dirname, '../../../../packages/blocks/src/lib/style');
const foundation = readFileSync(resolve(styleDir, 'foundation.css'), 'utf8');
const semantic = readFileSync(resolve(styleDir, 'semantic.css'), 'utf8');

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
    const shipped = [...foundation.matchAll(/--color-neutral-(\d+):/g)].map((m) => Number(m[1]));
    expect(neutralRamp.map((s) => s.shade)).toEqual(shipped.filter((s) => s !== 0));
  });
});

describe('role mappings mirror semantic.css', () => {
  function shipped(role: string, base: string): [number, number] | null {
    const match = semantic.match(
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

  it('accent roles read the same ramp stops per mode', () => {
    for (const [intent, roles] of Object.entries(SEMANTIC_MIRROR.ACCENT_ROLES)) {
      for (const [suffix, pair] of Object.entries(roles)) {
        expect(shipped(`${intent}${suffix}`, intent), `--color-${intent}${suffix}`).toEqual(pair);
      }
    }
  });
});

describe('parseThemeRamps against the shipped themes', () => {
  const themesDir = resolve(styleDir, 'themes');
  const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith('.css') && f !== 'index.css');

  it('finds the shipped themes', () => {
    expect(themeFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of themeFiles) {
    it(`${file}: every stop the preview roles read is present`, () => {
      const ramps = parseThemeRamps(readFileSync(join(themesDir, file), 'utf8'));
      for (const roles of Object.values(SEMANTIC_MIRROR.ACCENT_ROLES)) {
        for (const pair of Object.values(roles)) {
          for (const stop of pair) {
            expect(ramps.primary[stop], `primary-${stop}`).toBeTruthy();
            expect(ramps.secondary[stop], `secondary-${stop}`).toBeTruthy();
          }
        }
      }
      const neutralShades = new Set(ramps.neutral.map((s) => s.shade));
      for (const pair of Object.values(SEMANTIC_MIRROR.CHASSIS_ROLES)) {
        for (const stop of pair) {
          expect(neutralShades.has(stop), `neutral-${stop}`).toBe(true);
        }
      }
    });
  }
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
