import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDesignSystemDir } from '@urbicon-ui/design-content';

export interface PatternEntry {
  name: string;
  title: string;
  description: string;
  content: string;
}

export const PRINCIPLE_TOPICS = [
  'visual-hierarchy',
  'interaction',
  'component-selection',
  'layout',
  'accessibility',
  'theming'
] as const;

export type PrincipleTopic = (typeof PRINCIPLE_TOPICS)[number];

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

    const name = file.replace(/\.md$/, '');
    const title = extractTitle(content);
    const description = extractDescription(content);

    entries.push({ name, title, description, content });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  cachedPatterns = entries;
  return entries;
}

export async function getPatternByName(name: string): Promise<PatternEntry | null> {
  const patterns = await loadPatterns();
  return patterns.find((p) => p.name === name) ?? null;
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

function extractDescription(content: string): string {
  const lines = content.split('\n');
  const titleIdx = lines.findIndex((l) => /^#\s+/.test(l));
  if (titleIdx === -1) return '';

  for (let i = titleIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '') continue;
    if (line.startsWith('#')) break;
    return line;
  }
  return '';
}

const TOPIC_HEADINGS: Record<PrincipleTopic, string> = {
  'visual-hierarchy': '## Visual Hierarchy',
  interaction: '## Interaction',
  'component-selection': '## Component Selection',
  layout: '## Layout',
  accessibility: '## Accessibility',
  theming: '## Theming'
};

export function extractPrincipleSection(content: string, topic: PrincipleTopic): string | null {
  const heading = TOPIC_HEADINGS[topic];
  if (!heading) return null;

  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]!)) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}
