import { describe, expect, it } from 'vitest';
import { lintDesign } from './linter.js';
import { knownRuleIds } from './suppress.js';
import type { Finding } from './types.js';

function has(findings: Finding[], ruleId: string): boolean {
  return findings.some((f) => f.ruleId === ruleId);
}

describe('urbicon-ignore pragma (file-scoped exemption)', () => {
  it('suppresses exactly the listed rules, leaving others intact', () => {
    const code =
      '<!-- urbicon-ignore raw-tailwind-color — deliberate poster colour -->\n' +
      '<div class="bg-blue-500 z-50">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'raw-tailwind-color')).toBe(false);
    expect(has(report.findings, 'hardcoded-z-index')).toBe(true); // not listed → still fires
  });

  it('surfaces suppressions in the report instead of swallowing them', () => {
    const code =
      '<!-- urbicon-ignore raw-tailwind-color -->\n' +
      '<div class="bg-blue-500">a</div>\n<div class="bg-red-500">b</div>';
    const report = lintDesign(code);
    expect(report.suppressed).toEqual([
      { ruleId: 'raw-tailwind-color', count: 2, source: 'pragma' }
    ]);
    // Suppressed findings do not count or score.
    expect(report.counts.error).toBe(0);
    expect(report.scores.correctness).toBe(100);
  });

  it('reports a declared-but-unused suppression with count 0 (stale-pragma signal)', () => {
    const code = '<!-- urbicon-ignore inline-style -->\n<div class="p-4">x</div>';
    expect(lintDesign(code).suppressed).toEqual([
      { ruleId: 'inline-style', count: 0, source: 'pragma' }
    ]);
  });

  it('can suppress craft heuristics (poster surfaces)', () => {
    const code =
      '<!-- urbicon-ignore magic-dimension — poster swatch grid -->\n' +
      '<div class="h-[30px] w-[30px]">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(false);
    expect(report.suppressed?.[0]?.ruleId).toBe('magic-dimension');
    expect(report.scores.craft).toBe(100);
  });

  it('accepts multiple ids and an em-dash reason; the reason is never parsed as ids', () => {
    const code =
      '<!-- urbicon-ignore magic-dimension inline-style — deliberate poster-scope styling -->\n' +
      '<div class="h-[30px]" style="color: red">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(false);
    expect(has(report.findings, 'inline-style')).toBe(false);
    expect(has(report.findings, 'invalid-suppression')).toBe(false); // reason words ≠ unknown ids
  });

  it('supports // and /* */ pragma forms for TS input', () => {
    const code =
      '// urbicon-ignore raw-tailwind-color — fixture data\n' + "const c = 'bg-blue-500';";
    const report = lintDesign(code, { filename: 'fixture.ts' });
    expect(has(report.findings, 'raw-tailwind-color')).toBe(false);
    expect(report.suppressed?.[0]?.count).toBe(1);
  });

  it('an empty pragma is a loud warning, not a blanket off-switch', () => {
    const code = '<!-- urbicon-ignore -->\n<div class="bg-blue-500">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'invalid-suppression')).toBe(true);
    expect(has(report.findings, 'raw-tailwind-color')).toBe(true); // nothing suppressed
  });

  it('an unknown rule id is a loud warning and suppresses nothing', () => {
    const code = '<!-- urbicon-ignore raw-tailwind-colour -->\n<div class="bg-blue-500">x</div>';
    const report = lintDesign(code);
    const warn = report.findings.find((f) => f.ruleId === 'invalid-suppression');
    expect(warn?.severity).toBe('warning');
    expect(warn?.match).toBe('raw-tailwind-colour');
    expect(has(report.findings, 'raw-tailwind-color')).toBe(true);
  });
});

/**
 * The comment boundary itself. Every case here fails as a *missing* signal — a
 * suppression that quietly does not apply, or one that quietly applies to the
 * wrong pragma — so none of them announce themselves without a test.
 */
