import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDesignSystemDir } from '@urbicon-ui/design-content';
import { type PatternEntry, parsePatternEntry } from '@urbicon-ui/design-engine/reference';

// Parsing lives in the engine (shared with the `urbicon` CLI's `principles`/`pattern`
// commands, so local and remote slice the same files identically); this loader owns
// only the server-side I/O + caching.
export {
  extractPrincipleSection,
  type PatternEntry,
  PRINCIPLE_TOPICS,
  type PrincipleTopic
} from '@urbicon-ui/design-engine/reference';

let cachedPrinciples: string | null = null;
let cachedPatterns: PatternEntry[] | null = null;

export async function loadPrinciples(): Promise<string> {
  if (cachedPrinciples !== null) return cachedPrinciples;

  const filePath = resolve(getDesignSystemDir(), 'principles.md');
  try {
    cachedPrinciples = await readFile(filePath, 'utf-8');
  } catch {
    cachedPrinciples = '';
  }
  return cachedPrinciples;
}

export async function loadPatterns(): Promise<PatternEntry[]> {
  if (cachedPatterns) return cachedPatterns;

  const patternsDir = resolve(getDesignSystemDir(), 'patterns');
  const entries: PatternEntry[] = [];

  let files: string[];
  try {
    files = await readdir(patternsDir);
  } catch {
    cachedPatterns = [];
    return [];
  }

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = resolve(patternsDir, file);
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    entries.push(parsePatternEntry(file.replace(/\.md$/, ''), content));
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  cachedPatterns = entries;
  return entries;
}

export async function getPatternByName(name: string): Promise<PatternEntry | null> {
  const patterns = await loadPatterns();
  return patterns.find((p) => p.name === name) ?? null;
}
