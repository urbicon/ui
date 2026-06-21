/**
 * Filesystem glue for the manifest subcommands. The engine
 * (`@urbicon-ui/design-engine/manifest`) is pure string/scan logic; the CLI owns
 * path resolution and read/write — the consumer-side replacement for the
 * remote-incompatible `process.cwd()` manifest resolution the MCP server used to
 * carry (removed when those tools moved to this CLI).
 *
 * Paths default relative to the current working directory (the consumer's repo
 * when they run `urbicon` or a hook fires). Unlike the MCP write tools — which
 * containment-check an LLM-supplied path — the CLI trusts its `--manifest`/`--src`
 * flags: the agent running the local CLI is the consumer's own (the trust model
 * of the package-centric architecture). The only guard kept is the `.md`
 * extension check at the call sites, so a typo never clobbers a code file.
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ValidationHistoryEntry } from '@urbicon-ui/design-engine/manifest';
import {
  createManifestTemplate,
  parseHistory,
  parseManifest
} from '@urbicon-ui/design-engine/manifest';

/** Resolve the manifest path from `--manifest`, defaulting to ./design.manifest.md. */
export function resolveManifestPath(flag: string | undefined): string {
  return resolve(flag ?? 'design.manifest.md');
}

/** Resolve the scan root from `--src`, defaulting to ./src. */
export function resolveSourceDir(flag: string | undefined): string {
  return resolve(flag ?? 'src');
}

/** The sidecar validation-history path for a manifest (`*.md` → `*.history.ndjson`). */
export function resolveHistoryPath(manifestPath: string): string {
  return manifestPath.endsWith('.md')
    ? `${manifestPath.slice(0, -'.md'.length)}.history.ndjson`
    : `${manifestPath}.history.ndjson`;
}

/**
 * The project's declared token overrides, read from the manifest best-effort.
 * Any failure — no manifest, unreadable, malformed — yields `[]`: validation must
 * never break because the manifest is absent or odd (read tolerant). This is the
 * local, manifest-sourced feed for the linter's `extraTokens` (DESIGN-MCP-V2 §7,
 * resolving F-S4-1) — the on-disk counterpart to the remote `validate_design`'s
 * `extraTokens` parameter.
 */
export async function readTokenOverrides(manifestPath: string): Promise<string[]> {
  try {
    return parseManifest(await readFile(manifestPath, 'utf-8')).tokenOverrides;
  } catch {
    return [];
  }
}

/** Read the sidecar validation history, best-effort (`[]` when absent/unreadable). */
export async function readHistory(manifestPath: string): Promise<ValidationHistoryEntry[]> {
  try {
    return parseHistory(await readFile(resolveHistoryPath(manifestPath), 'utf-8'));
  } catch {
    return [];
  }
}

/** Append one ndjson line to the sidecar history (creates the file on first write). */
export function appendHistory(manifestPath: string, line: string): Promise<void> {
  return appendFile(resolveHistoryPath(manifestPath), `${line}\n`, 'utf-8');
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
