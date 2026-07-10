/**
 * Pure parsing helpers for the design-system knowledge files the content bundle
 * ships (`design-system/principles.md` + `design-system/patterns/*.md`). Shared by
 * the `urbicon` CLI (`principles` / `pattern`) and the remote MCP server
 * (`get_design_principles` / `get_pattern`) so both slice the same files
 * identically. Pure and dependency-free; consumers own the file I/O.
 */

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
    if (/^## /.test(lines[i] ?? '')) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}

/** Build a catalog entry from one pattern file: title = first `#` heading, description = the first prose line after it. */
export function parsePatternEntry(name: string, content: string): PatternEntry {
  return {
    name,
    title: extractTitle(content),
    description: extractDescription(content),
    content
  };
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
    const line = lines[i]?.trim();
    if (!line) continue;
    if (line.startsWith('#')) break;
    return line;
  }
  return '';
}
