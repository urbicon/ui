/**
 * `urbicon css-reference [section]` — the CSS design-token reference, the local,
 * version-correct mirror of the remote `get_css_reference`. The text is the shared
 * `@urbicon-ui/design-engine/reference` content (drift-guarded against the real
 * blocks CSS in-repo), so local and remote answers agree. No section prints the
 * overview with the naming conventions and the dark-mode mechanism.
 */

import {
  CSS_REFERENCE_SECTION_NAMES,
  renderCssReference,
  resolveCssReferenceSection
} from '@urbicon-ui/design-engine/reference';
import type { Flags } from '../args.js';
import { EXIT, printError } from '../output.js';

export async function runCssReference(positionals: string[], _flags: Flags): Promise<number> {
  const section = positionals[0];
  if (section) {
    const resolved = resolveCssReferenceSection(section);
    if (!resolved) {
      printError(
        `unknown section "${section}". Available: ${CSS_REFERENCE_SECTION_NAMES.join(', ')}`
      );
      return EXIT.USAGE;
    }
    // An alias answers instead of failing, but says which section it landed on —
    // otherwise the caller learns nothing and asks the wrong name again next time.
    if (resolved !== section)
      console.error(`· "${section}" is part of the \`${resolved}\` section`);
  }

  console.log(renderCssReference(section).trim());
  return EXIT.OK;
}
