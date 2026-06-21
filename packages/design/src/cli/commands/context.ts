/**
 * `urbicon context` — print the project's design.manifest.md (paradigm / theme /
 * density, pattern usages, recorded ADRs). The CLI replacement for the
 * remote-incompatible `get_design_context` MCP tool. Read-only; always exits 0.
 */

import { readFile } from 'node:fs/promises';
import type { DesignManifest } from '@urbicon-ui/design-engine/manifest';
import { emptyManifest, formatContext, parseManifest } from '@urbicon-ui/design-engine/manifest';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { readHistory, resolveManifestPath } from '../manifest-io.js';
import { EXIT } from '../output.js';

export async function runContext(_positionals: string[], flags: Flags): Promise<number> {
  const path = resolveManifestPath(stringFlag(flags, 'manifest'));

  let manifest: DesignManifest;
  try {
    manifest = parseManifest(await readFile(path, 'utf-8'));
  } catch {
    manifest = emptyManifest();
  }
  const history = await readHistory(path);

  if (boolFlag(flags, 'json')) {
    console.log(JSON.stringify({ ...manifest, history }, null, 2));
    return EXIT.OK;
  }

  let text = formatContext(manifest, history);
  if (!manifest.exists) {
    text +=
      `\n\n> No manifest at \`${path}\`. Create one with \`urbicon sync-manifest\` ` +
      'or record the first decision with `urbicon record-decision`.';
  }
  console.log(text);
  return EXIT.OK;
}
