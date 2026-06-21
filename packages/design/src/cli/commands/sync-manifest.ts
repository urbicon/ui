/**
 * `urbicon sync-manifest` — scan the source tree for `data-design-pattern="…"`
 * markers and regenerate the Pattern Usages index in design.manifest.md. The CLI
 * replacement for the remote-incompatible `sync_design_manifest` MCP tool. This
 * is what makes a pattern change tractable: grep the markers, migrate every
 * listed file. Creates the manifest if missing.
 */

import { dirname } from 'node:path';
import { scanMarkers, upsertUsagesSection } from '@urbicon-ui/design-engine/manifest';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import {
  readOrCreateManifest,
  resolveManifestPath,
  resolveSourceDir,
  writeManifest
} from '../manifest-io.js';
import { EXIT, printError } from '../output.js';

export async function runSyncManifest(_positionals: string[], flags: Flags): Promise<number> {
  const path = resolveManifestPath(stringFlag(flags, 'manifest'));
  if (!path.endsWith('.md')) {
    printError(`refusing to write: "${path}" is not a .md file`);
    return EXIT.USAGE;
  }
  const src = resolveSourceDir(stringFlag(flags, 'src'));

  // Files are recorded relative to the manifest's directory, so the index stays portable.
  const usages = await scanMarkers(src, dirname(path));
  const { content, created } = await readOrCreateManifest(path);
  const updated = upsertUsagesSection(content, usages);

  try {
    await writeManifest(path, updated);
  } catch (err) {
    printError(`failed to write ${path}: ${(err as Error).message}`);
    return EXIT.FAIL;
  }

  const byPattern = new Map<string, number>();
  for (const usage of usages) byPattern.set(usage.pattern, (byPattern.get(usage.pattern) ?? 0) + 1);

  if (boolFlag(flags, 'json')) {
    console.log(JSON.stringify({ manifest: path, created, scanned: src, usages }, null, 2));
    return EXIT.OK;
  }

  let text = `Synced ${path}${created ? ' (created it)' : ''} — scanned ${src}, ${usages.length} marker(s)`;
  if (byPattern.size > 0) {
    const summary = [...byPattern]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([pattern, n]) => `${pattern} (${n})`)
      .join(', ');
    text += ` across ${byPattern.size} pattern(s): ${summary}.`;
  } else {
    text += '. No markers yet — add data-design-pattern="<name>" to pattern-following pages.';
  }
  console.log(text);
  return EXIT.OK;
}
