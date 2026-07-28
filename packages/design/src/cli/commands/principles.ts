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

export async function runPrinciples(positionals: string[], flags: Flags): Promise<number> {
  if (boolFlag(flags, 'rubric')) {
    console.log(renderRubric().trim());
    console.log(
      '\n→ `urbicon validate <path>` — the deterministic correctness check that anchors criterion 8.'
    );
    return EXIT.OK;
  }

  // A positional topic is accepted alongside --topic, because that is what agents
  // reach for: `urbicon principles separation` used to print the whole 19 kB
  // bundle and exit 0, so a made-up topic looked like an answer (measured — the
  // model then grepped the command list to work out what had happened). Same
  // shape as `--query` on find/icons: one way in, given once.
  const flagTopic = stringFlag(flags, 'topic');
  const positionalTopic = positionals[0];
  if (flagTopic !== undefined && positionalTopic !== undefined) {
    printError('give the topic once — either positionally or via --topic, not both.');
    return EXIT.USAGE;
  }
  if (positionals.length > 1) {
    printError(`a topic is one word — got "${positionals.join(' ')}".`);
    return EXIT.USAGE;
  }
  const topic = flagTopic ?? positionalTopic;
  if (topic && !PRINCIPLE_TOPICS.includes(topic as PrincipleTopic)) {
    printError(`unknown topic "${topic}". Available: ${PRINCIPLE_TOPICS.join(', ')}`);
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
    if (!section) {
      // Fail loud: a known topic whose section is missing from the bundle is a
      // packaging fault. Falling back to the full text would answer a question
      // nobody asked with 10× the bytes — the failure this command just fixed.
      printError(`the principles bundle has no "${topic}" section.`);
      return EXIT.FAIL;
    }
    console.log(section.trim());
  } else {
    console.log(principles.trim());
  }

  console.log(
    '\n→ `urbicon pattern` for composition patterns · `urbicon css-reference` for token names · `urbicon principles --rubric` for the scoring rubric.'
  );
  return EXIT.OK;
}
