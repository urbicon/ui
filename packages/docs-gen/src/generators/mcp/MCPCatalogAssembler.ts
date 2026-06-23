import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import type { ComponentCatalog, ComponentCatalogEntry, RecipeEntry } from './MCPCatalogGenerator';

/** Head of a `const recipeCode =` declaration — locates the live-preview code in a recipe page. */
const RECIPE_CODE_START_RE = /const\s+recipeCode\s*=\s*\n?\s*/;
/** Template-literal concatenation seam (`` ` `` + `` ` ``) inside a recipeCode block. */
const RECIPE_CODE_CONCAT_RE = /`\s*\+\s*\n?\s*`/;

export interface MCPCatalogAssemblerConfig {
  staticDirs: string[];
  recipesDir: string;
  outputPath: string;
  version: string;
}

/**
 * Assembles the final component-catalog.json from per-package _catalog.json
 * files and extracted recipe data.
 */
export class MCPCatalogAssembler {
  private config: MCPCatalogAssemblerConfig;

  constructor(config: MCPCatalogAssemblerConfig) {
    this.config = config;
  }

  async assemble(): Promise<{ outputPath: string; componentCount: number; recipeCount: number }> {
    const components = await this.collectComponents();
    const recipes = await this.extractRecipes();

    const allTags = [...new Set(components.flatMap((c) => c.tags))].sort();

    const catalog: ComponentCatalog = {
      generated: new Date().toISOString(),
      version: this.config.version,
      components,
      recipes,
      tags: allTags
    };

    await fs.mkdir(path.dirname(this.config.outputPath), { recursive: true });
    await fs.writeFile(this.config.outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

    console.log(
      `📦 MCP catalog assembled: ${components.length} components, ${recipes.length} recipes → ${this.config.outputPath}`
    );

    return {
      outputPath: this.config.outputPath,
      componentCount: components.length,
      recipeCount: recipes.length
    };
  }

  private async collectComponents(): Promise<ComponentCatalogEntry[]> {
    const allEntries: ComponentCatalogEntry[] = [];

    for (const dir of this.config.staticDirs) {
      // glob() returns [] for a missing directory (it does not throw), so a
      // target that hasn't been generated is tolerated. But a _catalog.json
      // that exists yet is unreadable or malformed is a real build fault — let
      // it throw rather than silently ship a catalog with a whole package's
      // components missing (the failure mode that hid stale auth metadata).
      const catalogFiles = await glob(path.join(dir, '**/_catalog.json'), { absolute: true });
      for (const file of catalogFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const entries: ComponentCatalogEntry[] = JSON.parse(content);
        allEntries.push(...entries);
      }
    }

    // Sort alphabetically by name
    allEntries.sort((a, b) => a.name.localeCompare(b.name));

    return allEntries;
  }

  private async extractRecipes(): Promise<RecipeEntry[]> {
    const recipes: RecipeEntry[] = [];

    try {
      const metaFiles = await glob(path.join(this.config.recipesDir, '*/meta.ts'), {
        absolute: true
      });

      for (const metaPath of metaFiles) {
        try {
          const recipe = await this.extractRecipeFromMeta(metaPath);
          if (recipe) recipes.push(recipe);
        } catch {
          console.warn(`⚠️  Could not extract recipe from ${metaPath}`);
        }
      }
    } catch {
      console.warn('⚠️  Could not read recipes directory');
    }

    recipes.sort((a, b) => a.id.localeCompare(b.id));
    return recipes;
  }

  private async extractRecipeFromMeta(metaPath: string): Promise<RecipeEntry | null> {
    const recipeDir = path.dirname(metaPath);
    const id = path.basename(recipeDir);

    // Read structured metadata from meta.ts
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const title = this.extractString(metaContent, 'title') || this.slugToTitle(id);
    const description = this.extractString(metaContent, 'description') || '';
    const components = this.extractArray(metaContent, 'components');
    const features = this.extractArray(metaContent, 'features');
    // `pattern` cross-links the recipe to its Layer-4 composition pattern (get_pattern).
    // Carried in the catalog so get_recipe can serve it without re-reading recipe source.
    const pattern = this.extractString(metaContent, 'pattern');

    // Read recipeCode from +page.svelte (still embedded for live preview)
    const pagePath = path.join(recipeDir, '+page.svelte');
    let code = '';
    try {
      const pageContent = await fs.readFile(pagePath, 'utf-8');
      code = MCPCatalogAssembler.extractRecipeCode(pageContent);
    } catch {
      // No page = no code
    }

    // A recipe with no extractable `const recipeCode` is metadata-only — it cannot serve
    // as a "production-ready code recipe", so it is intentionally excluded from the catalog
    // (and thus from get_recipe / suggest_implementation, which both read catalog.recipes).
    if (!code) return null;

    return { id, title, description, components, code, features, ...(pattern ? { pattern } : {}) };
  }

  /** Extract the `const recipeCode = …` live-preview source from a recipe `+page.svelte`. */
  static extractRecipeCode(content: string): string {
    const startMatch = content.match(RECIPE_CODE_START_RE);
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
    const parts = raw.split(RECIPE_CODE_CONCAT_RE);
    return parts.map((p) => p.replace(/^\s*`|`\s*$/g, '')).join('');
  }

  private extractString(content: string, key: string): string {
    const match = content.match(new RegExp(`${key}:\\s*\\n?\\s*['"]([\\s\\S]*?)['"]\\s*[,}]`));
    if (!match?.[1]) return '';
    return match[1].replace(/'\s*\+\s*\n?\s*'/g, '').trim();
  }

  private extractArray(content: string, key: string): string[] {
    const match = content.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`, 's'));
    if (!match?.[1]) return [];
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s.length > 0);
  }

  private slugToTitle(slug: string): string {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
