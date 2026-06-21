import { describe, expect, it } from 'vitest';
import { lintDesign } from './linter.js';

/** ruleIds present in a lint of `code`. */
function ruleIds(code: string): string[] {
  return lintDesign(code).findings.map((f) => f.ruleId);
}
function apiFindings(code: string) {
  return lintDesign(code).findings.filter((f) => f.ruleId === 'api-hallucination');
}

describe('api-hallucination (F-J)', () => {
  it('flags a foreign prop name and suggests the real one', () => {
    const f = apiFindings('<Button tone="primary">Go</Button>');
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe('warning');
    expect(f[0]!.kind).toBe('deterministic'); // scores against correctness, not slop
    expect(f[0]!.match).toBe('tone');
    expect(f[0]!.fix).toContain('intent');
    expect(f[0]!.line).toBe(1);
  });

  it('flags the shadcn `variant="outline"` spelling', () => {
    const f = apiFindings('<Button variant="outline">Go</Button>');
    expect(f).toHaveLength(1);
    expect(f[0]!.match).toBe('variant="outline"');
    expect(f[0]!.fix).toContain('outlined');
  });

  it('catches a foreign boolean prop and a shorthand prop', () => {
    expect(apiFindings('<Button isLoading>Go</Button>')[0]?.fix).toContain('loading');
    expect(apiFindings('<Button {isDisabled} />')[0]?.fix).toContain('disabled');
  });

  it('does NOT flag a valid per-component value (variant="solid" is real on Tab)', () => {
    // The proof that the value map is global-safe-only: `solid` is a real Tab variant,
    // so it must never be flagged. (Per-component validation is deferred to the catalog.)
    expect(apiFindings('<Tab variant="solid">x</Tab>')).toEqual([]);
  });

  it('does not flag valid Urbicon usage', () => {
    expect(
      apiFindings('<Button intent="primary" variant="outlined" size="md">Go</Button>')
    ).toEqual([]);
  });

  it('only fires on Urbicon components, not raw HTML or third-party components', () => {
    expect(apiFindings('<div tone="x">y</div>')).toEqual([]);
    expect(apiFindings('<MyButton tone="x">y</MyButton>')).toEqual([]);
  });

  it('only flags value confusions on string literals, not expressions', () => {
    // `variant={outline}` passes a JS variable named `outline` — not the bad literal.
    expect(apiFindings('<Button variant={outline}>x</Button>')).toEqual([]);
  });

  it('ignores usages inside comments (masked before the scan)', () => {
    expect(ruleIds('<!-- <Button tone="x">y</Button> -->')).not.toContain('api-hallucination');
  });

  it('deducts from the correctness axis', () => {
    const report = lintDesign('<Button tone="primary">Go</Button>');
    expect(report.scores.correctness).toBeLessThan(100);
  });
});