describe('urbicon-ignore pragma boundaries', () => {
  it('matches when the reason names a tag', () => {
    // The reported case: the body used to be `[^>]*?`, so the `<h3>` ended it and
    // the pragma stopped matching — while reading as a perfectly good suppression.
    const code =
      '<!-- urbicon-ignore magic-dimension — all eight are `<h3>`: the hierarchy\n' +
      '     is carried by the `<Section>` h2 above them. -->\n' +
      '<div class="h-[30px]">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(false);
    expect(has(report.findings, 'invalid-suppression')).toBe(false);
    expect(report.suppressed).toEqual([{ ruleId: 'magic-dimension', count: 1, source: 'pragma' }]);
  });

  it('matches when the reason contains a bare `>`', () => {
    const code =
      '<!-- urbicon-ignore inline-style — the swatch maps value => colour, a > b -->\n' +
      '<div style="color: red">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'inline-style')).toBe(false);
    expect(report.suppressed).toEqual([{ ruleId: 'inline-style', count: 1, source: 'pragma' }]);
  });

  it('reads the same comment extent as the mask when a body holds a `<!--`', () => {
    // HTML comments do not nest: the first `-->` ends the comment, so the second
    // `<!-- urbicon-ignore` here is reason prose inside the first one, not a
    // pragma. The mask blanks exactly this span, and lifting `raw-tailwind-color`
    // out of it would turn masked prose into a file-wide exemption — a
    // suppression widening itself, which is the direction this module forbids.
    const code = [
      '<!-- urbicon-ignore magic-dimension — the hero art is measured, not tokenised',
      '<!-- urbicon-ignore raw-tailwind-color — swatch table below is fixture data -->',
      '<div class="h-[30px]">x</div>',
      '<div class="bg-blue-500">swatch</div>'
    ].join('\n');
    const report = lintDesign(code);
    expect(report.suppressed).toEqual([{ ruleId: 'magic-dimension', count: 1, source: 'pragma' }]);
    expect(has(report.findings, 'raw-tailwind-color')).toBe(true); // never exempted from prose
  });

  it('an unterminated pragma with no closer at all suppresses nothing', () => {
    const code =
      '<!-- urbicon-ignore magic-dimension — no closer anywhere\n<div class="h-[30px]">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(true);
    expect(report.suppressed).toBeUndefined();
  });

  it('ends on `--!>`, the comment end the mask already honours', () => {
    const code = '<!-- urbicon-ignore magic-dimension --!>\n<div class="h-[30px]">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(false);
    expect(report.suppressed).toEqual([{ ruleId: 'magic-dimension', count: 1, source: 'pragma' }]);
  });

  it('a reason may quote the pragma syntax it documents', () => {
    // The house form written out in a reason — which this repo's doc pages invite.
    // A boundary rule that stopped at the quoted `<!--` would cost the file both
    // its suppression and a spurious `invalid-suppression` warning.
    const code =
      '<!-- urbicon-ignore magic-dimension — the house form is `<!-- urbicon-ignore … -->`,\n' +
      '     see the linter docs. -->\n' +
      '<div class="h-[30px]">x</div>';
    const report = lintDesign(code);
    expect(has(report.findings, 'magic-dimension')).toBe(false);
    expect(has(report.findings, 'invalid-suppression')).toBe(false);
    expect(report.suppressed).toEqual([{ ruleId: 'magic-dimension', count: 1, source: 'pragma' }]);
  });
});

/** The `/* … *\/` flavour, which had no coverage at all. */
describe('urbicon-ignore pragma (block-comment flavour)', () => {
  it('suppresses from a block comment', () => {
    const code =
      '/* urbicon-ignore raw-tailwind-color — fixture data */\n' + "const c = 'bg-blue-500';";
    const report = lintDesign(code, { filename: 'fixture.ts' });
    expect(has(report.findings, 'raw-tailwind-color')).toBe(false);
    expect(report.suppressed).toEqual([
      { ruleId: 'raw-tailwind-color', count: 1, source: 'pragma' }
    ]);
  });

  it('a reason may contain a `/*`, which block comments do not treat as an opener', () => {
    // Legal, warning-free TS: block comments do not nest, so this is one comment
    // and one well-formed pragma — `maskBlockComments` blanks exactly this span.
    const code =
      '/* urbicon-ignore raw-tailwind-color — the emitter writes a leading /* marker */\n' +
      "const c = 'bg-blue-500';";
    const report = lintDesign(code, { filename: 'fixture.ts' });
    expect(has(report.findings, 'raw-tailwind-color')).toBe(false);
    expect(report.suppressed).toEqual([
      { ruleId: 'raw-tailwind-color', count: 1, source: 'pragma' }
    ]);
  });
});

describe('suppressRules option (the manifest ## Exempt channel)', () => {
  it('suppresses like a pragma, tagged with source "option"', () => {
    const report = lintDesign('<div class="bg-blue-500">x</div>', {
      suppressRules: ['raw-tailwind-color']
    });
    expect(has(report.findings, 'raw-tailwind-color')).toBe(false);
    expect(report.suppressed).toEqual([
      { ruleId: 'raw-tailwind-color', count: 1, source: 'option' }
    ]);
  });

  it('an unknown id via the option warns loudly (typo in the manifest)', () => {
    const report = lintDesign('<div class="p-4">x</div>', { suppressRules: ['not-a-rule'] });
    expect(has(report.findings, 'invalid-suppression')).toBe(true);
  });

  it('invalid-suppression itself is not a suppressible id', () => {
    expect(knownRuleIds().has('invalid-suppression')).toBe(false);
  });
});

describe('known rule ids', () => {
  it('covers deterministic rules and heuristics', () => {
    const ids = knownRuleIds();
    for (const id of ['raw-tailwind-color', 'token-hallucination', 'api-hallucination']) {
      expect(ids.has(id), id).toBe(true);
    }
    for (const id of ['magic-dimension', 'heading-skip', 'touch-target-small']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('HEURISTIC_RULE_IDS stays in sync with what runHeuristics can emit', async () => {
    // Trip a broad set of heuristics and assert every emitted id is registered —
    // guards the suppression universe against a new heuristic being forgotten.
    const { HEURISTIC_RULE_IDS } = await import('./heuristics.js');
    const code = [
      '<div style="font-family: Arial; color: red">',
      '<h1 class="bg-clip-text transition-all !p-0">A</h1><h4>B</h4>',
      '<button class="h-6 transition-[width] w-[317px]">🚀</button>',
      '<p class="text-center text-justify">Lorem ipsum dolor sit amet</p>',
      '</div>'
    ].join('\n');
    const emitted = lintDesign(code)
      .findings.filter((f) => f.kind === 'heuristic')
      .map((f) => f.ruleId);
    expect(emitted.length).toBeGreaterThan(5);
    for (const id of emitted) {
      expect(HEURISTIC_RULE_IDS, id).toContain(id);
    }
  });
});
