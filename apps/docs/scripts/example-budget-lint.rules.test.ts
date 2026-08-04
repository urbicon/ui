import { describe, expect, it } from 'vitest';
import {
  blankQuotedMarkup,
  countBySection,
  isCounted,
  oversizedSections,
  sectionTags,
  UNCOUNTED,
  verdictFor
} from './example-budget-lint.rules';

const TAGS = ['Section'];

/** A page shape: sections in order, each with n examples. */
function page(...sections: [string, number][]): string {
  return sections
    .map(
      ([id, n]) => `<Section id="${id}">${'<CodeExample title="x" isolate />'.repeat(n)}</Section>`
    )
    .join('\n');
}

describe('blankQuotedMarkup', () => {
  /**
   * The trap this whole lint stands on. A `code={`…`}` prop containing a
   * newline escape ends the naive `` /`[^`]*`/ `` match at the wrong backtick,
   * and the blanking then eats the markup that follows — which on a docs page
   * is the next real Section.
   */
  it('does not run past a template literal containing an escape', () => {
    const src = 'A `let s = "a\\nb"` B <Section id="examples"><CodeExample /></Section>';
    const blanked = blankQuotedMarkup(src);
    expect(blanked).toContain('<Section id="examples">');
    expect(blanked).toHaveLength(src.length);
  });

  it('blanks a quoted <CodeExample> so prose is not counted as an example', () => {
    const src = '<Section id="examples">`<CodeExample />`<CodeExample /></Section>';
    expect(countBySection(src, TAGS)).toEqual([{ id: 'examples', examples: 1 }]);
  });

  it('does not count a commented-out example', () => {
    const src = '<Section id="examples"><!-- <CodeExample /> --><CodeExample /></Section>';
    expect(countBySection(src, TAGS)).toEqual([{ id: 'examples', examples: 1 }]);
  });
});

describe('sectionTags', () => {
  it('resolves an aliased Section import rather than guessing from the tag name', () => {
    const src = "import { Section as SectionComponent } from '@urbicon-ui/docs';";
    expect(sectionTags(src)).toContain('SectionComponent');
  });

  it('does not adopt a blocks component that merely ends in Section', () => {
    const src = "import { MenuSection } from '@urbicon-ui/blocks';";
    expect(sectionTags(src)).toEqual(['Section']);
  });
});

describe('countBySection', () => {
  it('attributes each example to the section it sits in', () => {
    expect(countBySection(page(['examples', 3], ['customization', 2]), TAGS)).toEqual([
      { id: 'examples', examples: 3 },
      { id: 'customization', examples: 2 }
    ]);
  });
});

describe('what counts', () => {
  it('leaves customization and installation out of the budget', () => {
    for (const id of ['customization', 'installation', 'api', 'types']) {
      expect(UNCOUNTED.has(id)).toBe(true);
      expect(isCounted(id)).toBe(false);
    }
  });

  /**
   * The positive control for the decision this lint had to make on its own.
   *
   * The case is Button's real shape before the 2026-08 sweep: one example in
   * `examples` and four in `mint`. Counting `mint` separately reports the page
   * as UNDER budget — which is exactly how a page carrying five examples got
   * filed as a coverage gap.
   */
  it('counts a standalone mint section against the budget (guide rule 6)', () => {
    const buttonBefore = page(['examples', 1], ['mint', 4], ['customization', 4]);
    const { total, verdict } = verdictFor(countBySection(buttonBefore, TAGS));
    expect(total).toBe(5);
    expect(verdict).toBe('over');
  });

  it('would have called that same page under budget if mint were excluded', () => {
    const examplesOnly = countBySection(page(['examples', 1], ['customization', 4]), TAGS);
    expect(verdictFor(examplesOnly).verdict).toBe('under');
  });

  /**
   * The rule has TWO live subjects and the first version of it only matched
   * one. `checkbox` writes `id="mint"`, `segment-group` writes `id="mints"`,
   * and matching the literal `'mint'` let the plural through: 4 examples plus a
   * Mint section of 1 is over budget, and the gate written to catch exactly
   * that certified the page clean.
   *
   * This is also why the "no live subject, so the rule is untestable in
   * anger" framing was wrong — the subject existed, the matcher just missed it.
   */
  it.each(['mint', 'mints', 'Mints'])('counts a Mint section spelled "%s"', (id) => {
    expect(isCounted(id)).toBe(true);
    expect(verdictFor(countBySection(page(['examples', 4], [id, 1]), TAGS)).verdict).toBe('over');
  });
});

describe('verdictFor', () => {
  it.each([
    [1, 'under'],
    [2, 'ok'],
    [4, 'ok'],
    [5, 'over']
  ])('%i examples → %s', (n, expected) => {
    expect(verdictFor(countBySection(page(['examples', n as number]), TAGS)).verdict).toBe(
      expected
    );
  });

  it('reports a page with no examples section as missing, not as under budget', () => {
    const guideShaped = page(['setup', 1], ['panel', 3], ['tour', 2]);
    expect(verdictFor(countBySection(guideShaped, TAGS)).verdict).toBe('missing');
  });
});

describe('oversizedSections', () => {
  /**
   * badge's real shape: 3 in `examples`, 5 under `patterns` — titled "1. Status
   * Tag", "2. Counter", … — while the page reported 3 and clean. The counted
   * set was a two-value whitelist, so every other id was silently free.
   */
  it('catches a topical section larger than the whole page budget', () => {
    const badgeShaped = countBySection(page(['examples', 3], ['patterns', 5]), TAGS);
    expect(oversizedSections(badgeShaped).map((s) => s.id)).toEqual(['patterns']);
    // The page total itself is still inside the budget — which is precisely why
    // the section had to be checked separately rather than added to the total.
    expect(verdictFor(badgeShaped).verdict).toBe('ok');
  });

  it('leaves the legitimate one- and two-demo deep dives alone', () => {
    const combobox = countBySection(page(['examples', 4], ['async-search', 1]), TAGS);
    expect(oversizedSections(combobox)).toEqual([]);
  });

  it('never flags reference sections, however many snippets they carry', () => {
    const counts = countBySection(page(['examples', 3], ['customization', 9]), TAGS);
    expect(oversizedSections(counts)).toEqual([]);
  });

  /**
   * The `NO_EXAMPLES` entry for `components/guide` justifies itself with a
   * per-section property ("no single section exceeds the budget"). If the
   * exemption skipped the page wholesale, that written reason and the executed
   * check would be two different statements — so the ceiling applies to
   * exempted pages too, and this is the shape it has to catch.
   */
  it('still checks sections on a page with no examples section at all', () => {
    const guideGrown = countBySection(page(['setup', 1], ['panel', 9], ['tour', 2]), TAGS);
    expect(verdictFor(guideGrown).verdict).toBe('missing');
    expect(oversizedSections(guideGrown).map((s) => s.id)).toEqual(['panel']);
  });
});
