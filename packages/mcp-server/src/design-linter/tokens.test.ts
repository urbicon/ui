import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VALID_TOKEN_CORES } from './tokens.js';

/**
 * Drift guard: the hardcoded {@link VALID_TOKEN_CORES} is the mcp-server's
 * standalone copy of the design tokens. When the blocks CSS source is present
 * (i.e. running inside the monorepo) we re-derive the token cores from it and
 * assert the two agree exactly. Any token added to / removed from the CSS that
 * is not mirrored here will fail this test — keeping the hallucination detector
 * honest. The mcp-server ships without the CSS, so this can only run in-repo.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(__dirname, '..', '..', '..', 'blocks', 'src', 'lib', 'style');
const foundation = resolve(styleDir, 'foundation.css');
const semantic = resolve(styleDir, 'semantic.css');
const cssAvailable = existsSync(foundation) && existsSync(semantic);

/** Token cores that intentionally live in CSS but are NOT colour-utility cores. */
const EXCLUDED_PREFIXES = ['shadow-']; // shadows are used via `shadow-[var(--blocks-shadow-*)]`, not `bg-shadow-*`

function deriveCoresFromCss(): Set<string> {
  const cores = new Set<string>();
  for (const file of [foundation, semantic]) {
    const css = readFileSync(file, 'utf-8');
    for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
      const core = m[1]!;
      if (EXCLUDED_PREFIXES.some((p) => core.startsWith(p))) continue;
      cores.add(core);
    }
  }
  return cores;
}

describe.skipIf(!cssAvailable)('token whitelist drift guard', () => {
  it('recognises every colour token defined in the CSS (no forgotten additions)', () => {
    const cssCores = deriveCoresFromCss();
    const missing = [...cssCores].filter((c) => !VALID_TOKEN_CORES.has(c)).sort();
    expect(missing, `CSS tokens missing from VALID_TOKEN_CORES: ${missing.join(', ')}`).toEqual([]);
  });

  it('contains no phantom tokens absent from the CSS (no invented entries)', () => {
    const cssCores = deriveCoresFromCss();
    const phantom = [...VALID_TOKEN_CORES].filter((c) => !cssCores.has(c)).sort();
    expect(
      phantom,
      `Entries in VALID_TOKEN_CORES with no matching --color-* in CSS: ${phantom.join(', ')}`
    ).toEqual([]);
  });

  it('each EXCLUDED_PREFIX still matches a real CSS token (exclusion not stale)', () => {
    const css = readFileSync(foundation, 'utf-8') + readFileSync(semantic, 'utf-8');
    for (const prefix of EXCLUDED_PREFIXES) {
      expect(
        css,
        `EXCLUDED_PREFIX "${prefix}" no longer matches any --color-* token — may be stale`
      ).toMatch(new RegExp(`--color-${prefix}`));
    }
  });
});

describe('token whitelist shape', () => {
  it('includes representative tokens from each family', () => {
    for (const core of [
      'surface-base',
      'text-primary',
      'border-subtle',
      'primary',
      'primary-500',
      'feedback-success-subtle',
      'interactive-hover',
      'chart-1'
    ]) {
      expect(VALID_TOKEN_CORES.has(core), core).toBe(true);
    }
  });
});
