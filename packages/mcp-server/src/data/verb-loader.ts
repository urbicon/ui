import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getVerbsDir } from '@urbicon-ui/design-content';

/**
 * Loads design-verb recipes from the version-pinned content bundle
 * (`@urbicon-ui/design-content/content/verbs/`). The recipes are the single source
 * the local skill ships and these remote prompts serve — same text, two channels
 * (DESIGN-MCP-V2 §8). Cached per process; read tolerant (a missing file yields the
 * empty string, so one absent recipe never breaks server construction — the prompt
 * wrapper degrades to a rebuild hint instead).
 */

const cache = new Map<string, string>();

/** Load one verb recipe body by name (e.g. `compose`), trimmed. `''` when absent. */
export async function loadVerb(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  let body = '';
  try {
    body = (await readFile(resolve(getVerbsDir(), `${name}.md`), 'utf-8')).trim();
  } catch {
    body = '';
  }
  cache.set(name, body);
  return body;
}
