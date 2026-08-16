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
 * The `@urbicon-ui/docs` components: the furniture documentation pages are
 * built FROM, not building blocks for a consumer's UI. They are filtered out
 * here, at assembly, rather than when the per-package `_catalog.json` is
 * written — that file is also what `summary:lint` and the docs site read, and
 * filtering upstream left the docs target with an empty catalog (2 bytes) and
 * therefore no metadata gate at all.
 *
 * Keep them out of the MCP catalog: `find_components` answers "what do I build
 * this UI from", and a PlaygroundConfigurator is never that answer.
 *
 * The rule is the package, not a list of names. A hand-kept list of the nine
 * components was the first version and it lasted one new component: `NoteList`
 * was added, nobody remembered the list, and it shipped into the public
 * catalog. Package membership is the actual criterion, so it is the one
 * encoded here.
 */
const INTERNAL_PACKAGE = '@urbicon-ui/docs';

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

    const publicEntries = allEntries.filter((e) => e.package !== INTERNAL_PACKAGE);

    // Sort alphabetically by name
    publicEntries.sort((a, b) => a.name.localeCompare(b.name));

    return publicEntries;
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
    const components = MCPCatalogAssembler.extractArray(metaContent, 'components');
    const features = MCPCatalogAssembler.extractArray(metaContent, 'features');
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

  /**
   * Extract the `const recipeCode = …` live-preview source from a recipe
   * `+page.svelte`.
   *
   * A backslash escape is skipped whole. Without that, an escaped backtick
   * inside the literal — the legal way to write one, and the only way a prose
   * comment in the snippet can quote a prop name — closed the scan early, and
   * `get_recipe` shipped the recipe truncated at that point with nothing
   * reporting it. (An *un*escaped backtick is a syntax error the Svelte
   * compiler already catches, so this is the half no other gate sees.)
   */
  static extractRecipeCode(content: string): string {
    const startMatch = content.match(RECIPE_CODE_START_RE);
    if (!startMatch) return '';

    const startIdx = (startMatch.index ?? 0) + startMatch[0].length;
    const rest = content.slice(startIdx);

    let depth = 0;
    let endIdx = -1;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '\\') {
        i++;
        continue;
      }
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
    const joined = parts.map((p) => p.replace(/^\s*`|`\s*$/g, '')).join('');
    return MCPCatalogAssembler.cookTemplateLiteral(joined);
  }

  /**
   * Resolve template-literal escape sequences the way JS does when the page
   * renders the string. The literals escape more than the backtick: the
   * closing `<\/script>` and — since the 2026-08-16 rollout — the OPENING
   * `<\script` too (Vite's dependency scanner extracts script blocks from
   * .svelte files with an HTML lexer, so a raw `<script` inside a string
   * literal starts a phantom module whose `$lib/…` imports then fail the
   * whole scan with ENOENT). Shipping the raw source would hand consumers
   * those backslashes verbatim; what `get_recipe` must serve is the cooked
   * string — exactly what the code panel displays.
   */
  static cookTemplateLiteral(source: string): string {
    let out = '';
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch !== '\\') {
        out += ch;
        continue;
      }
      const next = source[i + 1];
      if (next === undefined) {
        out += ch;
        break;
      }
      i++;
      switch (next) {
        case 'n':
          out += '\n';
          break;
        case 't':
          out += '\t';
          break;
        case 'r':
          out += '\r';
          break;
        case 'b':
          out += '\b';
          break;
        case 'f':
          out += '\f';
          break;
        case 'v':
          out += '\v';
          break;
        case '0':
          out += '\0';
          break;
        case '\n':
          // Line continuation: backslash-newline vanishes.
          break;
        case 'x': {
          const hex = source.slice(i + 1, i + 3);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            out += String.fromCharCode(Number.parseInt(hex, 16));
            i += 2;
          } else {
            out += next;
          }
          break;
        }
        case 'u': {
          if (source[i + 1] === '{') {
            const close = source.indexOf('}', i + 2);
            const hex = close === -1 ? '' : source.slice(i + 2, close);
            if (close !== -1 && /^[0-9a-fA-F]{1,6}$/.test(hex)) {
              out += String.fromCodePoint(Number.parseInt(hex, 16));
              i = close;
              break;
            }
          }
          const hex = source.slice(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(Number.parseInt(hex, 16));
            i += 4;
          } else {
            out += next;
          }
          break;
        }
        default:
          // `\``, `\\`, `\$`, `\/`, `\s` (the opening-tag escape), …:
          // the escape yields the character itself.
          out += next;
      }
    }
    return out;
  }

  private extractString(content: string, key: string): string {
    const match = content.match(new RegExp(`${key}:\\s*\\n?\\s*['"]([\\s\\S]*?)['"]\\s*[,}]`));
    if (!match?.[1]) return '';
    return match[1].replace(/'\s*\+\s*\n?\s*'/g, '').trim();
  }

  /**
   * Read a `key: [ 'a', 'b' ]` array of string literals out of a `meta.ts`.
   *
   * Scans quote by quote rather than splitting on commas: a comma inside a
   * literal is a character, not a separator. Splitting was the rule until
   * 2026-08-14, so every feature line containing one arrived in the catalog as
   * two or more entries, and `get_recipe` served the fragments to agents as if
   * each were a feature of its own. Measured on filter-sidebar: its six lines
   * came out as eleven, four of them the pieces of "Mixed filter controls" —
   * "RadioGroup property type", "range Slider for rent", "SegmentGroup
   * bedrooms", "Checkbox amenities".
   */
  static extractArray(content: string, key: string): string[] {
    const head = new RegExp(`${key}:\\s*\\[`).exec(content);
    if (!head) return [];

    const values: string[] = [];
    let quote: string | null = null;
    let literal = '';
    for (let i = head.index + head[0].length; i < content.length; i++) {
      const char = content[i];
      if (quote) {
        if (char === '\\') {
          literal += content[i + 1] ?? '';
          i++;
        } else if (char === quote) {
          if (literal.length > 0) values.push(literal);
          quote = null;
          literal = '';
        } else {
          literal += char;
        }
        continue;
      }
      if (char === "'" || char === '"' || char === '`') quote = char;
      else if (char === ']') break;
    }
    return values;
  }

  private slugToTitle(slug: string): string {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
