import { describe, expect, it } from 'vitest';
import { MAX_RUBRIC_SCORE, RUBRIC_CRITERIA, renderRubric } from './rubric.js';

describe('rubric criteria', () => {
  it('keeps the eight A/B-test criteria', () => {
    expect(RUBRIC_CRITERIA).toHaveLength(8);
    expect(MAX_RUBRIC_SCORE).toBe(40);
  });

  it('has unique ids and complete anchors', () => {
    const ids = new Set(RUBRIC_CRITERIA.map((c) => c.id));
    expect(ids.size).toBe(RUBRIC_CRITERIA.length);
    for (const c of RUBRIC_CRITERIA) {
      expect(c.name).toBeTruthy();
      expect(c.measures).toBeTruthy();
      for (const score of [1, 3, 5] as const) {
        expect(c.anchors[score], `${c.id} anchor ${score}`).toBeTruthy();
      }
    }
  });

  it('anchors technical correctness on validate_design', () => {
    const correctness = RUBRIC_CRITERIA.find((c) => c.id === 'correctness');
    expect(correctness?.anchors[5]).toContain('validate_design');
  });
});

describe('renderRubric', () => {
  const md = renderRubric();

  it('renders every criterion and the total', () => {
    for (const c of RUBRIC_CRITERIA) expect(md).toContain(c.name);
    expect(md).toContain(`/${MAX_RUBRIC_SCORE}`);
  });

  it('tells the judge to run validate_design first', () => {
    expect(md).toContain('validate_design');
  });

  it('describes the panel-of-lenses approach for variant selection', () => {
    expect(md.toLowerCase()).toContain('lens');
  });
});
