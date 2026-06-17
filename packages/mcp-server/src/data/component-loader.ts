import { readFile } from 'node:fs/promises';
import { getComponentLlmPath } from '../utils/paths.js';

const SEARCH_GROUPS = [
  'blocks/primitives',
  'blocks/components',
  'docs/components',
  'table',
  'auth/components'
];

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

export type LlmTxtSection = 'overview' | 'examples' | 'variants' | 'api' | 'slots';

const SECTION_HEADING_MAP: Record<string, LlmTxtSection> = {
  examples: 'examples',
  variants: 'variants',
  api: 'api',
  'slots (slotclasses keys)': 'slots'
};

export function extractSection(content: string, section: LlmTxtSection): string | null {
  if (section === 'overview') {
    const firstH3 = content.indexOf('\n### ');
    if (firstH3 === -1) return content.trim();
    return content.slice(0, firstH3).trim();
  }

  const lines = content.split('\n');
  let capturing = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      const heading = line.slice(4).trim().toLowerCase();
      const mapped = SECTION_HEADING_MAP[heading];
      if (mapped === section) {
        capturing = true;
        result.push(line);
        continue;
      } else if (capturing) {
        break;
      }
    }
    if (capturing) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join('\n').trim() : null;
}
