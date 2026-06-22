/**
 * Slice a named section out of a component's `llm.txt` — the `### …` blocks that
 * `docs-gen` emits (Examples, Variants, API, Slots), plus a synthetic `overview`
 * (everything before the first `###`). Pure string logic so `get_component` (remote)
 * and `urbicon get-component` (CLI) extract identically; each consumer owns the I/O
 * (locating and reading the file). Returns `null` when the section is absent.
 */

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
