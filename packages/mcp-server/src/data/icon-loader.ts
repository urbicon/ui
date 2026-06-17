import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..', '..');

export interface IconEntry {
  name: string;
  componentName: string;
  label: string;
  categories: string[];
  keywords: string[];
}

let cachedIcons: IconEntry[] | null = null;

function getIconContextPath(): string {
  return resolve(packageRoot, '..', 'blocks', 'src', 'lib', 'icons', 'icon.context.ts');
}

/** Parse DEFAULT_ICONS to get the real name → ComponentName mapping */
export function parseComponentNames(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const start = content.indexOf('DEFAULT_ICONS');
  if (start === -1) return map;

  const end = content.indexOf('};', start);
  if (end === -1) return map;

  const block = content.slice(start, end);
  const regex = /(\w+):\s*(\w+Icon)/g;
  for (const match of block.matchAll(regex)) {
    map.set(match[1]!, match[2]!);
  }
  return map;
}

export function parseIconMetadata(content: string): IconEntry[] {
  const componentNames = parseComponentNames(content);
  const entries: IconEntry[] = [];

  const metadataStart = content.indexOf('ICON_METADATA');
  if (metadataStart === -1) return [];

  const entryRegex =
    /(\w+):\s*\{\s*label:\s*'([^']*)',\s*categories:\s*\[([^\]]*)\],\s*keywords:\s*\[([^\]]*)\]\s*\}/g;
  const block = content.slice(metadataStart);

  for (const match of block.matchAll(entryRegex)) {
    const name = match[1]!;
    const label = match[2]!;
    const categories = match[3]!
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((s) => s.length > 0);
    const keywords = match[4]!
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((s) => s.length > 0);

    const componentName =
      componentNames.get(name) ?? `${name.charAt(0).toUpperCase() + name.slice(1)}Icon`;

    entries.push({
      name,
      componentName,
      label,
      categories,
      keywords
    });
  }

  return entries;
}

export async function loadIcons(): Promise<IconEntry[]> {
  if (cachedIcons) return cachedIcons;

  try {
    const content = await readFile(getIconContextPath(), 'utf-8');
    cachedIcons = parseIconMetadata(content);
  } catch {
    cachedIcons = [];
  }

  return cachedIcons;
}
