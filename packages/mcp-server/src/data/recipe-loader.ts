import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getRecipeDir } from '../utils/paths.js';
import type { RecipeEntry } from './catalog-loader.js';

let cachedRecipes: RecipeEntry[] | null = null;

function extractRecipeCode(content: string): string {
  const startMatch = content.match(/const\s+recipeCode\s*=\s*\n?\s*/);
  if (!startMatch) return '';

  const startIdx = (startMatch.index ?? 0) + startMatch[0].length;
  const rest = content.slice(startIdx);

  let depth = 0;
  let endIdx = -1;

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '`') {
      depth = depth === 0 ? 1 : 0;
    }
    if (depth === 0 && rest[i] === ';') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return '';

  const raw = rest.slice(0, endIdx);
  const parts = raw.split(/`\s*\+\s*\n?\s*`/);
  return parts.map((p) => p.replace(/^\s*`|`\s*$/g, '')).join('');
}

export async function loadRecipes(): Promise<RecipeEntry[]> {
  if (cachedRecipes) return cachedRecipes;

  const recipeDir = getRecipeDir();
  const entries: RecipeEntry[] = [];

  let dirs: string[];
  try {
    dirs = await readdir(recipeDir);
  } catch {
    cachedRecipes = [];
    return [];
  }

  for (const dirName of dirs) {
    const dirPath = resolve(recipeDir, dirName);
    const dirStat = await stat(dirPath).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    // Read structured metadata from meta.ts
    const metaPath = resolve(dirPath, 'meta.ts');
    let meta: {
      title: string;
      description: string;
      components: string[];
      features: string[];
      pattern: string;
    };
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      meta = parseRecipeMeta(metaContent);
    } catch {
      continue;
    }

    // Read recipeCode from +page.svelte (still embedded there for the live preview)
    const pagePath = resolve(dirPath, '+page.svelte');
    let code = '';
    try {
      const pageContent = await readFile(pagePath, 'utf-8');
      code = extractRecipeCode(pageContent);
    } catch {
      // No page = no code, but metadata is still valid
    }

    entries.push({
      id: dirName,
      title: meta.title,
      description: meta.description,
      components: meta.components,
      code,
      features: meta.features,
      pattern: meta.pattern || undefined
    });
  }

  cachedRecipes = entries;
  return entries;
}

export async function getRecipeById(id: string): Promise<RecipeEntry | null> {
  const recipes = await loadRecipes();
  return recipes.find((r) => r.id === id) ?? null;
}

function parseRecipeMeta(content: string): {
  title: string;
  description: string;
  components: string[];
  features: string[];
  pattern: string;
} {
  const extractString = (key: string): string => {
    const match = content.match(new RegExp(`${key}:\\s*['"]([^'"]*?)['"]`));
    if (match?.[1]) return match[1];
    // Multi-line string with concatenation
    const multiMatch = content.match(new RegExp(`${key}:\\s*\\n?\\s*['"]([\\s\\S]*?)['"]`, 'm'));
    return multiMatch?.[1]?.replace(/'\s*\+\s*\n?\s*'/g, '') ?? '';
  };

  const extractArray = (key: string): string[] => {
    const match = content.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`, 's'));
    if (!match?.[1]) return [];
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s.length > 0);
  };

  return {
    title: extractString('title'),
    description: extractString('description'),
    components: extractArray('components'),
    features: extractArray('features'),
    pattern: extractString('pattern')
  };
}
