import { readFile } from 'node:fs/promises';
import { getComponentLlmPath } from '@urbicon-ui/design-content';

const SEARCH_GROUPS = [
  'blocks/primitives',
  'blocks/components',
  'docs/components',
  'table',
  'auth/components'
];

/**
 * Read a component's `llm.txt` by slug, probing each search group in order
 * (blocks primitives/components, docs, table, auth). Returns `null` only when
 * the file is absent (ENOENT) in *every* group — a genuine "unknown component".
 * Any other I/O error (permissions, corrupt mount) is rethrown rather than
 * masked as not-found.
 *
 * @param slug - Kebab-case component slug (e.g. `date-picker`).
 * @returns The raw llm.txt, or `null` if no group has it.
 */
export async function loadComponentLlmTxt(slug: string): Promise<string | null> {
  for (const group of SEARCH_GROUPS) {
    const path = getComponentLlmPath(group, slug);
    try {
      return await readFile(path, 'utf-8');
    } catch (err) {
      // Read-tolerant: "not in this group" (file absent) → try the next group.
      // Anything else (permission, corrupt mount, …) is a real fault we must
      // not mask as "component not found" — surface it.
      if ((err as { code?: string }).code === 'ENOENT') continue;
      throw err;
    }
  }
  // Absent in every group: a genuine "unknown component". The caller turns this
  // null into a clear not-found message rather than a thrown error.
  return null;
}

// The section parser lives in the engine now (DESIGN-MCP-V2 §5) so this server and
// the `urbicon` CLI extract llm.txt sections identically. Re-exported here for the
// server's local importers (get-component, get-recipe, …).
export { extractSection, type LlmTxtSection } from '@urbicon-ui/design-engine/search';
