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
    measures: 'Whether shape is a deliberate choice.',
    anchors: {
      1: 'Zero radius intent — component defaults only, no shape strategy.',
      3: 'Some radius use, but inconsistent (mixed methods, no hierarchy).',
      5: 'A deliberate radius hierarchy (e.g. hero > standard > compact) applied consistently via `class`/`slotClasses`.'
    }
  },
  {
    id: 'ux',
    name: 'UX Pattern Originality',
    measures: 'Whether interaction patterns go beyond the textbook.',
    anchors: {
      1: 'Textbook only — divider lists, stacked buttons, defaults throughout.',
      3: 'A few genuine UX touches (a thoughtful empty state, a useful affordance).',
      5: 'Creative, effective patterns that serve the content — original compositions, state-driven layout.'
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
      5: 'Valid semantic tokens, correct Svelte 5 and component APIs, no broken classes. Anchor this with `validate_design` — a passing linter (0 errors/warnings) puts this at 4–5.'
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
  md += '**Before scoring, run `validate_design` on the code.** It deterministically catches the ';
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
    '- **For N variants:** score each, pick the winner, then graft the best ideas from the runners-up before a final `validate_design` pass.\n';
  md +=
    '- **Reward deviation within the rules.** A safe, generic page should not outscore a distinctive one that stays inside the paradigm. Penalise AI-slop sameness on *Distinctiveness* and *UX Pattern Originality*.\n';
  return md;
}
