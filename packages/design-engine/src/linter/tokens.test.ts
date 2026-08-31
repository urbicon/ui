import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isSingleEditApart,
  resolveValidTokenCores,
  suggestIntentTypo,
  VALID_TOKEN_CORES
} from './tokens.js';

/**
 * Drift guard: the hardcoded {@link VALID_TOKEN_CORES} is the design-engine's
 * standalone copy of the design tokens. When the blocks CSS source is present
 * (i.e. running inside the monorepo) we re-derive the token cores from it and
 * assert the two agree exactly. Any token added to / removed from the CSS that
 * is not mirrored here will fail this test — keeping the hallucination detector
 * honest. The design-engine ships without the CSS, so this can only run in-repo.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const styleDir = resolve(__dirname, '..', '..', '..', 'blocks', 'src', 'lib', 'style');
const foundation = resolve(styleDir, 'foundation.css');
const semantic = resolve(styleDir, 'semantic.css');
const cssAvailable = existsSync(foundation) && existsSync(semantic);

/** Every `--color-*` key IS a colour-utility core — the namespace carries
 *  nothing else, so nothing is filtered out on the way in. */
function deriveCoresFromCss(): Set<string> {
  const cores = new Set<string>();
  for (const file of [foundation, semantic]) {
    const css = readFileSync(file, 'utf-8');
    for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
      cores.add(m[1]!);
    }
  }
  return cores;
}

describe.skipIf(!cssAvailable)('token whitelist drift guard', () => {
  it('recognises every colour token defined in the CSS (no forgotten additions)', () => {
    const cssCores = deriveCoresFromCss();
    const missing = [...cssCores].filter((c) => !VALID_TOKEN_CORES.has(c)).sort();
    // Two repairs, and the wrong one is the tempting one: a NON-colour that
    // landed in `--color-*` (a shadow list, a length) belongs in another
    // namespace, not in this whitelist — adding it here mints a `bg-`/`text-`
    // spelling for a value that is invalid as a colour (#368).
    expect(
      missing,
      `--color-* tokens in the CSS that VALID_TOKEN_CORES does not list: ${missing.join(', ')}\n` +
        'Either add the core here (it is a colour), or move the key out of the ' +
        '--color-* namespace (it is not).'
    ).toEqual([]);
  });

  it('contains no phantom tokens absent from the CSS (no invented entries)', () => {
    const cssCores = deriveCoresFromCss();
    const phantom = [...VALID_TOKEN_CORES].filter((c) => !cssCores.has(c)).sort();
    expect(
      phantom,
      `Entries in VALID_TOKEN_CORES with no matching --color-* in CSS: ${phantom.join(', ')}`
    ).toEqual([]);
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

describe('resolveValidTokenCores', () => {
  it('returns the built-in set by reference when there are no extras (no allocation)', () => {
    expect(resolveValidTokenCores()).toBe(VALID_TOKEN_CORES);
    expect(resolveValidTokenCores([])).toBe(VALID_TOKEN_CORES);
  });

  it('merges extra cores on top of the built-in whitelist', () => {
    const resolved = resolveValidTokenCores(['surface-brand', 'primary-vivid']);
    expect(resolved.has('surface-brand')).toBe(true);
    expect(resolved.has('primary-vivid')).toBe(true);
    expect(resolved.has('surface-base'), 'built-ins still present').toBe(true);
  });

  it('normalises input — trims surrounding whitespace and drops blanks', () => {
    const resolved = resolveValidTokenCores(['  surface-brand  ', '', '   ']);
    expect(resolved.has('surface-brand')).toBe(true);
    expect(resolved.has('')).toBe(false);
  });

  it('treats an all-blank list as no extras (built-in set by reference)', () => {
    expect(resolveValidTokenCores(['', '  '])).toBe(VALID_TOKEN_CORES);
  });

  it('never mutates the shared built-in set', () => {
    const before = VALID_TOKEN_CORES.size;
    resolveValidTokenCores(['surface-brand']);
    expect(VALID_TOKEN_CORES.size).toBe(before);
    expect(VALID_TOKEN_CORES.has('surface-brand')).toBe(false);
  });
});

describe('isSingleEditApart', () => {
  it('detects single substitutions, insertions, deletions, and adjacent transpositions', () => {
    expect(isSingleEditApart('primay', 'primary')).toBe(true); // insertion
    expect(isSingleEditApart('primaryy', 'primary')).toBe(true); // deletion
    expect(isSingleEditApart('prinary', 'primary')).toBe(true); // substitution
    expect(isSingleEditApart('priamry', 'primary')).toBe(true); // transposition
  });
  it('rejects identical strings and edits of distance ≥ 2', () => {
    expect(isSingleEditApart('primary', 'primary')).toBe(false);
    expect(isSingleEditApart('brand', 'primary')).toBe(false);
    expect(isSingleEditApart('prmiarx', 'primary')).toBe(false); // two edits
  });
});

describe('suggestIntentTypo', () => {
  it('maps a one-edit misspelling to the intended intent', () => {
    expect(suggestIntentTypo('primay')).toBe('primary');
    expect(suggestIntentTypo('sucess')).toBe('success');
    expect(suggestIntentTypo('wraning')).toBe('warning'); // transposition
  });
  it('returns null for exact intents, hyphenated cores, and unrelated words', () => {
    expect(suggestIntentTypo('primary')).toBeNull(); // exact intent, not a typo
    expect(suggestIntentTypo('primary-subtle')).toBeNull(); // hyphenated — left to whitelist
    expect(suggestIntentTypo('brand')).toBeNull(); // far from every intent
    expect(suggestIntentTypo('cover')).toBeNull();
  });
});
