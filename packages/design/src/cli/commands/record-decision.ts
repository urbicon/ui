/**
 * `urbicon record-decision` — append an ADR to design.manifest.md so a deliberate
 * deviation survives future sessions. The CLI replacement for the
 * remote-incompatible `record_design_decision` MCP tool (it writes the
 * consumer's filesystem). Creates the manifest if missing.
 */

import { appendDecision, parseManifest } from '@urbicon-ui/design-engine/manifest';
import { type Flags, stringFlag } from '../args.js';
import { readOrCreateManifest, resolveManifestPath, writeManifest } from '../manifest-io.js';
import { EXIT, printError } from '../output.js';

const STATUSES = new Set(['accepted', 'proposed', 'superseded']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function runRecordDecision(_positionals: string[], flags: Flags): Promise<number> {
  const title = stringFlag(flags, 'title');
  const decision = stringFlag(flags, 'decision');
  if (!title || !decision) {
    printError('record-decision requires --title and --decision');
    return EXIT.USAGE;
  }

  const status = stringFlag(flags, 'status') ?? 'accepted';
  if (!STATUSES.has(status)) {
    printError(`invalid --status "${status}" (accepted | proposed | superseded)`);
    return EXIT.USAGE;
  }

  const date = stringFlag(flags, 'date') ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) {
    printError(`invalid --date "${date}" (expected YYYY-MM-DD)`);
    return EXIT.USAGE;
  }

  const path = resolveManifestPath(stringFlag(flags, 'manifest'));
  if (!path.endsWith('.md')) {
    printError(`refusing to write: "${path}" is not a .md file`);
    return EXIT.USAGE;
  }

  const { content, created } = await readOrCreateManifest(path);
  const updated = appendDecision(content, {
    date,
    title,
    status,
    decision,
    rationale: stringFlag(flags, 'rationale')
  });

  try {
    await writeManifest(path, updated);
  } catch (err) {
    printError(`failed to write ${path}: ${(err as Error).message}`);
    return EXIT.FAIL;
  }

  const total = parseManifest(updated).decisions.length;
  console.log(
    `Recorded ADR "${title}" (${date}) in ${path}${created ? ' (created the manifest)' : ''}. ` +
      `${total} decision(s) on record.`
  );
  return EXIT.OK;
}
