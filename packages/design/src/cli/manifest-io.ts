/**
 * Filesystem glue for the manifest subcommands. The engine
 * (`@urbicon-ui/design-engine/manifest`) is pure string/scan logic; the CLI owns
 * path resolution and read/write — the consumer-side replacement for the
 * remote-incompatible `process.cwd()` dance in the MCP server's `utils/paths.ts`.
 *
 * Paths default relative to the current working directory (the consumer's repo
 * when they run `urbicon` or a hook fires). Unlike the MCP write tools — which
 * containment-check an LLM-supplied path — the CLI trusts its `--manifest`/`--src`
 * flags: the agent running the local CLI is the consumer's own (the trust model
 * of the package-centric architecture). The only guard kept is the `.md`
 * extension check at the call sites, so a typo never clobbers a code file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createManifestTemplate } from '@urbicon-ui/design-engine/manifest';

/** Resolve the manifest path from `--manifest`, defaulting to ./design.manifest.md. */
export function resolveManifestPath(flag: string | undefined): string {
  return resolve(flag ?? 'design.manifest.md');
}

/** Resolve the scan root from `--src`, defaulting to ./src. */
export function resolveSourceDir(flag: string | undefined): string {
  return resolve(flag ?? 'src');
}

/** Read the manifest, or synthesise an empty template when it does not exist yet. */
export async function readOrCreateManifest(
  path: string
): Promise<{ content: string; created: boolean }> {
  try {
    return { content: await readFile(path, 'utf-8'), created: false };
  } catch {
    return { content: createManifestTemplate({}), created: true };
  }
}

export function writeManifest(path: string, content: string): Promise<void> {
  return writeFile(path, content, 'utf-8');
}
