/**
 * `urbicon principles [--topic <t>] [--rubric]` — the design heuristics from the
 * version-pinned bundle, the local, version-correct mirror of the remote
 * `get_design_principles`. `--topic` slices one section via the shared
 * `@urbicon-ui/design-engine/reference` parser; `--rubric` prints the 8-criterion
 * 1–5 scoring rubric from `@urbicon-ui/design-engine/rubric` instead (the judge
 * step of the design loop, ignores `--topic`).
 */

import {
  extractPrincipleSection,
  PRINCIPLE_TOPICS,
  type PrincipleTopic
} from '@urbicon-ui/design-engine/reference';
import { renderRubric } from '@urbicon-ui/design-engine/rubric';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { loadPrinciplesText } from '../content.js';
import { EXIT, printError } from '../output.js';

export async function runPrinciples(_positionals: string[], flags: Flags): Promise<number> {
  if (boolFlag(flags, 'rubric')) {
    console.log(renderRubric().trim());
    console.log(
      '\n→ `urbicon validate <path>` — the deterministic correctness check that anchors criterion 8.'
    );
    return EXIT.OK;
  }

  const topic = stringFlag(flags, 'topic');
  if (topic && !PRINCIPLE_TOPICS.includes(topic as PrincipleTopic)) {
    printError(`--topic must be one of: ${PRINCIPLE_TOPICS.join(', ')}`);
    return EXIT.USAGE;
  }

  let principles: string;
  try {
    principles = await loadPrinciplesText();
  } catch (err) {
    printError(`could not read the design principles (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  if (topic) {
    const section = extractPrincipleSection(principles, topic as PrincipleTopic);
    console.log((section ?? principles).trim());
  } else {
    console.log(principles.trim());
  }

  console.log(
    '\n→ `urbicon pattern` for composition patterns · `urbicon css-reference` for token names · `urbicon principles --rubric` for the scoring rubric.'
  );
  return EXIT.OK;
}
