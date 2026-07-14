import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CSS_REFERENCE_OVERVIEW,
  CSS_REFERENCE_SECTION_NAMES,
  CSS_REFERENCE_SECTIONS,
  renderCssReference
} from './css-reference.js';

/**
 * Drift guard for the hand-maintained CSS token reference.
 *
 * The reference inlines its token tables as TS strings — both consumers (the remote
 * MCP server and the `urbicon` CLI) ship standalone (no blocks CSS at runtime), the
 * same constraint that keeps the linter's `VALID_TOKEN_CORES` inline. The hazard of
 * any hand-copied list is silent drift: `--color-border-hairline` was added to the
 * CSS and went unmirrored here for a while. When the blocks CSS is present (i.e.
 * running in-repo) we re-derive the semantic surface / text / border token cores and
 * assert each is documented, so a newly added token can no longer disappear.
 *
 * Scope: the three families the reference enumerates exhaustively (one row per
 * token), plus a lighter check that every intent is at least *named* (its base
 * `--color-<intent>` token or a `bg-<intent>` utility appears in the prose) — the
 * F-B drift where a whole intent (`info`, a real ramp behind `bg-info` /
 * `--color-feedback-info`) went undocumented while the six others were listed. It
 * deliberately does NOT require every intent scale step (`primary-50 … primary-950`,
 * documented via shorthand), feedback/interactive, chart, or internal-only token
 * (e.g. `skeleton-shimmer`, used by the Skeleton wave, never a consumer utility) to
 * be spelled out. Whole-set token validity is already guarded by the linter's
 * `tokens.test.ts`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const semantic = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'blocks',
  'src',
  'lib',
  'style',
  'semantic.css'
);
const cssAvailable = existsSync(semantic);

const themesDir = resolve(semantic, '..', 'themes');
const themesAvailable = existsSync(themesDir);

/**
 * Token families the SHIPPED themes override, derived from the theme CSS itself.
 * A ramp stop (`--color-primary-500`) collapses to its family (`--color-primary-*`);
 * standalone knobs (`--blocks-shadow-tint`) stay as-is.
 *
 * This exists because the docs once taught a primary-only recolor — the drift that
 * `THEMING` explicitly calls "the single most common theming mistake". If a theme
 * starts overriding a new family, the guide must account for it.
 */
function deriveThemeTokenFamilies(): string[] {
  const families = new Set<string>();
  for (const file of readdirSync(themesDir)) {
    if (!file.endsWith('.css') || file === 'index.css') continue;
    const css = readFileSync(resolve(themesDir, file), 'utf-8');
    for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
      const token = m[1]!;
      const ramp = token.match(/^(--color-[a-z-]+?)-\d+$/);
      families.add(ramp ? `${ramp[1]}-*` : token);
    }
  }
  return [...families].sort();
}

const ALL_CONTENT = [CSS_REFERENCE_OVERVIEW, ...Object.values(CSS_REFERENCE_SECTIONS)].join('\n');

/** Families the reference tables exhaustively, with the prose count to verify. */
const TABLED_FAMILIES = [
  { family: 'surface', section: CSS_REFERENCE_SECTIONS.surfaces },
  { family: 'text', section: CSS_REFERENCE_SECTIONS.text },
  { family: 'border', section: CSS_REFERENCE_SECTIONS.borders }
] as const;

/** Unique semantic `--color-<family>-*` cores in the CSS (scoped re-declarations collapse). */
function deriveSemanticCores(family: string): string[] {
  const css = readFileSync(semantic, 'utf-8');
  const re = new RegExp(`--color-(${family}-[a-z-]+)\\s*:`, 'g');
  const cores = new Set<string>();
  for (const m of css.matchAll(re)) cores.add(m[1]!);
  return [...cores].sort();
}

/** Intent names from the `=== X INTENT ===` section markers in the CSS — robust to
 * the multi-line `--color-neutral` definition a self-referential regex would miss. */
function deriveIntents(): string[] {
  const css = readFileSync(semantic, 'utf-8');
  const cores = new Set<string>();
  for (const m of css.matchAll(/=== ([A-Z-]+) INTENT ===/g)) cores.add(m[1]!.toLowerCase());
  return [...cores].sort();
}

describe('renderCssReference', () => {
  it('returns the overview when no section is given', () => {
    expect(renderCssReference()).toBe(CSS_REFERENCE_OVERVIEW);
  });

  it('returns the overview for an unknown section', () => {
    expect(renderCssReference('bogus')).toBe(CSS_REFERENCE_OVERVIEW);
  });

  it('returns each named section', () => {
    for (const name of CSS_REFERENCE_SECTION_NAMES) {
      expect(renderCssReference(name)).toBe(CSS_REFERENCE_SECTIONS[name]);
    }
  });

  it('advertises every section in the overview', () => {
    // Anchored to the "Available Sections" bullet form — a passing mention
    // elsewhere in the prose (e.g. a cross-reference) must not satisfy this.
    const undocumented = CSS_REFERENCE_SECTION_NAMES.filter(
      (name) => !CSS_REFERENCE_OVERVIEW.includes(`- \`${name}\` —`)
    );
    expect(
      undocumented,
      `Sections callable but missing from the overview's "Available Sections" list: ${undocumented.join(', ')}`
    ).toEqual([]);
  });
});

describe.skipIf(!themesAvailable)('theming guide covers what the shipped themes override', () => {
  /** Intent ramps are covered by naming the intent (the guide teaches the collision
   * fix by hue, not by spelling out all 11 stops); everything else must appear literally. */
  const INTENT_RAMP = /^--color-(success|warning|danger|info)-\*$/;

  it('names every token family a shipped theme overrides', () => {
    const theming = CSS_REFERENCE_SECTIONS.theming;
    const missing = deriveThemeTokenFamilies().filter((family) => {
      const intent = family.match(INTENT_RAMP)?.[1];
      if (intent) return !theming.includes(intent);
      return !theming.includes(family.replace(/-\*$/, '-'));
    });
    expect(
      missing,
      `Families a shipped theme overrides but THEMING never mentions: ${missing.join(', ')}`
    ).toEqual([]);
  });
});

describe.skipIf(!cssAvailable)('css-reference token drift guard', () => {
  for (const { family } of TABLED_FAMILIES) {
    it(`documents every semantic \`${family}-*\` token defined in the CSS`, () => {
      const missing = deriveSemanticCores(family).filter((c) => !ALL_CONTENT.includes(c));
      expect(
        missing,
        `Semantic ${family} tokens in the CSS but absent from the reference: ${missing.join(', ')}`
      ).toEqual([]);
    });
  }

  for (const { family, section } of TABLED_FAMILIES) {
    it(`states the correct ${family}-token count`, () => {
      const stated = Number(section.match(/(\d+)\s+tokens for/)?.[1]);
      expect(stated, 'prose count drifted from the real token count').toBe(
        deriveSemanticCores(family).length
      );
    });
  }

  it('names every intent defined in the CSS (base token or utility)', () => {
    const missing = deriveIntents().filter(
      (c) => !ALL_CONTENT.includes(`--color-${c}`) && !ALL_CONTENT.includes(`bg-${c}`)
    );
    expect(
      missing,
      `Intents in the CSS but absent from the reference: ${missing.join(', ')}`
    ).toEqual([]);
  });
});
