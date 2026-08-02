/**
 * The design-quality scoring rubric — the qualitative half of the design loop
 * (docs/internal/DESIGN-MCP.md, step 3). Where `validate_design` answers "is it correct?"
 * deterministically, the rubric answers "is it good?" through a judge.
 *
 * The eight criteria have been validated empirically against design-quality
 * comparisons, scoring each 1–5 and summing to /40. Keeping the same instrument
 * means new evaluations are directly comparable to that baseline. This is the
 * SINGLE SOURCE for the criteria: the
 * `get_design_principles(as="rubric")` tool renders it to Markdown, and the
 * eval-suite (WP5) imports the same constants to score programmatically.
 *
 * REVISED 2026-08-02 (`radius`, `ux`, plus the linter reference). Scores taken
 * before and after that date are NOT comparable on those two axes — any delta
 * has to have both of its sides judged under one version. The revision came out
 * of reading the rubric against the library it judges (docs/internal,
 * DESIGN-EVAL-2026-08/RUBRIK-AUDIT.md):
 *
 * - `radius` rewarded a per-element ladder ("hero > standard > compact" via
 *   `class`) — which is what the design system's own anti-pattern forbids, since
 *   the library decides shape by component *family* (`--radius-commit`/`-modify`/
 *   `-contain`). A page that used the system correctly could not score above 2.
 *   The anchors now measure whether shape *reads* as decided, and treat the
 *   mechanism as what it is: the tier for the decision, a per-surface class only
 *   for the optical exception.
 *
 *   Two drafts of that anchor smuggled in concentric-corner logic ("the outer box
 *   must not be the tighter"), which condemns the library's own default — a pill
 *   Button inside a 2px Card — and with it every quieter voicing of the same
 *   ranking (`commit: lg` over `contain: sm`). The tiers rank *roles*, not
 *   nesting: actions softest, fields between, containers tightest. What the
 *   anchor asks now is only whether a reader can state the rule.
 * - `ux` was named "Pattern Originality" but was, in practice, scored on whether
 *   the patterns work (an action with no handler capped runs far more often than
 *   a lack of invention did). The name and anchors now say that.
 */

export interface RubricCriterion {
  id: string;
  /** Display name for the criterion. */
  name: string;
  /** One line on what the criterion measures. */
  measures: string;
  /** Anchored descriptions for scores 1, 3 and 5 (the judge interpolates 2 and 4). */
  anchors: { 1: string; 3: string; 5: string };
}

