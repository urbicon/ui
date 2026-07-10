/**
 * `urbicon recipe [id]` — complete Svelte 5 code recipes from the version-pinned
 * catalog, the local, version-correct mirror of the remote `get_recipe`. With no
 * id, lists all recipes; with an id, prints the full recipe (description, pattern,
 * components, code).
 */

import type { RecipeEntry } from '@urbicon-ui/design-engine/search';
import { boolFlag, type Flags } from '../args.js';
import { loadCatalog } from '../content.js';
import { EXIT, printError } from '../output.js';

/** Component name → catalog slug (Button → button, DatePicker → date-picker). */
function slugify(componentName: string): string {
  return componentName.replace(
    /([A-Z])/g,
    (_, c: string, i: number) => (i > 0 ? '-' : '') + c.toLowerCase()
  );
}

function formatRecipe(recipe: RecipeEntry): string {
  let md = `# Recipe: ${recipe.title}\n\n`;
  if (recipe.description) md += `${recipe.description}\n\n`;
  if (recipe.pattern) {
    md += `**Composition pattern:** \`${recipe.pattern}\` — this recipe is one instance of that page archetype. Run \`urbicon pattern ${recipe.pattern}\` for the layout/spacing/component-selection rules behind it.\n\n`;
  }
  if (recipe.components.length > 0) {
    md += `**Components used:** ${recipe.components.join(', ')}\n\n`;
  }
  if (recipe.features.length > 0) {
    md += '**Features:**\n';
    for (const f of recipe.features) md += `- ${f}\n`;
    md += '\n';
  }
  if (recipe.code) {
    md += `\`\`\`svelte\n${recipe.code}\n\`\`\`\n`;
  }

  md += '\n→ Next:';
  for (const comp of recipe.components.slice(0, 3)) {
    md += ` \`urbicon get-component ${slugify(comp)}\` ·`;
  }
  md += ' `urbicon css-reference` for tokens · `urbicon validate` before shipping.';
  return md;
}

export async function runRecipe(positionals: string[], flags: Flags): Promise<number> {
  const id = positionals[0];
  const asJson = boolFlag(flags, 'json');

  let recipes: RecipeEntry[];
  try {
    recipes = (await loadCatalog()).recipes;
  } catch (err) {
    printError(
      `could not read the component catalog (${(err as Error).message}). ` +
        'Reinstall @urbicon-ui/design-content, or run `docs:gen:all` in the monorepo.'
    );
    return EXIT.FAIL;
  }

  if (!id) {
    if (asJson) {
      console.log(
        JSON.stringify(
          recipes.map(({ id: rid, title, description, pattern }) => ({
            id: rid,
            title,
            description,
            pattern: pattern ?? null
          })),
          null,
          2
        )
      );
      return EXIT.OK;
    }
    console.log(`${recipes.length} recipe(s):\n`);
    for (const r of recipes) {
      const pattern = r.pattern ? `  ·  pattern: ${r.pattern}` : '';
      console.log(`  ${r.id}${pattern}\n    ${r.title} — ${r.description}\n`);
    }
    console.log('→ `urbicon recipe <id>` for the full recipe.');
    return EXIT.OK;
  }

  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) {
    printError(`recipe "${id}" not found. Available: ${recipes.map((r) => r.id).join(', ')}`);
    return EXIT.FAIL;
  }

  if (asJson) {
    console.log(JSON.stringify(recipe, null, 2));
    return EXIT.OK;
  }

  console.log(formatRecipe(recipe));
  return EXIT.OK;
}
