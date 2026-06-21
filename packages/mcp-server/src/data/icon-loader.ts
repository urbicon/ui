import { readFile } from 'node:fs/promises';
import { getIconsPath } from '@urbicon-ui/design-content';

export interface IconEntry {
  name: string;
  componentName: string;
  label: string;
  categories: string[];
  keywords: string[];
}

let cachedIcons: IconEntry[] | null = null;

/**
 * Load the bundled icon metadata (`icons.json`, emitted by docs-gen from the blocks
 * icon registry). Read-tolerant: an absent bundle yields an empty set so `find_icons`
 * degrades gracefully instead of crashing the server.
 */
export async function loadIcons(): Promise<IconEntry[]> {
  if (cachedIcons) return cachedIcons;

  try {
    const raw = await readFile(getIconsPath(), 'utf-8');
    cachedIcons = JSON.parse(raw) as IconEntry[];
  } catch {
    cachedIcons = [];
  }

  return cachedIcons;
}
