import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CSS_REFERENCE_OVERVIEW,
  CSS_REFERENCE_SECTION_ALIASES,
  CSS_REFERENCE_SECTION_NAMES,
  CSS_REFERENCE_SECTIONS,
  renderCssReference,
  resolveCssReferenceSection
} from './css-reference.js';
import { OVERRIDE_CASCADE } from './override-ladder.js';
import { INFORMATIVE_RAMP, SEMANTIC_TOKENS } from './semantic-tokens.js';

/**
 * The reference's token tables render from `semantic-tokens.gen.ts`, which
 * `tokens:reference:check` (and `scripts/semantic-tokens-parse.test.ts`) holds
 * equal to the blocks CSS — so the tests here ask the data for the properties
 * the prose promises, not the prose for a token count. The theming and
 * typography claims below are still authored, and still measured against the
 * blocks source when it is present.
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
const themesDir = resolve(semantic, '..', 'themes');
const themesAvailable = existsSync(themesDir);

const blocksLib = resolve(semantic, '..', '..');
const blocksLibAvailable = existsSync(blocksLib);

/** Every non-test .ts/.svelte under blocks/src/lib — the source the docs measure. */
function blocksSourceFiles(dir = blocksLib): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...blocksSourceFiles(full));
      continue;
    }
    if (!/\.(ts|svelte)$/.test(entry.name)) continue;
    if (/\.(test|spec)\./.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

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

/** Families the reference tables one row per token, and the section each renders into. */
const TABLED_FAMILIES = [
  { family: 'surface', section: CSS_REFERENCE_SECTIONS.surfaces },
  { family: 'text', section: CSS_REFERENCE_SECTIONS.text },
  { family: 'border', section: CSS_REFERENCE_SECTIONS.borders }
] as const;

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

  it('resolves an alias to its section', () => {
    for (const [alias, section] of Object.entries(CSS_REFERENCE_SECTION_ALIASES)) {
      expect(resolveCssReferenceSection(alias)).toBe(section);
      expect(renderCssReference(alias)).toBe(CSS_REFERENCE_SECTIONS[section]);
    }
  });

  it('keeps aliases out of the canonical section list', () => {
    // The list drives `--help` and the MCP enum: an alias listed there would read
    // as a section of its own and promise text that does not exist separately.
    const leaked = Object.keys(CSS_REFERENCE_SECTION_ALIASES).filter((alias) =>
      (CSS_REFERENCE_SECTION_NAMES as readonly string[]).includes(alias)
    );
    expect(leaked, `Aliases that are also canonical sections: ${leaked.join(', ')}`).toEqual([]);
  });

  it('points every alias at text that actually covers it', () => {
    // The alias exists because the content is hard to find, not to redirect
    // anywhere plausible — if `z-index` moves out of `shadows`, this must fail.
    // Hyphens are stripped on both sides so `zindex` matches the "Z-Index" heading.
    const flatten = (s: string) => s.toLowerCase().replace(/-/g, '');
    const empty = Object.entries(CSS_REFERENCE_SECTION_ALIASES).filter(
      ([alias, section]) => !flatten(CSS_REFERENCE_SECTIONS[section]).includes(flatten(alias))
    );
    expect(
      empty.map(([alias]) => alias),
      `Aliases whose target section never mentions them: ${empty.map(([a]) => a).join(', ')}`
    ).toEqual([]);
  });

  it('still fails to resolve a genuine typo', () => {
    expect(resolveCssReferenceSection('bogus')).toBeUndefined();
  });

  it('states the override cascade through the shared sentence, not a paraphrase of it', () => {
    // The primer prints the same constant; a theming section that reworded the
    // chain could put the two bundled statements of one order in disagreement.
    expect(CSS_REFERENCE_SECTIONS.theming).toContain(OVERRIDE_CASCADE);
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

describe.skipIf(!blocksLibAvailable)('typography reach claims match the blocks source', () => {
  /**
   * The TYPOGRAPHY table tells agents which size token moves which components, so a
   * wrong attribution steers generated overrides at the wrong end of the scale. It
   * shipped `--text-2xs` as "dense Calendar chrome" while over half that token's call
   * sites are outside Calendar — measured before the tokenisation sweep landed.
   *
   * Method mirrors /customization/tokens: word-bounded utility occurrences across
   * every .ts/.svelte under blocks/src/lib, excluding tests.
   */
  const SUB_XS = ['--text-3xs', '--text-2xs'] as const;

  /** Components using `utility`, by their directory name under primitives/ or components/. */
  function componentsUsing(utility: string): Map<string, number> {
    const pattern = new RegExp(`\\b${utility}\\b`, 'g');
    const byComponent = new Map<string, number>();
    for (const file of blocksSourceFiles()) {
      const hits = readFileSync(file, 'utf-8').match(pattern)?.length ?? 0;
      if (hits === 0) continue;
      const owner = file.match(/\/(?:primitives|components)\/([^/]+)\//)?.[1];
      if (!owner) continue; // engine/internal files carry no component name
      byComponent.set(owner, (byComponent.get(owner) ?? 0) + hits);
    }
    return byComponent;
  }

  /** The "Reach in the library" cell for a variable's row. */
  function reachCell(variable: string): string {
    const row = CSS_REFERENCE_SECTIONS.typography
      .split('\n')
      .find((line) => line.startsWith(`| \`${variable}\``));
    if (!row) throw new Error(`no TYPOGRAPHY row for ${variable}`);
    return row.split('|').at(-2) ?? '';
  }

  for (const variable of SUB_XS) {
    const utility = variable.replace('--', '');

    it(`${variable}: every component it names really uses the token`, () => {
      const users = componentsUsing(utility);
      const cell = reachCell(variable);
      const named = [...users.keys()].concat(['Dialog', 'Tooltip', 'Table']);
      const misattributed = named.filter((c) => cell.includes(c) && !users.has(c));
      expect(
        misattributed,
        `TYPOGRAPHY credits ${misattributed.join(', ')} with ${variable}, but they never use ${utility}.`
      ).toEqual([]);
    });

    it(`${variable}: names every component that leans on it`, () => {
      // A major user the cell omits is how "dense Calendar chrome" happened: the
      // token read as Calendar-only while 8 of its 15 sites were elsewhere.
      const users = componentsUsing(utility);
      const cell = reachCell(variable);
      const unnamedMajor = [...users.entries()]
        .filter(([, hits]) => hits >= 2)
        .map(([component]) => component)
        .filter((component) => !cell.includes(component));
      expect(
        unnamedMajor,
        `Components with 2+ ${utility} sites that the reach cell never mentions: ${unnamedMajor.join(', ')}`
      ).toEqual([]);
    });
  }

  it('--text-2xs is no longer described as Calendar-only', () => {
    const users = componentsUsing('text-2xs');
    const total = [...users.values()].reduce((a, b) => a + b, 0);
    const calendar = users.get('Calendar') ?? 0;
    expect(calendar, 'Calendar should still be the heaviest single user').toBeGreaterThan(0);
    expect(calendar * 2, 'Calendar is a minority of --text-2xs sites').toBeLessThan(total);
    expect(reachCell('--text-2xs')).not.toBe(' library-added, size-only; dense Calendar chrome ');
  });
});

describe('generated token tables', () => {
  for (const { family, section } of TABLED_FAMILIES) {
    it(`renders a row for every ${family} token and states their count`, () => {
      const tokens = SEMANTIC_TOKENS.families[family];
      expect(tokens.length).toBeGreaterThan(0);
      const missing = tokens.filter((t) => !section.includes(`| \`--color-${t.name}\` |`));
      expect(
        missing.map((t) => t.name),
        `${family} tokens in the data without a table row`
      ).toEqual([]);
      expect(section).toContain(`${tokens.length} tokens for`);
    });

    it(`resolves every ${family} branch to a stop or a literal`, () => {
      for (const t of SEMANTIC_TOKENS.families[family]) {
        for (const side of ['light', 'dark'] as const) {
          const stop = t[side];
          expect(stop.ref !== undefined || stop.raw !== undefined, `${t.name} ${side}`).toBe(true);
        }
      }
    });
  }

  it('keeps the informative ramp monotonic in lightness', () => {
    const byName = new Map(SEMANTIC_TOKENS.families.text.map((t) => [t.name, t]));
    const rungs = INFORMATIVE_RAMP.map((name) => {
      const token = byName.get(name);
      if (!token) throw new Error(`no text token ${name}`);
      return token;
    });
    for (let i = 1; i < rungs.length; i++) {
      const above = rungs[i - 1]!;
      const rung = rungs[i]!;
      // Light mode: every rung strictly lighter than the one above it — the
      // inversion a consumer produced by lightening tertiary past quaternary
      // (#402) is exactly what this refuses.
      expect(rung.light.l, `${rung.name} lighter than ${above.name} (light)`).toBeGreaterThan(
        above.light.l!
      );
      // Dark mode: never darker than the rung above; a tie is allowed because
      // secondary and tertiary share neutral-300 there.
      expect(rung.dark.l, `${rung.name} not darker than ${above.name} (dark)`).toBeLessThanOrEqual(
        above.dark.l!
      );
    }
    expect(CSS_REFERENCE_SECTIONS.text).toContain('| `text-tertiary` |');
  });

  it('marks text-quaternary as mark-only, never body text', () => {
    const role = SEMANTIC_TOKENS.families.text.find((t) => t.name === 'text-quaternary')?.role;
    expect(role).toMatch(/mark-only/i);
    expect(role).toMatch(/never use it for body text/i);
    expect(CSS_REFERENCE_SECTIONS.text).toContain(role);
  });

  it('keeps surface-subtle a resting tint, never a hover step', () => {
    const role = SEMANTIC_TOKENS.families.surface.find((t) => t.name === 'surface-subtle')?.role;
    expect(role).toMatch(/resting/i);
    expect(role).toMatch(/never a hover step/i);
  });

  it('carries every role for every intent, or states why not', () => {
    const { roles, entries, absent } = SEMANTIC_TOKENS.intents;
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      for (const { suffix } of roles) {
        const stated = absent.some((a) => a.intent === entry.name && a.suffix === suffix);
        expect(
          entry.stops[suffix] !== undefined || stated,
          `${entry.name} has no -${suffix} and no @absent reason`
        ).toBe(true);
      }
      expect(CSS_REFERENCE_SECTIONS.intents).toContain(`| \`${entry.name}\` |`);
    }
    for (const a of absent) expect(CSS_REFERENCE_SECTIONS.intents).toContain(a.reason);
  });

  it('documents the three intent roles #207 asked for', () => {
    const role = (suffix: string) =>
      SEMANTIC_TOKENS.intents.roles.find((r) => r.suffix === suffix)?.role ?? '';
    expect(role('base')).toMatch(/fill/i);
    expect(role('text')).toMatch(/AA 4\.5/);
    expect(role('emphasis')).toMatch(/near-ink/i);
    expect(SEMANTIC_TOKENS.intents.absent).toContainEqual(
      expect.objectContaining({ intent: 'neutral', suffix: 'text' })
    );
  });
});