export const RUBRIC_CRITERIA: readonly RubricCriterion[] = [
  {
    id: 'distinctiveness',
    name: 'Design Language Distinctiveness',
    measures: 'Whether the page has its own visual identity or reads as a generic template.',
    anchors: {
      1: 'The most common layout imaginable — a Tailwind-UI starter with no personality.',
      3: 'A few custom touches (one heading style, one composition) over conventional bones.',
      5: 'A coherent, deliberate identity: custom compositions over default components, a consistent typographic voice, signature moments.'
    }
  },
  {
    id: 'color',
    name: 'Color Scheme Coherence',
    measures: 'Whether colour carries meaning or merely decorates.',
    anchors: {
      1: 'Decorative colour — a rainbow of intents; intent colours where neutral belongs.',
      3: 'Intent mapping mostly correct, but some decorative or noisy colour remains.',
      5: 'Neutral surfaces dominate (80–90%); intent colour appears only for genuine status, severity, or action.'
    }
  },
  {
    id: 'spacing',
    name: 'Spacing Consistency',
    measures: 'Whether spacing expresses hierarchy.',
    anchors: {
      1: 'One uniform rhythm everywhere (e.g. all `space-y-6`).',
      3: 'Some variation, but no clear within-vs-between system.',
      5: 'A clear two-tier rhythm (tight within items, generous between sections), with data-driven variation where it helps.'
    }
  },
  {
    id: 'radius',
    name: 'Radius & Shape Language',
    measures: 'Whether shape reads as decided — across component families, not per element.',
    anchors: {
      1: 'Shape reads as accident: the family defaults are left where they fell and their tension is never resolved — pill controls against near-square containers, on surfaces too small for a hairline edge to read as an edge at all.',
      3: 'A decision exists but you cannot state its rule — one family retuned while the others keep values that no longer relate to it, or one-off `rounded-*` on individual elements that disagree with the components beside them.',
      5: 'One legible shape system across the page: actions, fields and containers each read as themselves, and the ranking between them is one a reader could state. Reached either by composing the defaults so the contrast is intentional, or by retuning the tier tokens (`--radius-commit`/`-modify`/`-contain`) together. Note that in this system the inner element is normally the rounder one — a pill control inside a hairline-edged container is the design, not an inversion; a project may re-order that deliberately, but then carries it everywhere. A per-surface radius appears only for the optical exception (a small tinted tile, a panel under a pill trigger) and is obvious as such.'
    }
  },
  {
    id: 'ux',
    name: 'UX Pattern Quality',
    measures: 'Whether interaction patterns go beyond the textbook — and whether they work.',
    anchors: {
      1: 'Textbook only — divider lists, stacked buttons, defaults throughout — or patterns that exist in the markup but do not function (an action with no handler, a link that goes nowhere, a callback never passed down).',
      3: 'A few genuine UX touches (a thoughtful empty state, a useful affordance), with the primary paths wired and working.',
      5: 'Creative, effective patterns that serve the content — original compositions, state-driven layout — and every affordance the page offers does what it promises.'
    }
  },
  {
    id: 'hierarchy',
    name: 'Visual Hierarchy',
    measures: 'Whether the eye is guided to what matters.',
    anchors: {
      1: 'Everything equally weighted — nothing dominates; labels compete with data.',
      3: 'Some dominance, but flat regions remain.',
      5: 'Each section has one clearly dominant element; metadata is recessed; visual weight tracks importance.'
    }
  },
  {
    id: 'cohesion',
    name: 'Overall Design Cohesion',
    measures: 'Whether the page reads as one designed artifact.',
    anchors: {
      1: 'Cohesive only through sameness, or parts feel grafted on / disconnected.',
      3: 'Mostly unified, with a section or two that drift.',
      5: 'A single design DNA — consistent radius, typographic voice, and component logic tie the whole page together.'
    }
  },
  {
    id: 'correctness',
    name: 'Technical Correctness',
    measures: 'Whether the code is valid and uses real component APIs and design tokens.',
    anchors: {
      1: 'Hallucinated tokens, broken dynamic classes, or wrong component APIs — would not render as intended.',
      3: 'Largely correct with a few token or API slips.',
      5: 'Valid semantic tokens, correct Svelte 5 and component APIs, no broken classes. Anchor this with the design linter (`urbicon validate`, or the `validate_design` tool) — a passing linter (0 errors/warnings) puts this at 4–5.'
    }
  }
];

export const MAX_RUBRIC_SCORE = RUBRIC_CRITERIA.length * 5;

/** Render the rubric as Markdown for a judge (served by `get_design_principles(as="rubric")`). */
export function renderRubric(): string {
  let md = '# Design-Quality Rubric\n\n';
  md += `Score a generated UI on each of the ${RUBRIC_CRITERIA.length} criteria from **1 to 5**, then sum to **/${MAX_RUBRIC_SCORE}**. `;
  md +=
    'For every score, cite specific evidence from the code (a class, a component, a layout choice) — a number without a reason is not a judgement.\n\n';
  md +=
    '**Before scoring, run the design linter on the code** (`urbicon validate`, or the `validate_design` tool). It deterministically catches the ';
  md +=
    'correctness failures (hallucinated tokens, broken dynamic classes) that a judge tends to miss, and it anchors the *Technical Correctness* criterion.\n\n';

  for (const [i, c] of RUBRIC_CRITERIA.entries()) {
    md += `## ${i + 1}. ${c.name}\n\n`;
    md += `*${c.measures}*\n\n`;
    md += `- **1** — ${c.anchors[1]}\n`;
    md += `- **3** — ${c.anchors[3]}\n`;
    md += `- **5** — ${c.anchors[5]}\n\n`;
  }

  md += '---\n\n';
  md += '## Using the rubric\n\n';
  md +=
    '- **As a single judge:** score all criteria, sum to /' +
    MAX_RUBRIC_SCORE +
    ', and list the two lowest as the concrete revision targets.\n';
  md +=
    '- **As a panel (recommended for variant selection):** run one judge per *lens* — correctness, hierarchy, paradigm-fidelity, distinctiveness — rather than N identical judges. Diversity of lens catches failures redundancy cannot.\n';
  md +=
    '- **For N variants:** score each, pick the winner, then graft the best ideas from the runners-up before a final linter pass.\n';
  md +=
    "- **Judge the surfaces the author designed.** A route that is a shipped block used as intended (an auth screen rendered by the library's own `LoginPage`, a settings composite) is correct use of the system, not an identity failure — name it in the rationale and score *Distinctiveness* on what the author actually composed.\n";
  md +=
    '- **Reward deviation within the rules.** A safe, generic page should not outscore a distinctive one that stays inside the paradigm. Penalise AI-slop sameness on *Distinctiveness* and *UX Pattern Quality*.\n';
  return md;
}
