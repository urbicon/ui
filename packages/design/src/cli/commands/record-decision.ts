/**
 * `urbicon record-decision` — append an ADR to design.manifest.md so a deliberate
 * deviation survives future sessions. The CLI replacement for the
 * remote-incompatible `record_design_decision` MCP tool (it writes the
 * consumer's filesystem). Creates the manifest if missing.
 */

import {
  appendDecision,
  matchDecisionTitles,
  parseManifest,
  supersedeDecision
} from '@urbicon-ui/design-engine/manifest';
import { type Flags, stringFlag } from '../args.js';
import { readOrCreateManifest, resolveManifestPath, writeManifest } from '../manifest-io.js';
import { EXIT, printError } from '../output.js';

const STATUSES = new Set(['accepted', 'proposed', 'superseded']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Quote a list of recorded titles for an error message, newest first, capped. */
function listTitles(titles: string[]): string {
  const shown = titles.slice(0, 10).map((t) => `"${t}"`);
  const more = titles.length > shown.length ? `, … (${titles.length - shown.length} more)` : '';
  return shown.length > 0 ? `${shown.join(', ')}${more}` : 'none recorded yet';
}

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

  const supersedes = stringFlag(flags, 'supersedes');
  if (supersedes !== undefined && supersedes.trim() === '') {
    printError('--supersedes needs the title of the decision this one replaces');
    return EXIT.USAGE;
  }

  const { content, created } = await readOrCreateManifest(path);

  // Resolve the superseded entry before anything is written: an unknown title must
  // fail loud, not leave a new ADR claiming to replace something that is not there.
  let base = content;
  let superseded: string | undefined;
  if (supersedes !== undefined) {
    const titles = parseManifest(content).decisions.map((d) => d.title);
    const matches = matchDecisionTitles(titles, supersedes);
    if (matches.length !== 1 || matches[0] === undefined) {
      printError(
        matches.length > 1
          ? `--supersedes "${supersedes}" matches ${matches.length} recorded decisions — titles must be unique to link them.`
          : `--supersedes "${supersedes}" matches no recorded decision in ${path}. Recorded: ${listTitles(titles)}.`
      );
      return EXIT.USAGE;
    }
    superseded = matches[0];
    base = supersedeDecision(content, superseded, title);
    if (superseded !== supersedes) {
      // Say which entry it landed on, like `css-reference` does for an alias.
      console.error(`· "${supersedes}" is the recorded decision "${superseded}"`);
    }
  }

  const updated = appendDecision(base, {
    date,
    title,
    status,
    decision,
    rationale: stringFlag(flags, 'rationale'),
    supersedes: superseded
  });

  try {
    await writeManifest(path, updated);
  } catch (err) {
    printError(`failed to write ${path}: ${(err as Error).message}`);
    return EXIT.FAIL;
  }

  const total = parseManifest(updated).decisions.length;
  console.log(
    `Recorded ADR "${title}" (${date}) in ${path}${created ? ' (created the manifest)' : ''}` +
      `${superseded ? `, superseding "${superseded}"` : ''}. ` +
      `${total} decision(s) on record.`
  );
  return EXIT.OK;
}
