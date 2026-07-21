import { readFile } from 'node:fs/promises';
import { getTemplatePath } from '@urbicon-ui/design-content';

/**
 * The six guide sections carved out of the single template document, keyed by
 * guide id. Each value is the raw markdown of one `## …` section; the keys are
 * the ids the guide resources ({@link registerGuideResources}) expose. The auth
 * guide is deliberately NOT here — it is a canonical package guide served from
 * the bundle's `guides/auth.md` (see `guide-loader.ts`), not a template slice.
 */
export interface TemplateSections {
  'api-grammar': string;
  'component-families': string;
  tokens: string;
  'design-quality': string;
  customization: string;
  'style-patterns': string;
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

/**
 * Load the template document once and slice it into the six
 * {@link TemplateSections} by `## …` heading (each running up to the next `---`
 * rule). Cached per process.
 */
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
    'style-patterns': extractSection(lines, '## Style Patterns', '---')
  };

  return cachedSections;
}

/** The cached sections if {@link loadTemplateSections} has run, else `null`. No I/O. */
export function getCachedSections(): TemplateSections | null {
  return cachedSections;
}
