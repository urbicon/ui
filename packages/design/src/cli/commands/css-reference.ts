/**
 * `urbicon css-reference [section]` — the CSS design-token reference, the local,
 * version-correct mirror of the remote `get_css_reference`. The text is the shared
 * `@urbicon-ui/design-engine/reference` content (drift-guarded against the real
 * blocks CSS in-repo), so local and remote answers agree. No section prints the
 * overview with the naming conventions and the dark-mode mechanism.
 */

import {
  CSS_REFERENCE_SECTION_NAMES,
  renderCssReference
} from '@urbicon-ui/design-engine/reference';
import type { Flags } from '../args.js';
import { EXIT, printError } from '../output.js';

export async function runCssReference(positionals: string[], _flags: Flags): Promise<number> {
  const section = positionals[0];
  if (
    section &&
    !CSS_REFERENCE_SECTION_NAMES.includes(section as (typeof CSS_REFERENCE_SECTION_NAMES)[number])
  ) {
    printError(
      `unknown section "${section}". Available: ${CSS_REFERENCE_SECTION_NAMES.join(', ')}`
    );
    return EXIT.USAGE;
  }

  console.log(renderCssReference(section).trim());
  return EXIT.OK;
}
