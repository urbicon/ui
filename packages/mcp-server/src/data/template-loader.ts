import { readFile } from 'node:fs/promises';
import { getTemplatePath } from '../utils/paths.js';

export interface TemplateSections {
  'api-grammar': string;
  'component-families': string;
  tokens: string;
  'design-quality': string;
  customization: string;
  'style-patterns': string;
  'auth-setup': string;
}

let cachedSections: TemplateSections | null = null;

function extractSection(lines: string[], startHeading: string, endMarker: string): string {
  const startIdx = lines.findIndex((l) => l.trim().startsWith(startHeading));
  if (startIdx === -1) return '';

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i]?.trim() === endMarker) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}

export async function loadTemplateSections(): Promise<TemplateSections> {
  if (cachedSections) return cachedSections;

  const templatePath = getTemplatePath();
  const raw = await readFile(templatePath, 'utf-8');
  const lines = raw.split('\n');

  cachedSections = {
    'api-grammar': extractSection(lines, '## Shared API Grammar', '---'),
    'component-families': extractSection(lines, '## Component Families', '---'),
    tokens: extractSection(lines, '## Design Token System', '---'),
    'design-quality': extractSection(lines, '## Design Quality', '---'),
    customization: extractSection(lines, '## Customization', '---'),
    'style-patterns': extractSection(lines, '## Style Patterns', '---'),
    // Auth Setup is the last section and contains no `---` rules of its own, so
    // it extracts cleanly to EOF. Its `###` stage sub-headings carry the staging.
    'auth-setup': extractSection(lines, '## Auth Setup', '---')
  };

  return cachedSections;
}

export function getCachedSections(): TemplateSections | null {
  return cachedSections;
}
