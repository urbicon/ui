/**
 * `urbicon context` — print the project's design.manifest.md (paradigm / theme /
 * density, pattern usages, recorded ADRs). The CLI replacement for the
 * remote-incompatible `get_design_context` MCP tool. Read-only; always exits 0.
 *
 * Also the staleness check for the `urbicon init` context block: context is step 1
 * of the design loop, so an appended "the block no longer matches the installed
 * template" note is the one place an agent reliably sees it — and can fix it by
 * re-running `init`. Quiet when no block is found (harnesses may inject the block
 * content into their system prompt instead) and when the template is unreadable.
 */

import { readFile } from 'node:fs/promises';
import type { DesignManifest } from '@urbicon-ui/design-engine/manifest';
import { emptyManifest, formatContext, parseManifest } from '@urbicon-ui/design-engine/manifest';
import {
  blockRegion,
  blockVersion,
  currentBlockBodies,
  scanAgentsFiles,
  stripBlockStamp
} from '../agents-block.js';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { readHistory, resolveManifestPath } from '../manifest-io.js';
import { EXIT } from '../output.js';
import { readPackageVersion } from '../package-root.js';

interface ContextBlockState {
  /** Directory-entry name of the file carrying the block (AGENTS.md / CLAUDE.md). */
  file: string;
  /** Version stamped into the block, or null for an unstamped (e.g. hand-pasted) block. */
  version: string | null;
  installed: string;
  /**
   * Content-based: the block body no longer matches what the installed template
   * renders (stamp ignored). NOT a version comparison — a patch release that
   * leaves the template untouched stays quiet, and a verbatim hand-paste of the
   * current template is current despite carrying no stamp.
   */
  stale: boolean;
}

/** The init-managed context block in `cwd`, or null when none is found. */
async function checkContextBlock(cwd: string): Promise<ContextBlockState | null> {
  const carrier = (await scanAgentsFiles(cwd)).find((f) => f.hasBlock);
  if (!carrier) return null;
  const version = blockVersion(carrier.content);
  const installed = await readPackageVersion();
  let stale: boolean;
  try {
    const region = blockRegion(carrier.content);
    stale = region === null || !(await currentBlockBodies()).includes(stripBlockStamp(region));
  } catch {
    // Template unreadable (broken install) — we cannot judge, so we do not warn.
    stale = false;
  }
  return { file: carrier.name, version, installed, stale };
}

function staleNote(block: ContextBlockState): string {
  const installed = block.installed === 'unknown' ? '' : ` (installed: v${block.installed})`;
  const age =
    block.version && block.version !== block.installed
      ? `was written by urbicon v${block.version}${installed}`
      : `no longer matches the installed CLI's template${installed}`;
  return `> ⚠ The ${block.file} context block ${age} — run \`bunx urbicon init\` to refresh it.`;
}

export async function runContext(_positionals: string[], flags: Flags): Promise<number> {
  const path = resolveManifestPath(stringFlag(flags, 'manifest'));

  let manifest: DesignManifest;
  try {
    manifest = parseManifest(await readFile(path, 'utf-8'));
  } catch {
    manifest = emptyManifest();
  }
  const history = await readHistory(path);
  const contextBlock = await checkContextBlock(process.cwd());

  if (boolFlag(flags, 'json')) {
    console.log(JSON.stringify({ ...manifest, history, contextBlock }, null, 2));
    return EXIT.OK;
  }

  let text = formatContext(manifest, history);
  if (!manifest.exists) {
    text +=
      `\n\n> No manifest at \`${path}\`. Create one with \`urbicon sync-manifest\` ` +
      'or record the first decision with `urbicon record-decision`.';
  }
  if (contextBlock?.stale) {
    text += `\n\n${staleNote(contextBlock)}`;
  }
  console.log(text);
  return EXIT.OK;
}
